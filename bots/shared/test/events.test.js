// Unit tests for events.js decode + checkpoint. Sets dummy env BEFORE importing
// the module, because events.js -> config.js validates RPC_URL / CONTRACT_ID at
// load time (constructing rpc.Server makes no network call).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import { Keypair } from '@stellar/stellar-sdk';

process.env.RPC_URL ??= 'https://soroban-testnet.stellar.org';
process.env.CONTRACT_ID ??= 'CTESTCONTRACTIDPLACEHOLDER000000000000000000000000000000';

const { decodeEvent, createFileCheckpoint } = await import('../events.js');
const { sym, i128, addr } = await import('../scval.js');

test('decodeEvent normalizes name/topics/data', () => {
  const trader = Keypair.random().publicKey();
  const raw = {
    ledger: 12345,
    ledgerClosedAt: '2026-07-08T00:00:00Z',
    txHash: 'deadbeef',
    id: '0000000123-0000000001',
    contractId: 'CABC',
    topic: [sym('buy'), addr(trader)],
    value: i128(5_000_000n),
    pagingToken: 'pt-1',
  };
  const ev = decodeEvent(raw);
  assert.equal(ev.name, 'buy');
  assert.equal(ev.ledger, 12345);
  assert.equal(ev.txHash, 'deadbeef');
  assert.equal(ev.topics[1], trader);
  assert.equal(ev.data, 5_000_000n);
  assert.equal(ev.pagingToken, 'pt-1');
});

test('decodeEvent falls back to id when pagingToken is absent', () => {
  const ev = decodeEvent({ ledger: 1, id: 'the-id', topic: [sym('final')], value: sym('Yes') });
  assert.equal(ev.pagingToken, 'the-id');
  assert.equal(ev.name, 'final');
  assert.equal(ev.data, 'Yes');
});

test('createFileCheckpoint get/set round-trips and returns null when absent', () => {
  const path = join(tmpdir(), `orakel-ckpt-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  const ckpt = createFileCheckpoint(path);
  try {
    assert.equal(ckpt.get(), null);
    ckpt.set(987654);
    assert.equal(ckpt.get(), 987654);
    ckpt.set(987655);
    assert.equal(ckpt.get(), 987655);
  } finally {
    rmSync(path, { force: true });
  }
});
