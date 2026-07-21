// Contract invocation: the build path (unsigned) and the full write path
// (build -> simulate -> assemble -> sign -> submit -> confirm).
//
// A Soroban contract tx MUST be assembled from a simulation before signing —
// an un-assembled envelope is rejected by the network as TxMalformed (this is
// exactly what broke the raw `stellar tx sign` flow in scripts/admin-tx.sh).
// `invoke()` therefore always simulates and assembles before it signs.
//
// Every failure throws a typed InvokeError carrying the `stage` it failed at
// and, for contract-level failures, the numeric contract error `code` (e.g. 13
// NothingProposed, 14 DisputeWindowOpen) so callers like the finalizer can
// branch on it without string-matching.

import { BASE_FEE, Operation, TransactionBuilder, rpc, scValToNative } from '@stellar/stellar-sdk';
import { NETWORK_PASSPHRASE, server } from './config.js';

/** Stages the write path moves through, in order. */
export const InvokeStage = Object.freeze({
  BUILD: 'build',
  SIMULATE: 'simulate',
  SIGN: 'sign',
  SUBMIT: 'submit',
  CONFIRM: 'confirm',
});

/**
 * Error thrown by `invoke()`. Carries the pipeline `stage` that failed and,
 * when the failure came from the contract, the numeric error `code`.
 */
export class InvokeError extends Error {
  constructor(message, { stage, code = null, cause, details } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'InvokeError';
    this.stage = stage;
    this.code = code;
    this.details = details;
  }
}

/**
 * Extract the numeric contract error code from a simulation error string, a
 * result XDR, or a diagnostic-events array. Soroban surfaces contract panics as
 * `Error(Contract, #N)`. Returns the integer N, or null if none is found.
 *
 * @param {unknown} x  a string, an object with `.toXDR()`, or an array of them
 * @returns {number|null}
 */
export function parseContractErrorCode(x) {
  if (x == null) return null;
  const texts = [];
  const collect = (v) => {
    if (v == null) return;
    if (typeof v === 'string') { texts.push(v); return; }
    if (Array.isArray(v)) { v.forEach(collect); return; }
    // XDR objects (diagnostic events, result) can stringify to a base64 blob
    // that does not contain the pattern; prefer their JSON form when available.
    try { if (typeof v.toJSON === 'function') texts.push(JSON.stringify(v.toJSON())); } catch { /* ignore */ }
    try { texts.push(String(v)); } catch { /* ignore */ }
  };
  collect(x);
  for (const t of texts) {
    const m = /Error\(Contract,\s*#(\d+)\)/.exec(t);
    if (m) return Number(m[1]);
  }
  return null;
}

/**
 * Build an UNSIGNED contract-invocation transaction. No simulation, no signing.
 * Kept for read-path callers (simulate.js) and for anyone assembling by hand.
 */
export function buildInvokeTx(sourceAccount, contractId, method, args = []) {
  if (!contractId) throw new Error('CONTRACT_ID is not configured.');
  return new TransactionBuilder(sourceAccount, { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(Operation.invokeContractFunction({ contract: contractId, function: method, args }))
    .setTimeout(30)
    .build();
}

/**
 * Invoke a contract write entrypoint end to end: build -> simulate -> assemble
 * -> sign -> submit -> confirm. Resolves with `{ hash, returnValue }` on
 * success; throws InvokeError otherwise.
 *
 * @param {string} contractId
 * @param {string} method
 * @param {import('@stellar/stellar-sdk').xdr.ScVal[]} args
 * @param {object} opts
 * @param {import('@stellar/stellar-sdk').Keypair} opts.signer  source + signer
 * @param {number} [opts.timeoutMs=30000]  budget for the confirm poll
 * @param {number} [opts.pollIntervalMs=1000]
 * @returns {Promise<{hash: string, returnValue: any}>}
 */
export async function invoke(contractId, method, args = [], { signer, timeoutMs = 30000, pollIntervalMs = 1000 } = {}) {
  if (!signer) throw new InvokeError('invoke() requires a signer keypair.', { stage: InvokeStage.BUILD });
  if (!contractId) throw new InvokeError('CONTRACT_ID is not configured.', { stage: InvokeStage.BUILD });

  // 1. build — load the source account (sequence) and assemble the raw envelope.
  let raw;
  try {
    const source = await server.getAccount(signer.publicKey());
    raw = buildInvokeTx(source, contractId, method, args);
  } catch (err) {
    throw new InvokeError(`build failed for ${method}: ${err?.message ?? err}`, { stage: InvokeStage.BUILD, cause: err });
  }

  // 2. simulate — a contract revert shows up here as a simulation error.
  let sim;
  try {
    sim = await server.simulateTransaction(raw);
  } catch (err) {
    throw new InvokeError(`simulate request failed for ${method}: ${err?.message ?? err}`, { stage: InvokeStage.SIMULATE, cause: err });
  }
  if (rpc.Api.isSimulationError(sim)) {
    throw new InvokeError(`simulation reverted for ${method}: ${sim.error}`, {
      stage: InvokeStage.SIMULATE,
      code: parseContractErrorCode(sim.error),
      details: sim,
    });
  }

  // 3. assemble — fold footprint + resource fee + auth into the tx, then sign.
  let prepared;
  try {
    prepared = rpc.assembleTransaction(raw, sim).build();
    prepared.sign(signer);
  } catch (err) {
    throw new InvokeError(`sign/assemble failed for ${method}: ${err?.message ?? err}`, { stage: InvokeStage.SIGN, cause: err });
  }

  // 4. submit.
  let sent;
  try {
    sent = await server.sendTransaction(prepared);
  } catch (err) {
    throw new InvokeError(`submit request failed for ${method}: ${err?.message ?? err}`, { stage: InvokeStage.SUBMIT, cause: err });
  }
  if (sent.status === 'ERROR') {
    throw new InvokeError(`submit rejected for ${method}: ${sent.status}`, {
      stage: InvokeStage.SUBMIT,
      code: parseContractErrorCode(sent.errorResult),
      details: sent,
    });
  }
  const hash = sent.hash;

  // 5. confirm — poll until the tx leaves NOT_FOUND or the budget runs out.
  const deadline = Date.now() + timeoutMs;
  let got;
  do {
    await sleep(pollIntervalMs);
    try {
      got = await server.getTransaction(hash);
    } catch (err) {
      throw new InvokeError(`confirm poll failed for ${method}: ${err?.message ?? err}`, { stage: InvokeStage.CONFIRM, cause: err, details: { hash } });
    }
    if (got.status !== rpc.Api.GetTransactionStatus.NOT_FOUND) break;
  } while (Date.now() < deadline);

  if (!got || got.status === rpc.Api.GetTransactionStatus.NOT_FOUND) {
    throw new InvokeError(`confirm timed out for ${method} after ${timeoutMs}ms`, { stage: InvokeStage.CONFIRM, details: { hash } });
  }
  if (got.status === rpc.Api.GetTransactionStatus.FAILED) {
    throw new InvokeError(`transaction failed on-chain for ${method}`, {
      stage: InvokeStage.CONFIRM,
      code: parseContractErrorCode(got.resultXdr ?? got.diagnosticEventsXdr ?? got),
      details: got,
    });
  }

  const returnValue = got.returnValue !== undefined ? safeNative(got.returnValue) : undefined;
  return { hash, returnValue };
}

function safeNative(scv) {
  try { return scValToNative(scv); } catch { return undefined; }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
