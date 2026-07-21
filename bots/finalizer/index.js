// Finalizer bot: finalizes undisputed proposals once their dispute window closes.
//
// One job, its own key (FINALIZER_SECRET), a 60s loop, a 10-minute Telegram
// heartbeat, Telegram on every finalize and every error. `finalize` is
// permissionless and needs only XLM for fees (no bond).
//
// A market is finalizable when state == Proposed and
// proposal_time + dispute_window < now. Because our client clock and the
// scan are a step behind the chain, two contract errors are expected and
// handled specifically (codes confirmed in the contract's Error enum):
//   #13 NothingProposed   -> already finalized/disputed by someone else since
//                            our read; the goal is met -> treat as DONE, drop it.
//   #14 DisputeWindowOpen  -> the window has not actually elapsed on-chain
//                            (race / clock skew) -> TRANSIENT, retry next loop.
// Any other failure is reported to Telegram; the loop always keeps running.

import { simulate, invoke, InvokeError, sendTelegram, loadKeypair } from '../shared/index.js';
import { u64 } from '../shared/scval.js';
import { CONTRACT_ID } from '../shared/config.js';

const LOOP_MS = 60_000;
const HEARTBEAT_MS = 10 * 60_000;
const MARKET_STATE_PROPOSED = 1;

const ERR_NOTHING_PROPOSED = 13; // already finalized/disputed -> done
const ERR_DISPUTE_WINDOW_OPEN = 14; // window still open -> transient retry

let finalizer;
let lastHeartbeat = 0;

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

/** Is this market a Proposed market whose dispute window has closed? */
function isFinalizable(m) {
  return m.state === MARKET_STATE_PROPOSED
    && nowSeconds() >= Number(m.proposal_time) + Number(m.dispute_window);
}

async function finalizeMarket(id) {
  try {
    const { hash } = await invoke(CONTRACT_ID, 'finalize', [u64(id)], { signer: finalizer });
    await sendTelegram(`✅ finalizer finalized market ${id}\ntx: ${hash}`);
  } catch (err) {
    if (err instanceof InvokeError && err.code === ERR_NOTHING_PROPOSED) {
      // Someone finalized/disputed it between our read and submit — job already done.
      await sendTelegram(`ℹ️ finalizer: market ${id} already resolved/disputed (#13) — nothing to do`);
      return;
    }
    if (err instanceof InvokeError && err.code === ERR_DISPUTE_WINDOW_OPEN) {
      // Window not actually closed on-chain yet — retry on a later loop, no alarm.
      console.warn(`[finalizer] market ${id}: dispute window still open (#14), will retry`);
      return;
    }
    const code = err instanceof InvokeError ? err.code : null;
    await sendTelegram(`❌ finalizer error on market ${id}: ${err?.message ?? err}${code != null ? ` (contract #${code})` : ''}`);
  }
}

async function runPass() {
  let proposed = 0;
  const count = Number(await simulate(CONTRACT_ID, 'market_count', []));
  for (let id = 0; id < count; id++) {
    let m;
    try {
      m = await simulate(CONTRACT_ID, 'get_market', [u64(id)]);
    } catch (err) {
      await sendTelegram(`❌ finalizer read failed for market ${id}: ${err?.message ?? err}`);
      continue;
    }
    if (m.state === MARKET_STATE_PROPOSED) proposed++;
    if (isFinalizable(m)) await finalizeMarket(id);
  }

  if (Date.now() - lastHeartbeat >= HEARTBEAT_MS) {
    lastHeartbeat = Date.now();
    await sendTelegram(`💓 finalizer alive, ${proposed} proposed market(s) pending`);
  }
}

async function loop() {
  try {
    await runPass();
  } catch (err) {
    // Never let a pass-level failure kill the loop.
    await sendTelegram(`❌ finalizer pass failed: ${err?.message ?? err}`);
  } finally {
    setTimeout(loop, LOOP_MS);
  }
}

async function main() {
  finalizer = loadKeypair('FINALIZER_SECRET');
  lastHeartbeat = Date.now();
  await sendTelegram(`🚀 finalizer started as ${finalizer.publicKey()}`);
  await loop();
}

main().catch((err) => {
  console.error('[finalizer] fatal:', err);
  process.exitCode = 1;
});
