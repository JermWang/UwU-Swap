export const UWU_KNOWLEDGE_BASE_TEXT = `
Uwu Swap is a privacy-focused transfer experience on Solana.

What it does:
- Helps you send SOL (and some SPL flows server-side) using a short chain of ephemeral routing accounts (typically 2-5 hops).
- Adds randomized timing delays between hops to make simple timing correlation harder.

How a connected-wallet private transfer works:
- You initiate a transfer by specifying an amount and destination.
- You sign a funding transaction from your connected wallet to the first routing-hop address.
- The server detects funding and then routes the funds hop-by-hop.
- Routing accounts are Privy-managed; private keys are not exposed to the browser.

Fees:
- If you hold the configured $UWU token mint, fees can be waived.
- Otherwise, a small fee may be collected to the configured treasury wallet.

Limitations / product status:
- Quick Send (no-wallet-connect deposit address flow) is not enabled in production yet.
- This is privacy-oriented routing, not a promise of perfect anonymity. Avoid absolute claims.
`;
