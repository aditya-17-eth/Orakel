import { runIndexer } from '../indexer.js';

const once = process.argv.includes('--once');

runIndexer({ once })
  .then((result) => {
    if (once) console.info(`[indexer] Backfill complete: ${result.eventsIndexed} event(s) indexed through ledger ${result.latestLedger}.`);
  })
  .catch((error) => { console.error(`[indexer] ${error.message}`); process.exitCode = 1; });
