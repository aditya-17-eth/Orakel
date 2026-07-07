# Orakel Prediction Market — Soroban Contract

Binary prediction markets (any sport, any objectively verifiable event) with:
- CPMM (Gnosis FPMM-style) YES/NO trading, USDC-settled
- Optimistic resolution: bonded propose → dispute window → permissionless finalize
- 2-of-3 multisig arbiter fallback for disputes (native Stellar multisig, no custom contract)
- Void outcome (cancelled fixtures pay 0.5/share)
- Per-market position caps + hard trading lock time (insider-trading mitigation)
- LP provisioning with fee share; pause that can never block user exits

State machine: `Open → (trading locked by time) → Proposed → [Disputed] → Resolved`

## Build & test

```bash
cd contracts/prediction-market
cargo test                       # 14 unit tests
stellar contract build           # produces the wasm
```

Verified with `soroban-sdk 21.7.7`. On latest SDK (22/23): bump the version in Cargo.toml and change `env.register_contract(None, OrakelMarket)` to `env.register(OrakelMarket, ())` in `src/test.rs`.

## Deploy (testnet)

```bash
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/orakel_prediction_market.wasm \
  --source deployer --network testnet

# USDC SAC on testnet (or wrap the issued asset):
stellar contract asset id --asset USDC:<ISSUER> --network testnet

stellar contract invoke --id <CONTRACT_ID> --source deployer --network testnet \
  -- initialize \
  --admin <ADMIN_G...> --arbiter <ARBITER_G...> --token <USDC_SAC_C...> \
  --protocol_fee_bps 100 --lp_fee_bps 100 --min_bond 500000000   # 50 USDC
```

## Arbiter multisig setup (do this BEFORE creating markets)

The contract only calls `require_auth()` on one arbiter Address. The 2-of-3 logic
lives in Stellar's native account signers — configure the arbiter account:

```bash
# On the arbiter account: add signers B and C with weight 1, set master weight 1,
# and set med/high thresholds to 2  =>  any 2 of {master, B, C} must sign.
stellar tx new set-options --source arbiter \
  --signer <SIGNER_B>:1 --network testnet ... (repeat for C, then set thresholds)
```

Make the **admin** account a multisig the same way. Rehearse signing an
`arbiter_resolve` invocation via Stellar Lab at least once before demo day.

## Creating the first market

```bash
stellar contract invoke --id <ID> --source admin --network testnet -- create_market \
  --creator <ADMIN> \
  --question '"Will Team A beat Team B (2026-07-10, Group C)?"' \
  --category football \
  --criteria_ref '"ipfs://<CID of resolution criteria + named data source>"' \
  --lock_time <unix: kickoff> --resolve_time <unix: kickoff + 2h15m> \
  --dispute_window 7200 --position_cap 5000000000 \
  --bond 10000000000 --initial_liquidity 10000000000
```

Rule of thumb: `bond ≥ initial_liquidity` (see SECURITY_REVIEW.md, M-1).

## Bot integration

- **Keeper (AI Result Agent):** after `resolve_time`, parse the official result
  from the named source, call `propose`. Publish the raw source snapshot + parse.
- **Watcher (separate key, separate data source):** poll `propose` events; if its
  own parse disagrees, call `dispute` immediately. This is your only automated
  defense against H-3 — do not skip it.
- **Finalizer:** after `proposal_time + dispute_window`, call `finalize`
  (permissionless). Then nudge users to `claim` / `claim_lp`.

Key read entrypoints for the indexer/frontend: `get_market`, `yes_price_bps`,
`get_user_position`, `get_user_lp`, `market_count`, plus events:
`mkt_new, buy, sell, liq_add, liq_rem, propose, dispute, final, arb_res, claim, claim_lp, paused, arbiter, feeswd`.

## Files

- `contracts/prediction-market/src/lib.rs` — the contract
- `contracts/prediction-market/src/test.rs` — 14 tests (lifecycle, dispute, caps, locks, pause, AMM invariants)
- `SECURITY_REVIEW.md` — threat model + findings (read H-1..H-3 before the pitch Q&A)
