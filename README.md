# 🌸 Uwu Swap

Privacy-first token transfers on Solana. Send tokens through ephemeral wallet chains to break traceability.

## Features

- **Private Transfers**: Route tokens through randomized burner wallet chains
- **AI Chat Interface**: Natural language commands like "send 2 SOL privately to [address]"
- **$UWU Token Benefits**: Hold $UWU to waive transfer fees (configure `UWU_TOKEN_MINT`)
- **Randomized Routing**: Variable hop counts, timing delays, and wallet structures

## Getting Started

### Prerequisites

- Node.js >= 20.18.0
- npm >= 10.8.2
- Solana wallet (Phantom, Backpack, or Solflare)

### Installation

```bash
npm install
```

### Environment Variables

Copy `.env.example` to `.env.local` and configure:

```bash
cp .env.example .env.local
```

Required variables:
- `SOLANA_RPC_URL` - Your Solana RPC endpoint
- `NEXT_PUBLIC_SOLANA_RPC_URL` - Client-side RPC URL
- `SUPABASE_URL` - Supabase project URL (for persisted routing plans)
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `UWU_TOKEN_MINT` - $UWU token mint address (holders can have fees waived)
- `UWU_TREASURY_WALLET` - Treasury wallet for fees
- `PRIVY_APP_ID` - Privy app ID (for managed wallets)
- `PRIVY_APP_SECRET` - Privy app secret
- `ESCROW_FEE_PAYER_SECRET_KEY` - Fee payer for routing hop transactions
- `OPENAI_API_KEY` - (optional) for conversational Nana chat

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Production Build

```bash
npm run build
npm start
```

## Architecture

```
app/
├── api/
│   ├── balance/        # Wallet balance + $UWU check
│   ├── chat/           # Conversational assistant (LLM-backed)
│   ├── transfer/       # Create routing plans
│   │   ├── status/     # Poll transfer status
│   │   ├── step/       # Advance routing execution (server-side)
│   │   └── execute/    # Deprecated (returns 410)
│   └── health/         # Health check
├── components/
│   ├── SolanaWalletProvider.tsx
│   └── ToastProvider.tsx
├── lib/
│   ├── uwuRouter.ts    # Ephemeral wallet routing logic
│   ├── uwuChat.ts      # Chat command parsing + responses
│   ├── solana.ts       # Solana utilities
│   ├── rpc.ts          # RPC connection helpers
│   └── privy.ts        # Privy wallet integration
├── page.tsx            # Main chat UI
├── layout.tsx          # App layout
└── globals.css         # Uwu theme styles
```

## How It Works

1. **User Request**: "send 2 SOL privately to 9xj...abc"
2. **Plan Creation**: Generate 2-5 burner wallets with randomized delays
3. **Initial Funding**: User signs transaction to first burner
4. **Hop Execution**: Server routes funds through burner chain
5. **Final Delivery**: Tokens arrive at destination

## Fee Structure

| Holder Status | Fee |
|--------------|-----|
| $UWU Holder | FREE |
| Non-holder | 0.5% |

## Security Notes

- Burner wallet private keys are ephemeral and never stored permanently
- All routing happens server-side after initial user signature
- Fee payer covers transaction costs for routing hops

## License

MIT
