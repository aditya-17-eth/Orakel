import { BASE_FEE, Operation, TransactionBuilder } from '@stellar/stellar-sdk';
import { NETWORK_PASSPHRASE } from './config.js';

export function buildInvokeTx(sourceAccount, contractId, method, args = []) {
  if (!contractId) throw new Error('CONTRACT_ID is not configured.');
  return new TransactionBuilder(sourceAccount, { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(Operation.invokeContractFunction({ contract: contractId, function: method, args }))
    .setTimeout(30)
    .build();
}
