// Reflector oracle read helpers (testnet contract
// CCYOZJCOPG34LLQQ7N24YXBM7LL62R7ONMZ3G6WZAAYPB5OYKOMJRN63).
//
// Confirmed interface (stellar contract info interface):
//   price(asset: Asset, timestamp: u64) -> Option<PriceData{price:i128, timestamp:u64}>
//   decimals() -> u32           (== 14 on testnet)
//   resolution() -> u32         (== 300, i.e. a 5-minute sampling grid, in seconds)
//   assets() -> Vec<Asset>
//   Asset::Other(Symbol)  encodes as  vec([sym('Other'), sym('BTC')])
//
// We read the price AT a specific timestamp (the market's resolve_time, floored
// to the 300s grid), never lastprice — so the keeper and the watcher, sampling
// the same boundary, derive identical readings.

import { simulate } from '../shared/simulate.js';
import { sym, u64, vec } from '../shared/scval.js';
import { REFLECTOR_CONTRACT } from '../shared/config.js';

export const REFLECTOR_RESOLUTION_SECONDS = 300;

/** Build the Reflector `Asset::Other(SYMBOL)` ScVal, e.g. Other(BTC). */
export function otherAsset(symbol) {
  return vec([sym('Other'), sym(symbol)]);
}

/** Floor a unix-seconds timestamp to Reflector's 5-minute sampling boundary. */
export function roundToBoundary(unixSeconds, resolution = REFLECTOR_RESOLUTION_SECONDS) {
  return Math.floor(Number(unixSeconds) / resolution) * resolution;
}

let cachedDecimals = null;

/** Read (and cache for the process lifetime) the oracle's price decimals (14). */
export async function getDecimals() {
  if (cachedDecimals == null) cachedDecimals = Number(await simulate(REFLECTOR_CONTRACT, 'decimals', []));
  return cachedDecimals;
}

/** The set of asset symbols the oracle currently tracks as `Other(...)`. */
export async function getSupportedAssets() {
  const assets = await simulate(REFLECTOR_CONTRACT, 'assets', []);
  const symbols = new Set();
  for (const a of assets ?? []) {
    // scValToNative decodes Asset::Other(Sym) as ['Other', 'BTC'].
    if (Array.isArray(a) && a[0] === 'Other' && typeof a[1] === 'string') symbols.add(a[1]);
  }
  return symbols;
}

/**
 * Historical price for `symbol` at `unixSeconds`, floored to the sampling grid.
 * Returns { price: bigint, decimals, sampledTimestamp, queriedTimestamp } or
 * null when the oracle has no record for that boundary.
 */
export async function priceAt(symbol, unixSeconds) {
  const queriedTimestamp = roundToBoundary(unixSeconds);
  const decimals = await getDecimals();
  const data = await simulate(REFLECTOR_CONTRACT, 'price', [otherAsset(symbol), u64(queriedTimestamp)]);
  if (data == null) return null; // Option::None
  return {
    price: BigInt(data.price),
    decimals,
    sampledTimestamp: Number(data.timestamp),
    queriedTimestamp,
  };
}
