import { LAMPORTS_PER_SOL } from "@solana/web3.js";

// ============================================================================
// Chat Command Parsing
// ============================================================================

export type ParsedTransferCommand = {
  type: "transfer";
  amount: number;
  asset: "SOL" | { mint: string; symbol?: string };
  destination: string;
  raw: string;
};

export type ParsedCommand =
  | ParsedTransferCommand
  | { type: "help"; raw: string }
  | { type: "status"; transferId?: string; raw: string }
  | { type: "balance"; raw: string }
  | { type: "unknown"; raw: string };

const SOL_AMOUNT_REGEX = /(\d+(?:\.\d+)?)\s*(?:sol|SOL|◎)/i;
const WALLET_REGEX = /([1-9A-HJ-NP-Za-km-z]{32,44})/;
const SEND_KEYWORDS = ["send", "transfer", "move", "pay", "give"];

export function parseUserMessage(message: string): ParsedCommand {
  const raw = message.trim();
  const lower = raw.toLowerCase();

  // Help command
  if (lower === "help" || lower === "/help" || lower.includes("how do i") || lower.includes("what can you do")) {
    return { type: "help", raw };
  }

  // Status command
  if (lower.startsWith("status") || lower.startsWith("/status")) {
    const parts = raw.split(/\s+/);
    const transferId = parts.length > 1 ? parts[1] : undefined;
    return { type: "status", transferId, raw };
  }

  // Balance command
  if (lower === "balance" || lower === "/balance" || lower.includes("my balance") || lower.includes("check balance")) {
    return { type: "balance", raw };
  }

  // Transfer command detection
  const hasSendKeyword = SEND_KEYWORDS.some((kw) => lower.includes(kw));
  const solMatch = raw.match(SOL_AMOUNT_REGEX);
  const walletMatch = raw.match(WALLET_REGEX);

  if (hasSendKeyword && solMatch && walletMatch) {
    const amount = parseFloat(solMatch[1]);
    const destination = walletMatch[1];

    return {
      type: "transfer",
      amount,
      asset: "SOL",
      destination,
      raw,
    };
  }

  // Check for "privately" or "private" to confirm intent
  if ((lower.includes("private") || lower.includes("uwu")) && solMatch && walletMatch) {
    const amount = parseFloat(solMatch[1]);
    const destination = walletMatch[1];

    return {
      type: "transfer",
      amount,
      asset: "SOL",
      destination,
      raw,
    };
  }

  return { type: "unknown", raw };
}

// ============================================================================
// Response Generation
// ============================================================================

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  metadata?: {
    transferId?: string;
    status?: "pending" | "routing" | "complete" | "failed";
  };
};

export function generateHelpResponse(): string {
  return `# Uwu Swap Commands ~

Privacy-first token transfers on Solana, nya~

## Commands
- **Send tokens**: "send 2 SOL privately to [address]"
- **Check balance**: "balance"
- **Transfer status**: "status"

## How It Works
1. Tell me where to send your tokens~
2. I'll generate a sneaky routing plan
3. Sign the transaction in your wallet
4. Watch your tokens hop through burner wallets!

## Fees
- **$UWU holders**: Zero fees (you're the best~)
- **Standard**: 0.5% protocol fee`;
}

export function generateTransferConfirmation(input: {
  amount: number;
  destination: string;
  estimatedTimeMs: number;
  hopCount: number;
  feeApplied: boolean;
  feeSol: number;
}): string {
  const { amount, destination, estimatedTimeMs, hopCount, feeApplied, feeSol } = input;
  const shortDest = `${destination.slice(0, 4)}...${destination.slice(-4)}`;
  const timeSeconds = Math.ceil(estimatedTimeMs / 1000);

  let response = `# Transfer Plan Ready ~

**Amount**: ${amount} SOL
**Destination**: \`${shortDest}\`
**Privacy Hops**: ${hopCount} sneaky wallets
**Estimated Time**: ~${timeSeconds}s

`;

  if (feeApplied) {
    response += `**Fee**: ${feeSol.toFixed(4)} SOL (0.5%)

_Hold $UWU tokens for zero-fee transfers~_

`;
  } else {
    response += `**Fee**: None (thanks for holding $UWU!)

`;
  }

  response += `Sign the transaction to start the transfer, nya~`;

  return response;
}

export function generateRoutingUpdate(input: {
  currentHop: number;
  totalHops: number;
  status: "routing" | "complete" | "failed";
  signature?: string;
  error?: string;
}): string {
  const { currentHop, totalHops, status, signature, error } = input;

  if (status === "routing") {
    const progress = Math.round((currentHop / totalHops) * 100);
    const messages = [
      "hopping through the chain~",
      "sneaking past watchers~",
      "almost there~",
      "wrapping up~",
    ];
    return `Hop ${currentHop}/${totalHops}... ${messages[currentHop % 4]} (${progress}%)`;
  }

  if (status === "complete") {
    const shortSig = signature ? `${signature.slice(0, 8)}...` : "";
    return `# Transfer Complete!

Your tokens arrived safely~

**TX**: \`${shortSig}\`

View on Solscan for confirmation, nya~`;
  }

  return `# Transfer Failed

**Error**: ${error || "Unknown error"}

Funds in routing chain may need recovery. Contact support~`;
}

export function generateBalanceResponse(input: {
  solBalance: number;
  hasShipToken: boolean;
}): string {
  const { solBalance, hasShipToken } = input;

  let response = `# Wallet Balance

**SOL**: ${solBalance.toFixed(4)}

`;

  if (hasShipToken) {
    response += `**Status**: $UWU Holder (Zero fees, you're amazing~)`;
  } else {
    response += `**Status**: Standard (0.5% fee)\n\n_Get $UWU tokens for free transfers~_`;
  }

  return response;
}

export function generateUnknownResponse(): string {
  const responses = [
    "Hmm, I didn't catch that~ Try 'send 2 SOL privately to [address]' or type 'help'!",
    "Unknown command, nya~ Type 'help' for available commands!",
    "Not sure what you mean~ Example: 'send 1.5 SOL privately to 9xj...abc'",
  ];
  return responses[Math.floor(Math.random() * responses.length)];
}

export function generateInsufficientFundsResponse(required: number, available: number): string {
  return `# Insufficient Balance

**Required**: ${required.toFixed(4)} SOL
**Available**: ${available.toFixed(4)} SOL

Add more SOL to your wallet and try again~`;
}

export function generateSigningMessage(): string {
  return "Waiting for your signature~";
}

export function generateRoutingStartMessage(): string {
  return "Starting private transfer! Routing through burner wallets, nya~";
}

// ============================================================================
// Utility
// ============================================================================

export function solToLamports(sol: number): bigint {
  return BigInt(Math.floor(sol * LAMPORTS_PER_SOL));
}

export function lamportsToSol(lamports: bigint): number {
  return Number(lamports) / LAMPORTS_PER_SOL;
}
