# Resolution Criteria — Will BTC/USD be at or above $64,000.00 at 2026-07-18 04:30:00 UTC?

**Market ID:** [fill after create_market] · **Category:** crypto-price
**Created:** 2026-07-17 · **Template version:** 1.0

This document is pinned to IPFS and its CID is committed on-chain in this market's
`criteria_ref` at creation. It cannot be changed after trading begins. It is the
single authoritative definition of how this market resolves. If this document and
any other description of the market disagree, this document wins.

---

## 1. The question

> Will BTC/USD be at or above $64,000.00 at 2026-07-18 04:30:00 UTC?

## 2. Resolution source (authoritative)

- **Primary source (the keeper reads this):** Reflector oracle, Stellar testnet —
  contract CCYOZJCOPG34LLQQ7N24YXBM7LL62R7ONMZ3G6WZAAYPB5OYKOMJRN63, asset BTC, `lastprice()` taken at
  the first reading at or after the resolve timestamp.
- **Verification source (the watcher reads this — independent):** CoinGecko API,
  `GET /api/v3/simple/price?ids=bitcoin&vs_currencies=usd`, first reading at or
  after the resolve timestamp.
- If the primary source is unavailable for more than 60 minutes after resolve
  time, the verification source becomes authoritative. If both are unavailable
  for more than 24 hours, the market resolves **Void**.

## 3. YES means, exactly

The primary source reports a BTC/USD price **greater than or equal to
64000.00** at the first reading at or after the resolve timestamp in §1.

Edge rules:
- **Equality counts as YES** (price exactly 64000.00 → YES).
- Timezone for all times in this document: **UTC**.
- The comparison uses the source's reported price normalized to 2 decimal
  places, rounding half up.

## 4. NO means, exactly

Everything that is not YES and not Void — i.e., the first reading at or after
the resolve timestamp is below 64000.00.

## 5. Void means, exactly — READ THIS BEFORE TRADING

This market resolves **Void** only if both data sources in §2 are unavailable
for more than 24 hours after the resolve timestamp.

**Void pays 0.50 USDC per share to BOTH sides, regardless of the price you
paid.** If you bought YES at 0.90, a Void resolution returns 0.50 per share — a
loss of 0.40 per share. If you bought at 0.10, Void returns 0.50 — a gain. This
is standard prediction-market practice. By trading, you accept it.

## 6. Timeline

| Event | Time (UTC) |
|---|---|
| Trading locks (`lock_time`) | 2026-07-18 02:30:00 UTC |
| Earliest resolution proposal (`resolve_time`) | 2026-07-18 04:30:00 UTC |
| Dispute window | 7200 s (2 h) after proposal |

## 7. Process

After `resolve_time`, a bonded proposer (normally the Orakel keeper) submits an
outcome with an IPFS-pinned evidence bundle (raw source response + parse +
timestamp). An independent watcher verifies against the §2 verification source
and disputes any mismatch. Undisputed proposals finalize after the dispute
window; disputed markets are decided by the on-chain 2-of-3 arbiter multisig,
which must follow §§3–5 of this document. Anyone may dispute during the window
by posting the bond.

## 8. Testnet notice

This market runs on Stellar **testnet** with test-USDC that has no monetary
value. It is a technology demonstration.
