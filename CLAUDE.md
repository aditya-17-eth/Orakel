# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is actually here

Only one buildable component exists today: the **Soroban prediction-market
contract** (Rust, `no_std`) at
`contracts/orakel-contracts/contracts/prediction-market/`. The `docs/`
folder (`ORAKEL_ARCHITECTURE.md`, `ORAKEL_SPRINT_PLAN.md`, `SECURITY_REVIEW.md`)
describes a five-part system — contract + three bots (keeper/watcher/finalizer)
+ indexer + Next.js web app. **The bots, indexer, and web app are not built
yet.** Treat the architecture doc as design intent, not existing code, and read
it (`docs/ORAKEL_ARCHITECTURE.md`, Section 2 "life of one market") before doing
cross-component work.

## Build & test

There is no Cargo workspace at the repo root — run cargo from inside the crate:

```bash
cd contracts/orakel-contracts/contracts/prediction-market
cargo test                    # 14 unit tests (src/test.rs)
cargo test <name>             # single test, e.g. cargo test happy_path_buy_propose_finalize_claim
stellar contract build        # produces the wasm (needs the wasm32-unknown-unknown target)
```

Note: the crate's own `README.md` says `cd contracts/prediction-market`; the
real path has an extra `orakel-contracts/` segment (above).

Pinned to `soroban-sdk 21.7.7`. To move to SDK 22/23: bump the version in
`Cargo.toml` and change `env.register_contract(None, OrakelMarket)` to
`env.register(OrakelMarket, ())` in `src/test.rs`.

Contract changes must preserve the invariants below. New lending entrypoints
are isolated, disabled by default, and require dedicated tests plus a security
review before production enablement.

## Non-negotiable invariants (do not break these)

The contract is the only trusted component and holds all funds. Six invariants
are enforced by construction and asserted in tests — documented at the top of
`src/lib.rs` and in `SECURITY_REVIEW.md`:

- **I1** `token_balance(contract) >= trading_collateral + escrowed_bonds + fees`
- **I2** `yes_outstanding == no_outstanding` always (complete-set minting only; 1 collateral backs 1 YES + 1 NO)
- **I3** `yes_reserve * no_reserve` never decreases on a trade — **all rounding must favor the pool**
- **I4** State machine cannot be skipped: `Open → (lock by time) → Proposed → [Disputed] → Resolved`; claims only when `Resolved`
- **I5** Trading reverts at/after `lock_time` from ledger time, independent of any state flag
- **I6** `pause` blocks new risk only; it can **never** block exits (`finalize`, `arbiter_resolve`, `claim`, `claim_lp`)

Any change touching AMM math, share accounting, the state machine, or pause
logic must preserve these. When in doubt, add/extend a test in `src/test.rs`
that asserts the relevant invariant.

## Things that will bite you

- **`overflow-checks = true` in `[profile.release]` must stay on.** Arithmetic
  overflow must trap, never wrap — it is a solvency guarantee, not an optimization.
- **USDC on Stellar uses 7 decimals.** `10000000000` = 1,000 USDC. A decimals
  slip is the classic testnet mistake; triple-check every amount and CLI arg.
- **House rule from the threat model (finding M-1): `bond >= initial_liquidity`**
  when creating a market, so lying to resolve is never profitable.
- **Void pays 0.5 collateral per share to both sides** (cancelled/abandoned
  fixtures). This redistributes value and must be surfaced to users (finding M-5).
- **The 2-of-3 arbiter is native Stellar multisig, off-contract.** The contract
  only calls `require_auth()` on one arbiter Address; the 2-of-3 threshold lives
  in that account's signer weights. There is no custom multisig contract.
- **Soroban storage rent (finding M-6):** positions/LP entries get their TTL
  extended on every touch, but an untouched entry can be archived and needs
  `RestoreFootprint` before it can be claimed again. Funds are never lost.

## Contract surface (src/lib.rs)

- **Write:** `initialize`, `create_market`, `buy`, `sell`, `add_liquidity`,
  `remove_liquidity`, `propose`, `dispute`, `finalize`, `arbiter_resolve`,
  `claim`, `claim_lp`, `pause`, `set_arbiter`, `set_fees`, `withdraw_fees`,
  `set_loan_config`, `fund_loan_reserve`, `withdraw_loan_reserve`, `borrow`,
  `repay`, `settle_loan`
- **Read (free simulation, used by frontend/indexer):** `get_market`,
  `yes_price_bps`, `get_user_position`, `get_user_loan`, `get_user_lp`,
  `market_count`
- **Events:** `mkt_new, buy, sell, liq_add, liq_rem, propose, dispute, final,
  arb_res, claim, claim_lp, borrow, repay, loan_set, paused, arbiter, feeswd`

## Security posture

`SECURITY_REVIEW.md` (both the crate copy and `docs/`) is an **internal threat
model, not a third-party audit** — never describe it as an audit. Several HIGH
findings (H-1 arbiter centralization, H-2 admin-key compromise, H-3 wrong
undisputed proposal) are **accepted risks for the testnet phase** with stated
mitigations. Read H-1..H-3 before changing resolution, dispute, or admin logic.
