import { config, CONTRACT_ID } from './config.js';
import { getSupabaseAdmin } from './db.js';
import { simulate } from './simulate.js';
import { u64 } from './scval.js';
import { asBigInt, field, validatePage } from './portfolio.js';

const PINATA_GATEWAY = 'https://gateway.pinata.cloud/ipfs/';
const TIMELINE_EVENTS = ['mkt_new', 'buy', 'sell', 'liq_add', 'liq_rem', 'propose', 'dispute', 'final', 'arb_res', 'claim', 'claim_lp'];

export function formatCriteriaLink(criteriaRef) {
  const value = String(criteriaRef ?? '').trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  const cid = value.replace(/^ipfs:\/\//i, '').replace(/^\/+/, '').split('/').filter(Boolean).pop();
  return cid ? `${PINATA_GATEWAY}${encodeURIComponent(cid)}` : null;
}

function validateMarketId(marketId) {
  const id = typeof marketId === 'string' && /^\d+$/.test(marketId) ? Number(marketId) : marketId;
  if (!Number.isSafeInteger(id) || id < 0) throw new Error('marketId must be a non-negative safe integer.');
  return id;
}

/** Return on-chain market metadata plus an auditable indexed lifecycle feed. */
export async function getResolutionTimeline({ marketId, cursor, limit = 100, simulateFn = simulate, contractId = CONTRACT_ID } = {}) {
  const id = validateMarketId(marketId);
  validatePage({ offset: 0, limit });
  if (cursor !== undefined && (!/^\d+$/.test(String(cursor)) || BigInt(cursor) <= 0n)) throw new Error('cursor must be a positive event id.');
  const market = await simulateFn(contractId, 'get_market', [u64(id)]);
  let query = getSupabaseAdmin()
    .from('contract_events')
    .select('id,ledger,tx_hash,name,topics,data,ledger_closed_at')
    .eq('contract_id', config.CONTRACT_ID)
    .in('name', TIMELINE_EVENTS)
    .contains('topics', [String(id)])
    .order('id', { ascending: true })
    .limit(limit + 1);
  if (cursor !== undefined) query = query.gt('id', String(cursor));
  const { data, error } = await query;
  if (error) throw new Error(`Supabase timeline query failed: ${error.message}`);
  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const events = rows.slice(0, limit).map((event) => ({
    id: String(event.id), ledger: event.ledger, txHash: event.tx_hash, name: event.name,
    topics: event.topics, data: event.data, ledgerClosedAt: event.ledger_closed_at,
  }));
  return {
    marketId: String(id),
    question: String(field(market, 'question') ?? ''),
    category: String(field(market, 'category') ?? ''),
    criteriaRef: String(field(market, 'criteria_ref', 'criteriaRef') ?? ''),
    criteriaUrl: formatCriteriaLink(field(market, 'criteria_ref', 'criteriaRef')),
    state: Number(asBigInt(field(market, 'state'))),
    outcome: field(market, 'outcome') === undefined || field(market, 'outcome') === null ? null : Number(asBigInt(field(market, 'outcome'))),
    events,
    nextCursor: hasMore ? events.at(-1)?.id ?? null : null,
    hasMore,
  };
}

export { validateMarketId };
