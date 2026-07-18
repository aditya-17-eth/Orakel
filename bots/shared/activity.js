import { config } from './config.js';
import { getSupabaseAdmin } from './db.js';
import { validatePage, validateWallet } from './portfolio.js';

const ACTIVITY_EVENTS = ['buy', 'sell', 'liq_add', 'liq_rem', 'claim', 'claim_lp'];

/**
 * Read indexed wallet activity. The indexer stores decoded topics as JSONB;
 * filtering there keeps this endpoint server-side and avoids trusting browser
 * supplied event data.
 */
export async function getWalletActivity({ wallet, cursor, limit = 50 } = {}) {
  validateWallet(wallet);
  const page = validatePage({ offset: 0, limit });
  if (cursor !== undefined && (!/^\d+$/.test(String(cursor)) || BigInt(cursor) <= 0n)) {
    throw new Error('cursor must be a positive event id.');
  }
  let query = getSupabaseAdmin()
    .from('contract_events')
    .select('id,ledger,tx_hash,name,topics,data,ledger_closed_at')
    .eq('contract_id', config.CONTRACT_ID)
    .in('name', ACTIVITY_EVENTS)
    .contains('topics', [wallet])
    .order('id', { ascending: false })
    .limit(page.limit + 1);
  if (cursor !== undefined) query = query.lt('id', String(cursor));
  const { data, error } = await query;
  if (error) throw new Error(`Supabase activity query failed: ${error.message}`);
  const rows = data ?? [];
  const hasMore = rows.length > page.limit;
  const events = rows.slice(0, page.limit).map((event) => ({
    id: String(event.id),
    ledger: event.ledger,
    txHash: event.tx_hash,
    name: event.name,
    topics: event.topics,
    data: event.data,
    ledgerClosedAt: event.ledger_closed_at,
  }));
  return { wallet, events, nextCursor: hasMore ? events.at(-1)?.id ?? null : null, hasMore };
}
