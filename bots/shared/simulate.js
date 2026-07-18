// Free read path: build -> simulate -> decode. No signing, no fee, no submit.
//
// Used for the contract's read entrypoints (market_count, yes_price_bps,
// get_market, get_user_position, get_user_lp). A read still needs a *source*
// account to build a transaction envelope, but it is never signed or sent, so
// any funded (or even unfunded, via a synthetic account) address works. We use
// the well-known all-zero account so reads require no key at all.

import { Account, rpc } from '@stellar/stellar-sdk';
import { server } from './config.js';
import { buildInvokeTx } from './invoke.js';
import { toNative } from './scval.js';

// A throwaway source for read-only simulation. The public key never needs to
// exist on-chain — simulation does not touch its sequence or balance.
const READ_SOURCE = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

export class SimulateError extends Error {
  constructor(message, { cause, details } = {}) {
    super(message, { cause });
    this.name = 'SimulateError';
    this.details = details;
  }
}

/**
 * Simulate a read-only contract call and return its decoded native result.
 *
 * @param {string} contractId
 * @param {string} method
 * @param {import('@stellar/stellar-sdk').xdr.ScVal[]} [args=[]]
 * @returns {Promise<any>} the native-decoded return value
 */
export async function simulate(contractId, method, args = []) {
  const source = new Account(READ_SOURCE, '0');
  const tx = buildInvokeTx(source, contractId, method, args);

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new SimulateError(`Simulation failed for ${method}: ${sim.error}`, { details: sim });
  }
  if (!sim.result || sim.result.retval === undefined) {
    // A read that returns nothing is almost always a wrong method/args.
    throw new SimulateError(`No return value from ${method} (check method name / args)`, { details: sim });
  }
  return toNative(sim.result.retval);
}
