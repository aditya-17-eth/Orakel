// CoinGecko historical price — an INDEPENDENT oracle-failure detector.
//
// This is ALERT-ONLY. Reflector is the source committed on-chain in each
// market's criteria_ref, so it alone drives dispute decisions. CoinGecko is a
// second opinion: if it diverges materially from Reflector, a human is paged
// (the on-chain oracle may be misreporting), but the watcher never disputes on
// CoinGecko. Best-effort — every failure path returns null, never throws.

import { COINGECKO_API_KEY } from '../shared/config.js';

const BASE = 'https://api.coingecko.com/api/v3';

// Reflector `Other(SYMBOL)` -> CoinGecko coin id. Stablecoins are intentionally
// absent (a ~$1 peg is not a useful cross-check); unmapped assets skip the check.
export const SYMBOL_TO_ID = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  XRP: 'ripple',
  ADA: 'cardano',
  AVAX: 'avalanche-2',
  DOT: 'polkadot',
  LINK: 'chainlink',
  ATOM: 'cosmos',
  UNI: 'uniswap',
  MATIC: 'matic-network',
  XLM: 'stellar',
};

/**
 * From CoinGecko `prices` ([ms, usd] pairs), pick the price whose timestamp is
 * nearest `targetMs`. Returns { usd, atMs } or null if there are no points.
 * Pure — unit-testable.
 */
export function nearestPrice(prices, targetMs) {
  if (!Array.isArray(prices) || prices.length === 0) return null;
  let best = null;
  let bestDelta = Infinity;
  for (const [ms, usd] of prices) {
    const delta = Math.abs(ms - targetMs);
    if (delta < bestDelta) { bestDelta = delta; best = { usd, atMs: ms }; }
  }
  return best;
}

/**
 * Historical USD price for `symbol` at `unixSeconds` (a fixed past boundary).
 * Uses a ±30min window so at least one sample lands even at hourly granularity,
 * then picks the nearest point.
 *
 * @returns {Promise<{usd:number, atMs:number} | {unsupported:true} | null>}
 *   a price, {unsupported:true} for assets we don't map, or null on no-data/error.
 */
export async function historicalUsd(symbol, unixSeconds) {
  const id = SYMBOL_TO_ID[symbol];
  if (!id) return { unsupported: true };

  const ts = Number(unixSeconds);
  const from = ts - 1800;
  const to = ts + 1800;
  const url = `${BASE}/coins/${id}/market_chart/range?vs_currency=usd&from=${from}&to=${to}`;
  const headers = COINGECKO_API_KEY ? { 'x-cg-demo-api-key': COINGECKO_API_KEY } : {};

  try {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      console.warn(`[coingecko] ${id} ${res.status} — cross-check skipped`);
      return null;
    }
    const data = await res.json();
    const point = nearestPrice(data?.prices, ts * 1000);
    return point; // {usd, atMs} or null
  } catch (err) {
    console.warn(`[coingecko] ${id} error: ${err?.message ?? err} — cross-check skipped`);
    return null;
  }
}
