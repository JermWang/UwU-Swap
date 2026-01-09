import { Connection, PublicKey } from "@solana/web3.js";
import { resolve } from "@bonfida/spl-name-service";

/**
 * Resolve a .sol domain to a Solana public key using the official Bonfida SDK
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

    // Use official Bonfida SDK to resolve the domain
    const owner = await resolve(connection, name);
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
