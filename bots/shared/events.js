import fs from 'node:fs';
import { scValToNative } from '@stellar/stellar-sdk';
import { CONTRACT_ID, server } from './config.js';

export function decodeEvent(raw) {
  const topics = (raw.topic ?? []).map((topic) => scValToNative(topic));
  const data = raw.value === undefined ? undefined : scValToNative(raw.value);
  return { ledger: Number(raw.ledger), ledgerClosedAt: raw.ledgerClosedAt, txHash: raw.txHash, id: raw.id, contractId: raw.contractId, topics, name: topics[0], data, pagingToken: raw.pagingToken ?? raw.id };
}

export async function pollEvents({ startLedger, cursor, limit = 100 } = {}) {
  const result = await server.getEvents({
    ...(cursor ? { cursor } : { startLedger }),
    filters: [{ type: 'contract', contractIds: [CONTRACT_ID] }],
    limit,
  });
  const events = (result.events ?? []).map(decodeEvent);
  return { events, latestLedger: result.latestLedger, cursor: result.cursor };
}

export function createFileCheckpoint(filePath) {
  return {
    get() {
      try {
        const checkpoint = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return checkpoint.cursor ?? checkpoint.ledger ?? null;
      } catch { return null; }
    },
    set(cursor) { fs.writeFileSync(filePath, JSON.stringify({ cursor }), { mode: 0o600 }); },
  };
}
