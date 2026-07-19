# Orakel production status

Updated: 2026-07-19

## Completed

- Soroban prediction-market lifecycle with CPMM YES/NO trading, LP liquidity,
  optimistic resolution, dispute handling, claims, pause controls, position
  caps, and a combined fee ceiling of 5%.
- Opt-in collateral-backed position loans with a 3x total-exposure ceiling,
  isolated loan reserve, repayment, and post-resolution settlement.
- Supabase event schema, indexes, leaderboard aggregation, faucet cooldowns,
  and a restart-safe Stellar Testnet indexer.
- Browser-safe contract reads and prepared Soroban transaction submission.
- Freighter, xBull, and Albedo connection support through Stellar Wallets Kit,
  with application-wide connection state.
- Reference Orakel neon frontend integrated with live market listing, countdowns,
  market detail, Pinata evidence, positions, buy/sell quotes, claims, footprint
  restoration, loans, portfolio, activity, leaderboard, and Testnet faucet.
- Server-side rate limiting and server-only Supabase/Pinata credentials.

## Verification

- Contract tests: 17 passing.
- Shared backend/indexer tests: 19 passing.
- Next.js production build: passing.
- Live Supabase and Stellar RPC status check: passing.

## Requires the admin signer

These steps are intentionally not attempted until the correct contract admin
signer is available:

1. Fund the isolated loan reserve with the collateral token.
2. Call `set_loan_config(true, 30000)` to enable the 3x facility.
3. Create and seed the first Testnet market, if the deployed contract still has
   a market count of zero.

Never paste the secret key into this repository, a `.env` file, Vercel, or a
chat. Store it only in the Stellar CLI identity store and invoke admin actions
by identity alias.

## Remaining before Mainnet

- Independent Soroban security audit and economic review.
- Independent price source plus liquidation and bad-debt policy for lending.
- Native multisig rehearsal for admin and arbiter accounts.
- Persistent hosted indexer monitoring, alerting, and database backups.
- Mainnet token, RPC, contract deployment, and operational runbook.
