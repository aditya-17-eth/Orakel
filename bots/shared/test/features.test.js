import { test } from 'node:test';
import assert from 'node:assert/strict';

const { formatCriteriaLink, validateMarketId } = await import('../timeline.js');
const { FaucetCooldownError } = await import('../faucet.js');

test('timeline creates safe Pinata links for CIDs and preserves HTTPS references', () => {
  assert.equal(formatCriteriaLink('QmExampleCid'), 'https://gateway.pinata.cloud/ipfs/QmExampleCid');
  assert.equal(formatCriteriaLink('ipfs://bafyExampleCid/criteria.json'), 'https://gateway.pinata.cloud/ipfs/criteria.json');
  assert.equal(formatCriteriaLink('https://example.com/criteria.json'), 'https://example.com/criteria.json');
  assert.equal(formatCriteriaLink(''), null);
});

test('timeline validates market ids', () => {
  assert.equal(validateMarketId('12'), 12);
  assert.throws(() => validateMarketId(-1), /non-negative/);
  assert.throws(() => validateMarketId('not-a-market'), /non-negative/);
});

test('faucet cooldown errors carry a retry timestamp', () => {
  const error = new FaucetCooldownError('2026-07-18T12:00:00Z');
  assert.equal(error.name, 'FaucetCooldownError');
  assert.equal(error.nextAvailableAt, '2026-07-18T12:00:00Z');
});
