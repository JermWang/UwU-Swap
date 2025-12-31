# Commit To Ship — Operations Runbook

## Production Deployment Checklist

- Configure environment variables (see `.env.example`).
- Run Supabase migrations (including `0006_rate_limits.sql`, `0007_weighted_approvals.sql`, `0008_audit_logs.sql`).
- Ensure `DATABASE_URL` is set (required in production).
- Ensure `CTS_MOCK_MODE` is unset/false (forbidden in production).
- Ensure `ESCROW_DB_SECRET` is set (required in production to encrypt escrow secrets).
- Ensure `ADMIN_WALLET_PUBKEYS` is set (required in production).
- Ensure `APP_ORIGIN` is set (required in production for admin endpoints).
- Ensure `SOLANA_RPC_URL` points to a reliable provider.

## Critical Secrets + Rotation

### `ESCROW_DB_SECRET`

- Purpose: encrypts escrow secret keys at rest.
- Rotation requires a controlled migration:
  - Deploy code that can decrypt with both old+new keys (not implemented).
  - Re-encrypt all escrow secrets.
  - Remove old key.

### `PRIVY_APP_SECRET`

- Purpose: signs and sends transactions for Privy-managed escrow wallets.
- Rotation:
  - Update secret in hosting provider.
  - Validate pump.fun launch flow and any Privy wallet signing paths.

### `SUPABASE_SERVICE_ROLE_KEY`

- Purpose: server-side avatar upload signing.
- Rotation:
  - Update in hosting provider.
  - Validate avatar upload-url endpoint.

### `ESCROW_FEE_PAYER_SECRET_KEY` (optional)

- Purpose: sponsor fees for escrow transfers.
- Rotation:
  - Replace with a funded new key.
  - Monitor for failed fee-payer balance checks.

## Monitoring & Alerts

### Audit Logs

- Stored in Postgres table: `public.audit_logs`.
- High-signal events can optionally be delivered to `AUDIT_WEBHOOK_URL`.

Recommended alert triggers:

- Any `*_error` event.
- Any `*_denied` event.
- Any `admin_*` event.

### Rate Limiting

- Stored in Postgres table: `public.rate_limits`.
- If DB is down in production, rate limiting fails closed (requests are rejected).

## Incident Response

### 1) Database outage / connection failures

Symptoms:

- API endpoints return `Database connection failed`.
- Rate limiting begins rejecting requests.

Actions:

- Confirm `DATABASE_URL` validity.
- Confirm Supabase status / pooler status.
- If using Supabase pooler, ensure pooler URL and port are correct.
- Consider temporarily increasing `PG_POOL_CONNECTION_TIMEOUT_MS`.

### 2) Solana RPC outage / degraded RPC

Symptoms:

- Funding/release actions fail to confirm.
- Voting endpoints time out.

Actions:

- Switch `SOLANA_RPC_URL` to a backup provider.
- Verify the new RPC supports `getLatestBlockhash`, `getBlockTime`, token account parsing.

### 3) Stuck “release lock” / concurrent release

Symptoms:

- Reward milestone release returns `Release already in progress`.

Actions:

- Check `reward_release_locks` row for that `(commitmentId, milestoneId)`.
- If no tx sig and lock is stale, delete/clear lock row.

### 4) Underfunded escrow

Symptoms:

- Release endpoint fails with `Escrow underfunded for this release`.

Actions:

- Verify escrow address balance in explorer.
- In assisted mode, funding is voluntary; communicate expectations clearly.
- In managed mode, verify fee routing is correctly configured.

## Reconciliation

### Escrow balance reconciliation

- Query all open commitments.
- For each commitment:
  - Fetch escrow balance on-chain.
  - Compare against expected funded amount (personal) or milestone unlock schedule (reward).

### Admin action reconciliation

- Use `audit_logs` to enumerate:
  - `admin_commitment_*`
  - `admin_reward_milestone_release_*`
  - `admin_pumpfun_launch_*`

For each event with a `signature`, confirm the tx on explorer.

## Scheduled Tasks

### Reward milestone normalization

- Use the admin-only normalization endpoint to keep reward milestone claimable status aligned with time + approvals.
- This endpoint is designed to be called by a cron/scheduler.
