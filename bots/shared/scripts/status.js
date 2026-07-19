import { CONTRACT_ID, server, validateIndexerConfig } from '../config.js';
import { ensureSchema } from '../db.js';

try {
  validateIndexerConfig();
  await ensureSchema();
  const latestLedger = await server.getLatestLedger();
  console.log(JSON.stringify({ status: 'ok', contractId: CONTRACT_ID, latestLedger }, null, 2));
} catch (error) {
  console.error(`[status] ${error.message}`);
  process.exitCode = 1;
}
