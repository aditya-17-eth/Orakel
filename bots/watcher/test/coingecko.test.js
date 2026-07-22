// Pure unit tests for coingecko.js — no env, no network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nearestPrice, SYMBOL_TO_ID } from '../coingecko.js';

test('nearestPrice picks the point closest to the target ms', () => {
  const prices = [
    [1_000_000, 100],
    [1_600_000, 110],
    [2_200_000, 120],
  ];
  assert.deepEqual(nearestPrice(prices, 1_650_000), { usd: 110, atMs: 1_600_000 });
  assert.deepEqual(nearestPrice(prices, 1_050_000), { usd: 100, atMs: 1_000_000 });
  assert.deepEqual(nearestPrice(prices, 9_000_000), { usd: 120, atMs: 2_200_000 });
});

test('nearestPrice returns null on empty / bad input', () => {
  assert.equal(nearestPrice([], 1000), null);
  assert.equal(nearestPrice(undefined, 1000), null);
  assert.equal(nearestPrice(null, 1000), null);
});

test('SYMBOL_TO_ID maps majors and omits stablecoins', () => {
  assert.equal(SYMBOL_TO_ID.BTC, 'bitcoin');
  assert.equal(SYMBOL_TO_ID.ETH, 'ethereum');
  assert.equal(SYMBOL_TO_ID.XLM, 'stellar');
  assert.equal(SYMBOL_TO_ID.USDC, undefined); // stablecoin -> unsupported cross-check
});

// Divergence math mirrors the watcher's threshold check (bps of Reflector price).
function divergenceBps(reflectorUsd, cgUsd) {
  return Math.abs(cgUsd - reflectorUsd) / reflectorUsd * 10_000;
}

test('divergence bps: 2% spread is under the 300bps default, 4% is over', () => {
  assert.ok(divergenceBps(64_000, 65_280) < 300);   // +2.0%
  assert.ok(divergenceBps(64_000, 66_560) >= 300);  // +4.0%
  assert.equal(Math.round(divergenceBps(64_000, 65_920)), 300); // exactly 3%
});
