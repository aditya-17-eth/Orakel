// Watcher bot: the H-3 mitigation. Independently re-derives every proposed
// outcome and disputes wrong ones inside the dispute window, staking a bond
// equal to the proposer's. Without it, disputes are hope-based.
//
// One job, its own key (WATCHER_SECRET), a 30s loop, a 10-min Telegram
// heartbeat, alert dedup. The re-derivation uses the SAME shared Reflector read
// + parse the keeper uses (bots/shared/{reflector,parse}.js), sampling the
// market's resolve_time floored to the 300s grid — so an honest proposal yields
// the identical outcome and can NEVER trigger a false dispute.
//
// CoinGecko is a second, independent opinion used ONLY to page a human on oracle
// divergence; it never drives a dispute (Reflector is the on-chain source in
// criteria_ref). The watcher disputes only on a confident Reflector reading;
// no reading -> alert and skip. It never disputes the same market twice.

import {
  simulate, invoke, InvokeError, sendTelegram, loadKeypair,
  getDecimals, getSupportedAssets, priceAt, roundToBoundary, parseMarket, Outcome,
} from '../shared/index.js';
import { u64, addr } from '../shared/scval.js';
import { CONTRACT_ID, WATCHER_DIVERGENCE_BPS } from '../shared/config.js';
import { historicalUsd } from './coingecko.js';

const LOOP_MS = 30_000;
const HEARTBEAT_MS = 10 * 60_000;
const MARKET_STATE_PROPOSED = 1;

const ERR_NOTHING_PROPOSED = 13;   // already disputed/finalized -> dispute moot
const ERR_DISPUTE_WINDOW_CLOSED = 15; // window closed -> dispute moot

const OUTCOME_NAME = { [Outcome.YES]: 'YES', [Outcome.NO]: 'NO', [Outcome.VOID]: 'VOID' };
const CMP_TEXT = { gte: '>=', gt: '>', lte: '<=', lt: '<' };

let watcher;
let supportedAssets = new Set();
let lastHeartbeat = 0;

// Per-market alert dedup (alert once per distinct reason; heartbeat proves liveness).
const lastAlertReason = new Map();
// Markets already disputed this process (belt-and-braces with the on-chain state check).
const disputed = new Set();
// Memo of the immutable past-timestamp oracle reads, per market. Positive results
// only — a null (retention gap / CoinGecko hiccup) is left uncached so it retries.
const memo = new Map(); // id -> { reflector?, coingecko? }

async function alertOnce(id, reasonKey, message) {
  if (lastAlertReason.get(id) === reasonKey) return;
  lastAlertReason.set(id, reasonKey);
  await sendTelegram(message);
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

/** @returns {boolean} whether this market counted as an in-window proposal. */
async function processMarket(id, m) {
  if (m.state !== MARKET_STATE_PROPOSED) return false;
  const windowClose = Number(m.proposal_time) + Number(m.dispute_window);
  if (nowSeconds() >= windowClose) return false;   // window closed — can't dispute
  if (disputed.has(id)) return true;               // never dispute twice

  const parsed = parseMarket(m);
  if (!parsed.confident) {
    await alertOnce(id, 'unparseable', `⚠️ watcher: cannot re-derive market ${id} — ${parsed.reason}`);
    return true;
  }
  if (!supportedAssets.has(parsed.asset)) {
    await alertOnce(id, `unsupported:${parsed.asset}`, `⚠️ watcher: cannot re-derive market ${id} — asset ${parsed.asset} not tracked by Reflector`);
    return true;
  }

  const resolveTs = Number(m.resolve_time);
  const cache = memo.get(id) ?? {};

  // Reflector read (memoized; drives the dispute decision).
  let priceData = cache.reflector;
  if (!priceData) {
    priceData = await priceAt(parsed.asset, resolveTs);
    if (priceData) { cache.reflector = priceData; memo.set(id, cache); }
  }
  if (!priceData) {
    await alertOnce(id, 'noprice', `⚠️ watcher: no Reflector price for ${parsed.asset} at ${roundToBoundary(resolveTs)} — cannot re-derive market ${id}, skipping (no dispute without a confident reading)`);
    return true;
  }
  const decimals = priceData.decimals;
  const reflectorUsd = Number(priceData.price) / 10 ** decimals;

  // CoinGecko cross-check (memoized; ALERT-ONLY, never disputes).
  let cg = cache.coingecko;
  if (cg === undefined) {
    cg = await historicalUsd(parsed.asset, resolveTs);
    if (cg && (cg.unsupported || typeof cg.usd === 'number')) { cache.coingecko = cg; memo.set(id, cache); }
  }
  if (cg && typeof cg.usd === 'number') {
    const divBps = Math.abs(cg.usd - reflectorUsd) / reflectorUsd * 10_000;
    if (divBps >= WATCHER_DIVERGENCE_BPS) {
      await alertOnce(id, `divergence:${Math.round(divBps / 100)}`,
        `🚨 watcher: ORACLE DIVERGENCE on market ${id} (${parsed.asset}) — Reflector $${reflectorUsd.toFixed(2)} vs CoinGecko $${cg.usd.toFixed(2)} (${(divBps / 100).toFixed(2)}% ≥ ${(WATCHER_DIVERGENCE_BPS / 100).toFixed(2)}%). Human check needed — NOT auto-disputed.`);
    }
  }

  // Decision — Reflector only.
  const myOutcome = parsed.decide(priceData.price, decimals);
  const proposed = Number(m.proposed_outcome);
  if (myOutcome === proposed) return true; // honest proposal — stay silent

  // Mismatch -> dispute (posts a bond equal to the proposer's).
  try {
    const { hash } = await invoke(CONTRACT_ID, 'dispute', [u64(id), addr(watcher.publicKey())], { signer: watcher });
    disputed.add(id);
    await sendTelegram(
      `🚨🚨 WATCHER DISPUTE — market ${id}\n` +
      `Q: ${m.question}\n` +
      `proposed: ${OUTCOME_NAME[proposed] ?? proposed}  |  re-derived: ${OUTCOME_NAME[myOutcome]}\n` +
      `${parsed.asset}/USD Reflector $${reflectorUsd.toFixed(2)} ${CMP_TEXT[parsed.comparator]} threshold $${parsed.thresholdUsd}\n` +
      `CoinGecko $${cg && typeof cg.usd === 'number' ? cg.usd.toFixed(2) : 'n/a'}\n` +
      `bond posted, escalated to arbiter. tx: ${hash}`,
    );
  } catch (err) {
    const code = err instanceof InvokeError ? err.code : null;
    if (code === ERR_NOTHING_PROPOSED || code === ERR_DISPUTE_WINDOW_CLOSED) {
      disputed.add(id); // someone else resolved/disputed it, or the window just closed
      await alertOnce(id, `dispute-moot:${code}`, `ℹ️ watcher: market ${id} dispute no longer applicable (contract #${code})`);
      return true;
    }
    await alertOnce(id, `error:${code ?? err?.message ?? err}`, `❌ watcher error disputing market ${id}: ${err?.message ?? err}${code != null ? ` (contract #${code})` : ''}`);
  }
  return true;
}

async function runPass() {
  let inWindow = 0;
  const count = Number(await simulate(CONTRACT_ID, 'market_count', []));
  for (let id = 0; id < count; id++) {
    let m;
    try {
      m = await simulate(CONTRACT_ID, 'get_market', [u64(id)]);
    } catch (err) {
      await alertOnce(id, `read-error`, `❌ watcher read failed for market ${id}: ${err?.message ?? err}`);
      continue;
    }
    try {
      if (await processMarket(id, m)) inWindow++;
    } catch (err) {
      await alertOnce(id, `error:${err?.message ?? err}`, `❌ watcher error on market ${id}: ${err?.message ?? err}`);
    }
  }

  if (Date.now() - lastHeartbeat >= HEARTBEAT_MS) {
    lastHeartbeat = Date.now();
    await sendTelegram(`💓 watcher alive, ${inWindow} proposal(s) in dispute window`);
  }
}

async function loop() {
  try {
    await runPass();
  } catch (err) {
    await sendTelegram(`❌ watcher pass failed: ${err?.message ?? err}`);
  } finally {
    setTimeout(loop, LOOP_MS);
  }
}

async function main() {
  watcher = loadKeypair('WATCHER_SECRET');
  const decimals = await getDecimals();
  supportedAssets = await getSupportedAssets();
  lastHeartbeat = Date.now();
  await sendTelegram(
    `🛡️ watcher started as ${watcher.publicKey()}\n` +
    `oracle decimals=${decimals}, ${supportedAssets.size} assets tracked, divergence alert ≥ ${(WATCHER_DIVERGENCE_BPS / 100).toFixed(2)}%`,
  );
  await loop();
}

main().catch((err) => {
  console.error('[watcher] fatal:', err);
  process.exitCode = 1;
});
