// Unit tests for invoke.js pure surface — no network. Sets dummy env before
// import because invoke.js -> config.js reads RPC_URL / CONTRACT_ID at load.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Account, Keypair } from '@stellar/stellar-sdk';

process.env.RPC_URL ??= 'https://soroban-testnet.stellar.org';
process.env.CONTRACT_ID ??= 'CTESTCONTRACTIDPLACEHOLDER000000000000000000000000000000';

const { InvokeError, InvokeStage, parseContractErrorCode, buildInvokeTx, invoke } = await import('../invoke.js');

test('InvokeError carries name, stage, and code', () => {
  const err = new InvokeError('boom', { stage: InvokeStage.CONFIRM, code: 14 });
  assert.equal(err.name, 'InvokeError');
  assert.equal(err.stage, 'confirm');
  assert.equal(err.code, 14);
  assert.ok(err instanceof Error);
});

test('InvokeError defaults code to null', () => {
  const err = new InvokeError('boom', { stage: InvokeStage.BUILD });
  assert.equal(err.code, null);
});

test('parseContractErrorCode extracts the contract error number', () => {
  assert.equal(parseContractErrorCode('HostError: Error(Contract, #14)'), 14);
  assert.equal(parseContractErrorCode('… Error(Contract, #13) NothingProposed …'), 13);
  assert.equal(parseContractErrorCode('Error(Contract, #7)'), 7);
});

test('parseContractErrorCode returns null for unrelated / empty input', () => {
  assert.equal(parseContractErrorCode('tx submission timed out'), null);
  assert.equal(parseContractErrorCode('Error(WasmVm, #5)'), null); // not a Contract error
  assert.equal(parseContractErrorCode(null), null);
  assert.equal(parseContractErrorCode(undefined), null);
});

test('parseContractErrorCode digs into arrays of strings', () => {
  assert.equal(parseContractErrorCode(['no match here', 'Error(Contract, #22)']), 22);
});

// A syntactically valid contract StrKey (build only needs it to parse; no network).
const VALID_CONTRACT = 'CCSSW2PLSWIF67GPHUUK64LBSPAPVL3PZH2OEZWCCQIGUUN475ZH55UY';

test('buildInvokeTx still builds an unsigned tx for a dummy account', () => {
  const kp = Keypair.random();
  const source = new Account(kp.publicKey(), '0');
  const tx = buildInvokeTx(source, VALID_CONTRACT, 'market_count', []);
  assert.equal(tx.operations.length, 1);
  assert.equal(tx.source, kp.publicKey());
});

test('buildInvokeTx rejects a missing contract id', () => {
  const source = new Account(Keypair.random().publicKey(), '0');
  assert.throws(() => buildInvokeTx(source, '', 'market_count', []), /CONTRACT_ID/);
});

test('invoke rejects when no signer is supplied', async () => {
  await assert.rejects(() => invoke('C...', 'finalize', [], {}), (err) => {
    assert.equal(err.name, 'InvokeError');
    assert.equal(err.stage, 'build');
    return true;
  });
});
