import { Networks } from '@stellar/stellar-sdk';
import { config, NETWORK_PASSPHRASE } from './config.js';
import { getSupabaseAdmin } from './db.js';
import { validateWallet } from './portfolio.js';

export class FaucetCooldownError extends Error {
  constructor(nextAvailableAt) {
    super('Faucet cooldown is active for this wallet.');
    this.name = 'FaucetCooldownError';
    this.nextAvailableAt = nextAvailableAt;
  }
}

async function releaseSlot(wallet) {
  await getSupabaseAdmin().rpc('release_faucet_slot', { p_wallet: wallet });
}

/** Fund a Testnet wallet with native XLM through Friendbot, once per cooldown. */
export async function requestFaucet({ wallet, fetchFn = fetch } = {}) {
  validateWallet(wallet);
  if (NETWORK_PASSPHRASE !== Networks.TESTNET) throw new Error('Faucet is available only on Stellar Testnet.');
  const cooldownSeconds = Number(config.FAUCET_COOLDOWN_SECONDS);
  if (!Number.isInteger(cooldownSeconds) || cooldownSeconds < 60) throw new Error('FAUCET_COOLDOWN_SECONDS must be at least 60 seconds.');
  const { data, error } = await getSupabaseAdmin().rpc('claim_faucet_slot', { p_wallet: wallet, p_cooldown_seconds: cooldownSeconds });
  if (error) throw new Error(`Supabase faucet rate-limit query failed: ${error.message}`);
  const slot = Array.isArray(data) ? data[0] : data;
  if (!slot?.allowed) throw new FaucetCooldownError(slot?.next_available_at ?? null);
  try {
    const url = new URL(config.FAUCET_URL);
    url.searchParams.set('addr', wallet);
    const response = await fetchFn(url, { method: 'GET', headers: { accept: 'application/json' } });
    const body = await response.text();
    if (!response.ok) throw new Error(`Friendbot returned HTTP ${response.status}: ${body.slice(0, 240)}`);
    let result;
    try { result = JSON.parse(body); } catch { result = { raw: body }; }
    return { wallet, network: 'testnet', funded: true, provider: url.origin, result };
  } catch (error) {
    await releaseSlot(wallet);
    throw error;
  }
}
