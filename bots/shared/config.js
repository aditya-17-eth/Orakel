import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { Keypair, rpc, Networks } from '@stellar/stellar-sdk';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.env') });

export const RPC_URL = process.env.RPC_URL ?? 'https://soroban-testnet.stellar.org';
export const NETWORK_PASSPHRASE = process.env.NETWORK_PASSPHRASE ?? Networks.TESTNET;
export const CONTRACT_ID = process.env.CONTRACT_ID ?? '';
export const USDC_SAC = process.env.USDC_SAC ?? '';
export const REFLECTOR_CONTRACT = process.env.REFLECTOR_CONTRACT ?? '';
export const PINATA_JWT = process.env.PINATA_JWT ?? '';
export const KEEPER_SECRET = process.env.KEEPER_SECRET ?? '';
export const LIE_MODE = (process.env.LIE_MODE ?? 'false').toLowerCase() === 'true';
export const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY ?? '';
export const WATCHER_DIVERGENCE_BPS = Number(process.env.WATCHER_DIVERGENCE_BPS ?? '300');
export const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
export const INDEXER_START_LEDGER = process.env.INDEXER_START_LEDGER ?? '1';
export const INDEXER_CHECKPOINT_PATH = process.env.INDEXER_CHECKPOINT_PATH ?? '.orakel-indexer-checkpoint.json';
export const INDEXER_POLL_MS = process.env.INDEXER_POLL_MS ?? '5000';
export const FAUCET_URL = process.env.FAUCET_URL ?? 'https://friendbot.stellar.org';
export const FAUCET_COOLDOWN_SECONDS = process.env.FAUCET_COOLDOWN_SECONDS ?? '86400';
export const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';
export const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID ?? '';
export const server = new rpc.Server(RPC_URL);

export const config = { RPC_URL, NETWORK_PASSPHRASE, CONTRACT_ID, USDC_SAC, REFLECTOR_CONTRACT, PINATA_JWT, KEEPER_SECRET, LIE_MODE, COINGECKO_API_KEY, WATCHER_DIVERGENCE_BPS, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, INDEXER_START_LEDGER, INDEXER_CHECKPOINT_PATH, INDEXER_POLL_MS, FAUCET_URL, FAUCET_COOLDOWN_SECONDS, server };

export function validateIndexerConfig() {
  const missing = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].filter((name) => !process.env[name]);
  if (missing.length) throw new Error(`${missing.join(' and ')} ${missing.length === 1 ? 'is' : 'are'} required to run the indexer.`);
  if (!/^C[A-Z2-7]{55}$/.test(CONTRACT_ID)) throw new Error('CONTRACT_ID must be a Stellar contract ID beginning with C.');
  try {
    const url = new URL(SUPABASE_URL);
    if (url.protocol !== 'https:') throw new Error('not HTTPS');
  } catch {
    throw new Error('SUPABASE_URL must be a valid HTTPS URL.');
  }
  if (!Number.isInteger(Number(INDEXER_POLL_MS)) || Number(INDEXER_POLL_MS) < 1000) {
    throw new Error('INDEXER_POLL_MS must be an integer of at least 1000 milliseconds.');
  }
}

export function loadKeypair(envName = 'KEEPER_SECRET') {
  const secret = process.env[envName];
  if (!secret) throw new Error(`${envName} is not configured.`);
  return Keypair.fromSecret(secret);
}
