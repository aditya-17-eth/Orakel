import { test } from 'node:test';
import assert from 'node:assert/strict';

const { calculatePositionMarkValue, calculateClaimablePosition, validateWallet, validatePage } = await import('../portfolio.js');

const wallet = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

test('portfolio marks open positions at the current YES price', () => {
  assert.equal(calculatePositionMarkValue(100n, 50n, 6_000), 80n);
});

test('portfolio uses exact winning-side and void payouts after resolution', () => {
  assert.equal(calculatePositionMarkValue(100n, 50n, 6_000, 0), 100n);
  assert.equal(calculatePositionMarkValue(100n, 50n, 6_000, 1), 50n);
  assert.equal(calculatePositionMarkValue(100n, 51n, 6_000, 2), 75n);
  assert.equal(calculateClaimablePosition(100n, 50n, 0), 100n);
});

test('wallet and pagination validation reject unsafe inputs', () => {
  assert.equal(validateWallet(wallet), wallet);
  assert.deepEqual(validatePage({ offset: 10, limit: 25 }), { offset: 10, limit: 25 });
  assert.throws(() => validateWallet('not-a-wallet'), /valid Stellar G-address/);
  assert.throws(() => validatePage({ offset: -1 }), /offset/);
  assert.throws(() => validatePage({ limit: 101 }), /between 1 and 100/);
});
