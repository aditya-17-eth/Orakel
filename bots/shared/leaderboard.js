import { config } from './config.js';
import { getSupabaseAdmin } from './db.js';

const MAX_LIMIT = 100;

export async function getLeaderboard({ limit = 50 } = {}) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) throw new Error(`limit must be between 1 and ${MAX_LIMIT}.`);
  const { data, error } = await getSupabaseAdmin().rpc('get_trading_leaderboard', {
    p_contract_id: config.CONTRACT_ID,
    p_limit: limit,
  });
  if (error) throw new Error(`Supabase leaderboard query failed: ${error.message}`);
  return {
    metric: 'trading_volume',
    assetDecimals: 7,
    entries: (data ?? []).map((entry) => ({
      rank: Number(entry.rank),
      wallet: entry.wallet,
      volume: String(entry.volume ?? '0'),
      trades: Number(entry.trades ?? 0),
      markets: Number(entry.markets ?? 0),
    })),
  };
}
