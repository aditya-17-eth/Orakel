import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';

let client;
export function getSupabaseAdmin() {
  if (!config.SUPABASE_URL || !config.SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  if (!client) client = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  return client;
}

export async function ensureSchema() {
  let response;
  try {
    response = await getSupabaseAdmin().from('contract_events').select('id').limit(1);
  } catch (error) {
    throw new Error(`Cannot reach Supabase at ${config.SUPABASE_URL}: ${error.message}`);
  }
  const { error } = response;
  if (error && /fetch failed|network|enotfound/i.test(error.message ?? '')) {
    throw new Error(`Cannot reach Supabase at ${config.SUPABASE_URL}: ${error.message}`);
  }
  if (error) throw new Error(`Supabase schema is not ready: ${error.message}. Run supabase/migrations/001_contract_events.sql in the Supabase SQL Editor.`);
}

function jsonValue(value) { return JSON.parse(JSON.stringify(value, (_, item) => typeof item === 'bigint' ? item.toString() : item)); }
export async function insertEvents(events, contractId) {
  if (!events.length) return;
  const rows = events.map((event) => ({ contract_id: contractId, event_id: event.pagingToken ?? event.id, ledger: event.ledger, tx_hash: event.txHash ?? null, name: event.name ?? 'unknown', topics: jsonValue(event.topics ?? []), data: event.data === undefined ? null : jsonValue(event.data), ledger_closed_at: event.ledgerClosedAt ?? null }));
  const { error } = await getSupabaseAdmin().from('contract_events').upsert(rows, { onConflict: 'contract_id,event_id', ignoreDuplicates: true });
  if (error) throw new Error(`Supabase event insert failed: ${error.message}`);
}
