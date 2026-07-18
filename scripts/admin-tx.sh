#!/usr/bin/env bash
# admin-tx.sh — apply the Orakel admin 2-of-3 multisig to an UNSIGNED tx envelope.
#
# The admin account is 2-of-3 native multisig (master + admin-signer-1 +
# admin-signer-2, thresholds 1/2/2), so every medium/high-threshold admin action
# needs two signatures. This wraps the invariant part of that flow —
# sign(admin) -> sign(admin-signer-1) -> submit — and reads the UNSIGNED tx
# envelope (base64 XDR) from stdin, or as $1. The *build* stays with the caller
# because it differs per operation (change-trust, payment, contract invoke, ...).
#
# Usage:
#   stellar tx new change-trust --source admin --line USDC:G... --build-only --network testnet \
#     | bash scripts/admin-tx.sh
#   bash scripts/admin-tx.sh "<unsigned-base64-xdr>"
#
# Env overrides: NETWORK (default testnet), ADMIN_KEY (admin), ADMIN_COSIGNER (admin-signer-1)
set -euo pipefail

NETWORK="${NETWORK:-testnet}"
ADMIN_KEY="${ADMIN_KEY:-admin}"
ADMIN_COSIGNER="${ADMIN_COSIGNER:-admin-signer-1}"

unsigned="${1:-$(cat)}"
if [ -z "${unsigned// }" ]; then
  echo "admin-tx.sh: no transaction XDR provided (stdin empty and no arg)" >&2
  exit 1
fi

# Soroban contract invocations must be simulated/assembled (footprint + resource
# fee + auth) before signing, or the network rejects them as TxMalformed. Classic
# ops (change-trust, payment) cannot be simulated, so if `tx simulate` fails we
# fall back to the raw envelope. This keeps the script universal for both.
prepared=$(printf '%s' "$unsigned" | stellar tx simulate --source "$ADMIN_KEY" --network "$NETWORK" 2>/dev/null || true)
[ -n "${prepared// }" ] && unsigned="$prepared"

printf '%s' "$unsigned" \
  | stellar tx sign --sign-with-key "$ADMIN_KEY"      --network "$NETWORK" \
  | stellar tx sign --sign-with-key "$ADMIN_COSIGNER" --network "$NETWORK" \
  | stellar tx send --network "$NETWORK"
