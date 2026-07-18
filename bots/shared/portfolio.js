import { Address } from '@stellar/stellar-sdk';
import { CONTRACT_ID, config } from './config.js';
import { simulate } from './simulate.js';
import { addr, u64 } from './scval.js';

const BPS = 10_000n;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export function validateWallet(wallet) {
  if (!/^G[A-Z2-7]{55}$/.test(wallet ?? '')) throw new Error('wallet must be a valid Stellar G-address.');
  // Address construction provides a second SDK-level validation boundary.
  new Address(wallet);
  return wallet;
}

export function validatePage({ offset = 0, limit = DEFAULT_LIMIT } = {}) {
  if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('offset must be a non-negative safe integer.');
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) throw new Error(`limit must be between 1 and ${MAX_LIMIT}.`);
  return { offset, limit };
}

export function calculatePositionMarkValue(yes, no, priceBps, outcome = null) {
  if (outcome === 0) return yes;
  if (outcome === 1) return no;
  if (outcome === 2) return (yes + no) / 2n;
  return (yes * BigInt(priceBps) + no * (BPS - BigInt(priceBps))) / BPS;
}

export function calculateClaimablePosition(yes, no, outcome) {
  if (outcome === 0) return yes;
  if (outcome === 1) return no;
  if (outcome === 2) return (yes + no) / 2n;
  return 0n;
}

function field(value, ...names) {
  if (value instanceof Map) {
    for (const name of names) if (value.has(name)) return value.get(name);
  }
  if (value && typeof value === 'object') {
    for (const name of names) if (name in value) return value[name];
  }
  return undefined;
}

function asBigInt(value, fallback = 0n) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isInteger(value)) return BigInt(value);
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return BigInt(value);
  throw new Error(`Expected an integer contract value, got ${String(value)}`);
}

function asNumber(value, fallback = 0) {
  const result = Number(asBigInt(value, BigInt(fallback)));
  if (!Number.isSafeInteger(result)) throw new Error(`Contract value is outside the safe integer range: ${String(value)}`);
  return result;
}

function asText(value, fallback = '') {
  if (value === undefined || value === null) return fallback;
  return String(value);
}

function serialize(value) {
  return typeof value === 'bigint' ? value.toString() : value;
}

function positive(value) { return value > 0n; }

async function mapLimit(values, concurrency, worker) {
  const output = new Array(values.length);
  let next = 0;
  async function run() {
    while (next < values.length) {
      const index = next++;
      output[index] = await worker(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, run));
  return output;
}

function normalizeMarket(raw) {
  const totalLp = asBigInt(field(raw, 'total_lp_shares', 'totalLpShares'));
  return {
    id: asNumber(field(raw, 'id')),
    question: asText(field(raw, 'question')),
    category: asText(field(raw, 'category')),
    state: asNumber(field(raw, 'state')),
    outcome: field(raw, 'outcome') === undefined || field(raw, 'outcome') === null ? null : asNumber(field(raw, 'outcome')),
    lockTime: asNumber(field(raw, 'lock_time', 'lockTime')),
    resolveTime: asNumber(field(raw, 'resolve_time', 'resolveTime')),
    yesReserve: asBigInt(field(raw, 'yes_reserve', 'yesReserve')),
    noReserve: asBigInt(field(raw, 'no_reserve', 'noReserve')),
    totalLpShares: totalLp,
    lpFeesAccrued: asBigInt(field(raw, 'lp_fees_accrued', 'lpFeesAccrued')),
    poolPayoutTotal: asBigInt(field(raw, 'pool_payout_total', 'poolPayoutTotal')),
  };
}

function normalizePosition(raw) {
  return {
    yes: asBigInt(field(raw, 'yes')),
    no: asBigInt(field(raw, 'no')),
    spent: asBigInt(field(raw, 'spent')),
  };
}

function calculateLpValue(market, lpShares, priceBps) {
  if (!positive(lpShares) || market.totalLpShares <= 0n) return 0n;
  if (market.outcome !== null) return (market.poolPayoutTotal * lpShares) / market.totalLpShares;
  const poolValue = ((market.yesReserve * BigInt(priceBps)) + (market.noReserve * (BPS - BigInt(priceBps)))) / BPS + market.lpFeesAccrued;
  return (poolValue * lpShares) / market.totalLpShares;
}

/**
 * Read the authoritative on-chain portfolio for one wallet.
 * The result is paginated by market id and intentionally excludes zero-value
 * rows, so a public API can return it without exposing contract internals.
 */
export async function getPortfolio({ wallet, offset = 0, limit = DEFAULT_LIMIT, simulateFn = simulate, contractId = CONTRACT_ID } = {}) {
  validateWallet(wallet);
  validatePage({ offset, limit });
  if (!contractId) throw new Error('CONTRACT_ID is not configured.');

  const marketCount = asNumber(await simulateFn(contractId, 'market_count', []));
  const ids = Array.from({ length: Math.max(0, Math.min(limit, marketCount - offset)) }, (_, index) => offset + index);
  const rows = await mapLimit(ids, 5, async (marketId) => {
    const args = [u64(marketId)];
    const [rawMarket, rawPrice, rawPosition, rawLp] = await Promise.all([
      simulateFn(contractId, 'get_market', args),
      simulateFn(contractId, 'yes_price_bps', args),
      simulateFn(contractId, 'get_user_position', [u64(marketId), addr(wallet)]),
      simulateFn(contractId, 'get_user_lp', [u64(marketId), addr(wallet)]),
    ]);
    const market = normalizeMarket(rawMarket);
    const position = normalizePosition(rawPosition);
    const priceBps = asNumber(rawPrice);
    const lpShares = asBigInt(rawLp);
    const markValue = calculatePositionMarkValue(position.yes, position.no, priceBps, market.outcome);
    const lpValue = calculateLpValue(market, lpShares, priceBps);
    const claimablePosition = market.state === 3 ? calculateClaimablePosition(position.yes, position.no, market.outcome) : 0n;
    const claimableLp = market.state === 3 ? lpValue : 0n;
    if (!positive(position.yes) && !positive(position.no) && !positive(lpShares)) return null;
    return {
      marketId: String(market.id),
      question: market.question,
      category: market.category,
      state: market.state,
      outcome: market.outcome,
      lockTime: market.lockTime,
      resolveTime: market.resolveTime,
      yesPriceBps: priceBps,
      yesShares: serialize(position.yes),
      noShares: serialize(position.no),
      spent: serialize(position.spent),
      lpShares: serialize(lpShares),
      markValue: serialize(markValue),
      lpValue: serialize(lpValue),
      claimablePosition: serialize(claimablePosition),
      claimableLp: serialize(claimableLp),
    };
  });
  const positions = rows.filter(Boolean);
  const totals = positions.reduce((sum, row) => ({
    spent: sum.spent + BigInt(row.spent),
    markValue: sum.markValue + BigInt(row.markValue) + BigInt(row.lpValue),
    claimable: sum.claimable + BigInt(row.claimablePosition) + BigInt(row.claimableLp),
  }), { spent: 0n, markValue: 0n, claimable: 0n });
  return {
    wallet,
    marketCount,
    offset,
    limit,
    hasMore: offset + limit < marketCount,
    positions,
    totals: Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, serialize(value)])),
  };
}

export { asBigInt, field };
