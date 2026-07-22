# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is actually here

The `docs/` folder (`ORAKEL_ARCHITECTURE.md`, `ORAKEL_SPRINT_PLAN.md`,
`SECURITY_REVIEW.md`) describes a five-part system — contract + three bots
(keeper/watcher/finalizer) + indexer + Next.js web app. Current status:

- **Soroban prediction-market contract** (Rust, `no_std`) at
  `contracts/orakel-contracts/contracts/prediction-market/` — built,
  feature-frozen.
- **The three bots** live under `bots/` and are built:
  - `bots/keeper/` — proposes outcomes for Open `crypto_price` markets past
    `resolve_time` (Reflector + Pinata evidence).
  - `bots/watcher/` — **H-3 mitigation**: re-derives each proposed outcome with
    the *identical* shared Reflector read and disputes wrong ones within the
    window (CoinGecko is an alert-only divergence detector, never a dispute
    trigger).
  - `bots/finalizer/` — finalizes undisputed proposals after the dispute window.
- **`bots/shared/`** — the plumbing every bot imports: `invoke` (signed
  build→simulate→assemble→sign→submit→confirm), `simulate` (free reads),
  `scval`, `telegram`, `config`/`loadKeypair`, and the shared oracle-derivation
  logic `reflector.js` + `parse.js` (keeper and watcher MUST share these so an
  honest proposal never triggers a false dispute). Also contains the **indexer**
  (`indexer.js`, `db.js`, `scripts/indexer.js` → Supabase) and portfolio/
  activity/timeline/leaderboard/faucet backend helpers — built.
- **The Next.js web app is the only part not built yet.**

Read `docs/ORAKEL_ARCHITECTURE.md` Section 2 ("life of one market") before doing
cross-component work; treat unbuilt parts of the doc as design intent.

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

The contract is **feature-frozen** (per the architecture doc). Remaining
contract work is limited to hardening (e.g. proptest fuzzing of invariants),
not new entrypoints.

### Bots (Node ESM, Node ≥20)

Install once in the shared package, then run each bot from its own directory:

```bash
cd bots/shared && npm ci          # installs deps for shared + all bots
node --test                       # shared unit tests (invoke, scval, parse, events, ...)
cd bots/keeper    && node --test  # keeper unit tests (parse lives in shared now)
cd bots/watcher   && node --test  # watcher unit tests (coingecko)

# run a bot (secrets come from the repo-root .env; see .env.example):
cd bots/keeper    && npm start    # needs KEEPER_SECRET (XLM + USDC bonds)
cd bots/watcher   && npm start    # needs WATCHER_SECRET (XLM + USDC bonds)
cd bots/finalizer && npm start    # needs FINALIZER_SECRET (XLM only)
```

Notes:
- `node_modules/` is gitignored; the OneDrive move eroded it, so a clean
  `npm ci` (not just `npm install`) is the reliable fix.
- Secrets live only in the repo-root `.env` (`config.js` loads it via dotenv).
  Each bot loads its own `*_SECRET` by name via `loadKeypair`.
- Bots send Telegram on every action + a 10-min heartbeat, dedup repeated
  alerts per market, and never let a loop iteration crash the process.

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
  `claim`, `claim_lp`, `pause`, `set_arbiter`, `set_fees`, `withdraw_fees`
- **Read (free simulation, used by frontend/indexer):** `get_market`,
  `yes_price_bps`, `get_user_position`, `get_user_lp`, `market_count`
- **Events:** `mkt_new, buy, sell, liq_add, liq_rem, propose, dispute, final,
  arb_res, claim, claim_lp, paused, arbiter, feeswd`

## Security posture

`SECURITY_REVIEW.md` (both the crate copy and `docs/`) is an **internal threat
model, not a third-party audit** — never describe it as an audit. Several HIGH
findings (H-1 arbiter centralization, H-2 admin-key compromise, H-3 wrong
undisputed proposal) are **accepted risks for the testnet phase** with stated
mitigations. Read H-1..H-3 before changing resolution, dispute, or admin logic.
