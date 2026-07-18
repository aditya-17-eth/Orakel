// ScVal <-> native helpers for building contract arguments and decoding results.
//
// The Orakel contract speaks Address, i128 (7-decimal collateral/shares),
// Symbol, and String. `nativeToScVal` needs an explicit type hint for i128 and
// Address (a bare JS string is ambiguous), so we wrap the common cases here and
// keep the call sites readable. This file is PURE (no env, no network) so it is
// unit-testable in isolation.
//
// IMPORTANT: 7-decimal amount discipline lives in the CALLER. `i128()` takes an
// integer number of stroops (e.g. 1_000 USDC == 10_000_000_000n), never a
// human-decimal amount — mirror the CLAUDE.md "decimals slip" warning.

import { Address, nativeToScVal, scValToNative, xdr } from '@stellar/stellar-sdk';

/** Address ScVal from a G... (account) or C... (contract) address string. */
export function addr(g) {
  return new Address(g).toScVal();
}

/**
 * i128 ScVal from an integer amount of stroops. Accepts bigint, number, or a
 * numeric string. Rejects non-integers so a fractional amount can never be
 * silently truncated on its way to the contract.
 */
export function i128(intStroops) {
  const v = toBigInt(intStroops);
  return nativeToScVal(v, { type: 'i128' });
}

/** u64 ScVal (used for timestamps / windows, e.g. lock_time, dispute_window). */
export function u64(n) {
  return nativeToScVal(toBigInt(n), { type: 'u64' });
}

/** u32 ScVal (used for bps params, and enum discriminants like Outcome). */
export function u32(n) {
  const v = Number(n);
  if (!Number.isInteger(v) || v < 0 || v > 0xffff_ffff) {
    throw new Error(`Expected a u32 (0..4294967295), got ${n}`);
  }
  // Build the ScVal directly — nativeToScVal(bigint, {type:'u32'}) rejects bigints.
  return xdr.ScVal.scvU32(v);
}

/** Symbol ScVal (short on-chain enum-ish strings, e.g. a category). */
export function sym(s) {
  return nativeToScVal(s, { type: 'symbol' });
}

/** String ScVal (arbitrary text, e.g. the market question or criteria_ref). */
export function str(s) {
  return nativeToScVal(s, { type: 'string' });
}

/** Decode any ScVal into its native JS representation. */
export function toNative(scv) {
  return scValToNative(scv);
}

function toBigInt(n) {
  if (typeof n === 'bigint') return n;
  if (typeof n === 'number') {
    if (!Number.isInteger(n)) {
      throw new Error(`Expected an integer amount of stroops, got ${n}`);
    }
    return BigInt(n);
  }
  if (typeof n === 'string' && /^-?\d+$/.test(n.trim())) {
    return BigInt(n.trim());
  }
  throw new Error(`Cannot convert ${typeof n} "${n}" to an integer`);
}

// Re-export the raw xdr namespace for callers that need to hand-build a value
// (e.g. the indexer decoding an unusual event topic).
export { xdr };
