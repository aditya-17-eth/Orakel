// Pure unit tests for parse.js — no env, no network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMarket, usdToRaw, invertOutcome, Outcome } from '../parse.js';

const DECIMALS = 14; // Reflector testnet
const usd = (n) => usdToRaw(n, DECIMALS); // helper: USD string -> raw i128

test('usdToRaw scales exactly with no float error', () => {
  assert.equal(usdToRaw('64,000.00', 14), 6_400_000_000_000_000_000n);
  assert.equal(usdToRaw('1', 14), 100_000_000_000_000n);
  assert.equal(usdToRaw('0.5', 14), 50_000_000_000_000n);
  assert.throws(() => usdToRaw('abc', 14), /unparseable/);
});

test('parses "at or above" -> gte, YES when price meets threshold', () => {
  const p = parseMarket({ category: 'crypto_price', question: 'Will BTC/USD be at or above $64,000.00 at 2026-07-18 04:30:00 UTC?' });
  assert.equal(p.confident, true);
  assert.equal(p.asset, 'BTC');
  assert.equal(p.comparator, 'gte');
  assert.equal(p.thresholdUsd, '64,000.00');
  assert.equal(p.decide(usd('64,000.00'), DECIMALS), Outcome.YES); // exactly at boundary -> YES
  assert.equal(p.decide(usd('64,000.01'), DECIMALS), Outcome.YES);
  assert.equal(p.decide(usd('63,999.99'), DECIMALS), Outcome.NO);
});

test('parses "below" -> lt (strict), boundary is NO', () => {
  const p = parseMarket({ category: 'crypto_price', question: 'Will ETH/USD be below $3,000 at 2026-07-19 12:00:00 UTC?' });
  assert.equal(p.confident, true);
  assert.equal(p.asset, 'ETH');
  assert.equal(p.comparator, 'lt');
  assert.equal(p.decide(usd('3000'), DECIMALS), Outcome.NO);      // not strictly below
  assert.equal(p.decide(usd('2999.99'), DECIMALS), Outcome.YES);
});

test('parses "above" as strict gt and "at or below" as lte', () => {
  const above = parseMarket({ category: 'crypto_price', question: 'Will SOL/USD be above $150.00 at 2026-01-01 00:00:00 UTC?' });
  assert.equal(above.comparator, 'gt');
  assert.equal(above.decide(usd('150.00'), DECIMALS), Outcome.NO);
  const atOrBelow = parseMarket({ category: 'crypto_price', question: 'Will SOL/USD be at or below $150 at 2026-01-01 00:00:00 UTC?' });
  assert.equal(atOrBelow.comparator, 'lte');
  assert.equal(atOrBelow.decide(usd('150'), DECIMALS), Outcome.YES);
});

test('unconfident on wrong category, unparseable question', () => {
  assert.equal(parseMarket({ category: 'football', question: 'x' }).confident, false);
  assert.equal(parseMarket({ category: 'crypto_price', question: 'Who wins the match?' }).confident, false);
  assert.equal(parseMarket({ category: 'crypto_price' }).confident, false);
});

test('invertOutcome flips YES<->NO, leaves VOID', () => {
  assert.equal(invertOutcome(Outcome.YES), Outcome.NO);
  assert.equal(invertOutcome(Outcome.NO), Outcome.YES);
  assert.equal(invertOutcome(Outcome.VOID), Outcome.VOID);
});
