// Keeper bot: proposes outcomes for Open crypto_price markets past resolve_time.
//
// One job, its own key (KEEPER_SECRET), a 60s loop, a 10-minute Telegram
// heartbeat, and Telegram on every action and every error. It never proposes
// twice (only Open markets qualify) and never proposes on uncertainty (an
// unparseable question, an untracked asset, or a missing oracle sample all
// alert-and-skip). LIE_MODE inverts the outcome for the adversarial test.
//
// Decision reading: the Reflector price is sampled AT the market's resolve_time
// floored to the oracle's 5-minute grid — not lastprice — so the keeper and the
// watcher derive identical readings. The full derivation is pinned to IPFS as
// an evidence bundle before the proposal is submitted.

import { simulate, invoke, InvokeError, sendTelegram, loadKeypair, formatCriteriaLink } from '../shared/index.js';
import { u64, u32, addr } from '../shared/scval.js';
import { CONTRACT_ID, LIE_MODE } from '../shared/config.js';
import { getDecimals, getSupportedAssets, priceAt, roundToBoundary } from './reflector.js';
import { parseMarket, invertOutcome, Outcome } from './parse.js';
import { pinEvidence } from './pinata.js';

const LOOP_MS = 60_000;
const HEARTBEAT_MS = 10 * 60_000;
const MARKET_STATE_OPEN = 0;

const OUTCOME_NAME = { [Outcome.YES]: 'YES', [Outcome.NO]: 'NO', [Outcome.VOID]: 'VOID' };
const CMP_TEXT = { gte: '>=', gt: '>', lte: '<=', lt: '<' };

let keeper;
let supportedAssets = new Set();
let lastHeartbeat = 0;

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

/** Format a raw oracle integer as a human USD string (display only). */
function rawToUsd(raw, decimals) {
  const s = BigInt(raw).toString().padStart(decimals + 1, '0');
  const intPart = s.slice(0, s.length - decimals);
  const fracPart = s.slice(s.length - decimals).replace(/0+$/, '');
  return fracPart ? `${intPart}.${fracPart}` : intPart;
}

async function processMarket(id) {
  const m = await simulate(CONTRACT_ID, 'get_market', [u64(id)]);
  if (m.state !== MARKET_STATE_OPEN) return false;        // not Open -> never propose twice
  if (m.category !== 'crypto_price') return false;
  if (nowSeconds() < Number(m.resolve_time)) return false; // too early
  // This market is watched + eligible; from here every path notifies Telegram.

  const parsed = parseMarket(m);
  if (!parsed.confident) {
    await sendTelegram(`⚠️ keeper: skipping market ${id} — ${parsed.reason}`);
    return true;
  }
  if (!supportedAssets.has(parsed.asset)) {
    await sendTelegram(`⚠️ keeper: skipping market ${id} — asset ${parsed.asset} not tracked by Reflector`);
    return true;
  }

  const resolveTs = Number(m.resolve_time);
  const priceData = await priceAt(parsed.asset, resolveTs);
  if (!priceData) {
    await sendTelegram(`⚠️ keeper: skipping market ${id} — no Reflector price for ${parsed.asset} at ${roundToBoundary(resolveTs)}`);
    return true;
  }

  let outcome = parsed.decide(priceData.price, priceData.decimals);
  if (LIE_MODE) outcome = invertOutcome(outcome);

  const evidence = {
    market_id: id,
    question: m.question,
    category: m.category,
    criteria_ref: m.criteria_ref,
    asset: parsed.asset,
    comparator: parsed.comparator,
    threshold_usd: parsed.thresholdUsd,
    resolve_time: resolveTs,
    queried_timestamp: priceData.queriedTimestamp,
    sampled_timestamp: priceData.sampledTimestamp,
    reflector_price_raw: priceData.price.toString(),
    reflector_decimals: priceData.decimals,
    reflector_price_usd: rawToUsd(priceData.price, priceData.decimals),
    decision: OUTCOME_NAME[outcome],
    lie_mode: LIE_MODE,
    decided_at: new Date().toISOString(),
  };

  const cid = await pinEvidence(evidence, `orakel-market-${id}-proposal`);
  const { hash } = await invoke(CONTRACT_ID, 'propose', [u64(id), addr(keeper.publicKey()), u32(outcome)], { signer: keeper });

  await sendTelegram(
    `✅ keeper proposed market ${id}: ${OUTCOME_NAME[outcome]}${LIE_MODE ? ' (LIE_MODE)' : ''}\n` +
    `${parsed.asset}/USD ${rawToUsd(priceData.price, priceData.decimals)} ${CMP_TEXT[parsed.comparator]} $${parsed.thresholdUsd}\n` +
    `evidence: ${formatCriteriaLink(cid)}\ntx: ${hash}`,
  );
  return true;
}

async function runPass() {
  let watched = 0;
  const count = Number(await simulate(CONTRACT_ID, 'market_count', []));
  for (let id = 0; id < count; id++) {
    try {
      if (await processMarket(id)) watched++;
    } catch (err) {
      const code = err instanceof InvokeError ? err.code : null;
      await sendTelegram(`❌ keeper error on market ${id}: ${err?.message ?? err}${code != null ? ` (contract #${code})` : ''}`);
    }
  }

  if (Date.now() - lastHeartbeat >= HEARTBEAT_MS) {
    lastHeartbeat = Date.now();
    await sendTelegram(`💓 keeper alive, ${watched} crypto_price market(s) watched`);
  }
}

async function loop() {
  try {
    await runPass();
  } catch (err) {
    // Never let a pass-level failure kill the loop.
    await sendTelegram(`❌ keeper pass failed: ${err?.message ?? err}`);
  } finally {
    setTimeout(loop, LOOP_MS);
  }
}

async function main() {
  keeper = loadKeypair('KEEPER_SECRET');
  const decimals = await getDecimals();
  supportedAssets = await getSupportedAssets();
  lastHeartbeat = Date.now();
  await sendTelegram(
    `🚀 keeper started as ${keeper.publicKey()}\n` +
    `oracle decimals=${decimals}, ${supportedAssets.size} assets tracked, LIE_MODE=${LIE_MODE}`,
  );
  await loop();
}

main().catch((err) => {
  console.error('[keeper] fatal:', err);
  process.exitCode = 1;
});
