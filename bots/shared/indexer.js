import { CONTRACT_ID, config, validateIndexerConfig } from './config.js';
import { createFileCheckpoint, pollEvents } from './events.js';
import { ensureSchema, insertEvents } from './db.js';

export async function runIndexer({ once = false } = {}) {
  validateIndexerConfig();
  await ensureSchema();
  const checkpoint = createFileCheckpoint(config.INDEXER_CHECKPOINT_PATH);
  let cursor = checkpoint.get();
  let startLedger = Number(config.INDEXER_START_LEDGER ?? 1);
  let eventsIndexed = 0;

  while (true) {
    let result;
    try {
      result = await pollEvents({ startLedger, cursor, limit: 100 });
    } catch (error) {
      const earliestLedger = !cursor && /startLedger must be within the ledger range:\s*(\d+)\s*-\s*\d+/.exec(error.message)?.[1];
      if (!earliestLedger) throw error;
      // Keep clear of the moving retention boundary. Testnet can advance while
      // the retry is in flight, making its exact earliest ledger immediately
      // invalid again.
      startLedger = Number(earliestLedger) + 100;
      console.warn(`[indexer] Requested start ledger is no longer retained; starting safely at ${startLedger}.`);
      continue;
    }
    if (result.events.length) {
      await insertEvents(result.events, CONTRACT_ID);
      eventsIndexed += result.events.length;
      console.info(`[indexer] Indexed ${result.events.length} event(s).`);
    }
    const nextCursor = result.events.at(-1)?.pagingToken ?? result.cursor;

    if (result.events.length && nextCursor && nextCursor !== cursor) {
      cursor = nextCursor;
      checkpoint.set(cursor);
      continue;
    }

    if (once) return { cursor, latestLedger: result.latestLedger, eventsIndexed };

    // With no matching events there is no cursor to persist. Move the next
    // request close to the chain tip rather than repeatedly scanning history.
    if (!cursor && Number.isFinite(Number(result.latestLedger))) {
      startLedger = Number(result.latestLedger);
    }
    await new Promise((resolve) => setTimeout(resolve, Number(config.INDEXER_POLL_MS ?? 5000)));
  }
}
