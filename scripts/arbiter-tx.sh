#!/usr/bin/env bash
# arbiter-tx.sh — apply the Orakel arbiter 2-of-3 multisig to an UNSIGNED tx envelope.
#
# The arbiter account is 2-of-3 native multisig (master + arbiter-signer-1 +
# arbiter-signer-2, weights 1/1/1, thresholds low/med/high = 1/2/2), so settling
# a disputed market (arbiter_resolve, a high-threshold contract invoke) needs two
# signatures. This wraps the invariant part of that flow —
# sign(arbiter) -> sign(arbiter-signer-1) -> submit — and reads the UNSIGNED tx
# envelope (base64 XDR) from stdin, or as $1. The *build* stays with the caller.
#
# Usage:
#   stellar contract invoke --source arbiter --network testnet --id C... --build-only \
#     -- arbiter_resolve --market_id 2 --outcome 0 \
#     | bash scripts/arbiter-tx.sh
#   bash scripts/arbiter-tx.sh "<unsigned-base64-xdr>"
#
# Env overrides: NETWORK (default testnet), ARBITER_KEY (arbiter), ARBITER_COSIGNER (arbiter-signer-1)
set -euo pipefail

NETWORK="${NETWORK:-testnet}"
ARBITER_KEY="${ARBITER_KEY:-arbiter}"
ARBITER_COSIGNER="${ARBITER_COSIGNER:-arbiter-signer-1}"

unsigned="${1:-$(cat)}"
if [ -z "${unsigned// }" ]; then
  echo "arbiter-tx.sh: no transaction XDR provided (stdin empty and no arg)" >&2
  exit 1
fi

# Soroban contract invocations must be simulated/assembled (footprint + resource
# fee + auth) before signing, or the network rejects them as TxMalformed. Classic
# ops cannot be simulated, so if `tx simulate` fails we fall back to the raw
# envelope. This keeps the script universal for both.
prepared=$(printf '%s' "$unsigned" | stellar tx simulate --source "$ARBITER_KEY" --network "$NETWORK" 2>/dev/null || true)
[ -n "${prepared// }" ] && unsigned="$prepared"

printf '%s' "$unsigned" \
  | stellar tx sign --sign-with-key "$ARBITER_KEY"      --network "$NETWORK" \
  | stellar tx sign --sign-with-key "$ARBITER_COSIGNER" --network "$NETWORK" \
  | stellar tx send --network "$NETWORK"
