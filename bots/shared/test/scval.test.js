// Pure unit tests for scval.js — no env, no network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Keypair } from '@stellar/stellar-sdk';
import { addr, i128, u64, u32, sym, str, vec, toNative } from '../scval.js';

test('addr round-trips a G-address', () => {
  const g = Keypair.random().publicKey();
  assert.equal(toNative(addr(g)), g);
});

test('i128 round-trips a large stroop amount (bigint)', () => {
  const amount = 10_000_000_000n; // 1,000 USDC at 7 decimals
  assert.equal(toNative(i128(amount)), amount);
});

test('i128 accepts integer number and numeric string', () => {
  assert.equal(toNative(i128(500)), 500n);
  assert.equal(toNative(i128('123456789')), 123456789n);
});

test('i128 handles the i128 extremes', () => {
  const max = (1n << 127n) - 1n;
  const min = -(1n << 127n);
  assert.equal(toNative(i128(max)), max);
  assert.equal(toNative(i128(min)), min);
});

test('i128 rejects a fractional number (decimals-slip guard)', () => {
  assert.throws(() => i128(1.5), /integer/);
});

test('i128 rejects non-numeric garbage', () => {
  assert.throws(() => i128('12.3'), /integer/);
  assert.throws(() => i128('abc'), /integer/);
});

test('u32 round-trips enum discriminants and bps values', () => {
  assert.equal(toNative(u32(0)), 0); // Outcome::Yes
  assert.equal(toNative(u32(1)), 1); // Outcome::No
  assert.equal(toNative(u32(2)), 2); // Outcome::Void
  assert.equal(toNative(u32(100)), 100); // e.g. fee bps
  assert.equal(toNative(u32(0xffff_ffff)), 0xffff_ffff);
});

test('u32 rejects out-of-range / non-integer', () => {
  assert.throws(() => u32(-1), /u32/);
  assert.throws(() => u32(1.5), /u32/);
  assert.throws(() => u32(0x1_0000_0000), /u32/);
});

test('u64 round-trips a timestamp', () => {
  const ts = 1_752_000_000n;
  assert.equal(toNative(u64(ts)), ts);
});

test('sym and str round-trip', () => {
  assert.equal(toNative(sym('football')), 'football');
  assert.equal(toNative(str('Will Team A win?')), 'Will Team A win?');
});

test('vec builds a Reflector Other-asset vector', () => {
  assert.deepEqual(toNative(vec([sym('Other'), sym('BTC')])), ['Other', 'BTC']);
  assert.deepEqual(toNative(vec([])), []);
});
