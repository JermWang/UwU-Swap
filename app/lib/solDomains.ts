import { Connection, PublicKey } from "@solana/web3.js";
import { createHash } from "crypto";

// SNS (Solana Name Service) domain resolution
// Uses the official SNS SDK approach

const SOL_TLD_AUTHORITY = new PublicKey("58PwtjSDuFHuUkYjH9BYnnQKHfwo9reZhC2zMJv9JPkx");
const NAME_PROGRAM_ID = new PublicKey("namesLPneVptA9Z5rqUDD9tMTWEJwofgaYwp8cawRkX");

// Hash a domain name for SNS lookup
function getHashedName(name: string): Buffer {
  const input = Buffer.from(name);
  return createHash("sha256").update(input).digest();
}

// Derive the name account address
function getNameAccountKey(hashed: Buffer, nameClass?: PublicKey, parentName?: PublicKey): PublicKey {
  const seeds = [hashed];
  if (nameClass) {
    seeds.push(nameClass.toBuffer());
  } else {
    seeds.push(Buffer.alloc(32));
  }
  if (parentName) {
    seeds.push(parentName.toBuffer());
  } else {
    seeds.push(Buffer.alloc(32));
  }
  
  const [nameAccountKey] = PublicKey.findProgramAddressSync(seeds, NAME_PROGRAM_ID);
  return nameAccountKey;
}

// Get the .sol TLD key
function getSolTldKey(): PublicKey {
  const hashedTld = getHashedName("sol");
  return getNameAccountKey(hashedTld, undefined, SOL_TLD_AUTHORITY);
}

/**
 * Resolve a .sol domain to a Solana public key
 * @param domain - The domain name (e.g., "toly.sol" or just "toly")
 * @param connection - Solana connection
 * @returns The resolved public key or null if not found
 */
export async function resolveSolDomain(
  domain: string,
  connection: Connection
): Promise<PublicKey | null> {
  try {
    // Normalize domain - remove .sol suffix if present
    let name = domain.toLowerCase().trim();
    if (name.endsWith(".sol")) {
      name = name.slice(0, -4);
    }
    
    if (!name || name.length === 0) {
      return null;
    }

    // Get the domain's name account
    const hashedName = getHashedName(name);
    const solTldKey = getSolTldKey();
    const domainKey = getNameAccountKey(hashedName, undefined, solTldKey);

    // Fetch the account data
    const accountInfo = await connection.getAccountInfo(domainKey);
    if (!accountInfo || !accountInfo.data) {
      return null;
    }

    const data = accountInfo.data;
    if (data.length < 96 + 32) {
      return null;
    }

    // NameRecordHeader layout (96 bytes total):
    // - parentName: 0..32
    // - owner: 32..64
    // - class: 64..96
    const ownerBytes = data.slice(32, 64);
    const owner = new PublicKey(ownerBytes);
    
    // Verify it's not the system program (empty/uninitialized)
    if (owner.equals(PublicKey.default)) {
      return null;
    }

    return owner;
  } catch (error) {
    console.error("Failed to resolve .sol domain:", error);
    return null;
  }
}

/**
 * Check if a string is a .sol domain
 */
export function isSolDomain(input: string): boolean {
  const trimmed = input.trim().toLowerCase();
  return trimmed.endsWith(".sol") && trimmed.length > 4;
}

/**
 * Resolve an address or .sol domain to a PublicKey
 * @param input - Either a base58 pubkey or a .sol domain
 * @param connection - Solana connection
 * @returns The resolved PublicKey or null if invalid
 */
export async function resolveAddressOrDomain(
  input: string,
  connection: Connection
): Promise<{ pubkey: PublicKey; isDomain: boolean; original: string } | null> {
  const trimmed = input.trim();
  
  // Check if it's a .sol domain
  if (isSolDomain(trimmed)) {
    const resolved = await resolveSolDomain(trimmed, connection);
    if (resolved) {
      return { pubkey: resolved, isDomain: true, original: trimmed };
    }
    return null;
  }
  
  // Try to parse as a regular pubkey
  try {
    const pubkey = new PublicKey(trimmed);
    return { pubkey, isDomain: false, original: trimmed };
  } catch {
    return null;
  }
}
