import * as StellarSdk from "@stellar/stellar-sdk";
import {
  NETWORK_PASSPHRASE,
  contractAmountToUSDC,
  requireContractId,
  rpc,
  usdcToContractAmount,
} from "@/lib/stellar";
import { ContractQuote, MarketState, Outcome, ParsedLoan, ParsedMarket, ParsedPosition } from "@/lib/types";

const READ_SOURCE = new StellarSdk.Account(StellarSdk.Keypair.random().publicKey(), "0");
const CLAIM_RESTORE_ERROR = "RESTORE_FOOTPRINT_REQUIRED";

function contract() {
  return new StellarSdk.Contract(requireContractId());
}

function scU64(value: number) {
  return StellarSdk.nativeToScVal(value, { type: "u64" });
}

function scI128(value: bigint) {
  return StellarSdk.nativeToScVal(value, { type: "i128" });
}

function scAddress(address: string) {
  return new StellarSdk.Address(address).toScVal();
}

async function simulateRead(method: string, ...args: StellarSdk.xdr.ScVal[]) {
  const tx = new StellarSdk.TransactionBuilder(READ_SOURCE, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract().call(method, ...args))
    .setTimeout(30)
    .build();

  const simulation = await rpc.simulateTransaction(tx);
  if (StellarSdk.rpc.Api.isSimulationError(simulation)) {
    throw new Error(simulation.error);
  }

  const retval = simulation.result?.retval;
  if (!retval) return null;
  return StellarSdk.scValToNative(retval);
}

async function simulateWrite(sourceAddress: string, method: string, ...args: StellarSdk.xdr.ScVal[]) {
  const account = await rpc.getAccount(sourceAddress);
  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract().call(method, ...args))
    .setTimeout(180)
    .build();

  const simulation = await rpc.simulateTransaction(tx);
  if (StellarSdk.rpc.Api.isSimulationError(simulation)) {
    throw new Error(simulation.error);
  }

  return { tx, simulation };
}

async function buildContractTx(sourceAddress: string, method: string, ...args: StellarSdk.xdr.ScVal[]) {
  const { tx, simulation } = await simulateWrite(sourceAddress, method, ...args);
  return StellarSdk.rpc.assembleTransaction(tx, simulation).build().toXDR();
}

export async function getMarketCount() {
  const raw = await simulateRead("market_count");
  return Number(raw || 0);
}

export async function getMarket(id: number) {
  const [rawMarket, rawPrice] = await Promise.all([
    simulateRead("get_market", scU64(id)),
    simulateRead("yes_price_bps", scU64(id)),
  ]);

  if (!rawMarket) return null;
  return parseMarket(rawMarket, Number(rawPrice || 0));
}

export async function getMarketsFromContract() {
  const count = await getMarketCount();
  const ids = Array.from({ length: count }, (_, id) => id);
  const markets = await Promise.all(ids.map((id) => getMarket(id)));
  return markets.filter((market): market is ParsedMarket => Boolean(market));
}

export async function getUserPosition(marketId: number, address: string): Promise<ParsedPosition> {
  const raw = await simulateRead("get_user_position", scU64(marketId), scAddress(address));
  return {
    yes: contractAmountToUSDC(raw?.yes),
    no: contractAmountToUSDC(raw?.no),
    spent: contractAmountToUSDC(raw?.spent),
  };
}

export async function getUserLpShares(marketId: number, address: string) {
  const raw = await simulateRead("get_user_lp", scU64(marketId), scAddress(address));
  return contractAmountToUSDC(raw);
}

export async function getUserLoan(marketId: number, address: string): Promise<ParsedLoan> {
  const raw = await simulateRead("get_user_loan", scU64(marketId), scAddress(address));
  const openedAt = Number(raw?.opened_at || 0);
  return {
    yesCollateral: contractAmountToUSDC(raw?.yes_collateral),
    noCollateral: contractAmountToUSDC(raw?.no_collateral),
    cashCollateral: contractAmountToUSDC(raw?.cash_collateral),
    debt: contractAmountToUSDC(raw?.debt),
    openedAt: openedAt > 0 ? new Date(openedAt * 1000) : null,
  };
}

export async function quoteBuy(
  sourceAddress: string,
  marketId: number,
  buyYes: boolean,
  amount: number,
): Promise<ContractQuote> {
  const amountIn = usdcToContractAmount(amount);
  const { simulation } = await simulateWrite(
    sourceAddress,
    "buy",
    scU64(marketId),
    scAddress(sourceAddress),
    StellarSdk.xdr.ScVal.scvBool(buyYes),
    scI128(amountIn),
    scI128(BigInt(0)),
  );
  const quotedOut = contractAmountToUSDC(StellarSdk.scValToNative(simulation.result!.retval));
  return {
    amountIn: amount,
    quotedOut,
    effectivePrice: quotedOut > 0 ? amount / quotedOut : 0,
    minOut: quotedOut * 0.985,
  };
}

export async function quoteSell(
  sourceAddress: string,
  marketId: number,
  sellYes: boolean,
  shares: number,
): Promise<ContractQuote> {
  const sharesIn = usdcToContractAmount(shares);
  const { simulation } = await simulateWrite(
    sourceAddress,
    "sell",
    scU64(marketId),
    scAddress(sourceAddress),
    StellarSdk.xdr.ScVal.scvBool(sellYes),
    scI128(sharesIn),
    scI128(BigInt(0)),
  );
  const quotedOut = contractAmountToUSDC(StellarSdk.scValToNative(simulation.result!.retval));
  return {
    amountIn: shares,
    quotedOut,
    effectivePrice: shares > 0 ? quotedOut / shares : 0,
    minOut: quotedOut * 0.985,
  };
}

export function buildBuyTx(sourceAddress: string, marketId: number, buyYes: boolean, amount: number, minSharesOut: number) {
  return buildContractTx(
    sourceAddress,
    "buy",
    scU64(marketId),
    scAddress(sourceAddress),
    StellarSdk.xdr.ScVal.scvBool(buyYes),
    scI128(usdcToContractAmount(amount)),
    scI128(usdcToContractAmount(minSharesOut)),
  );
}

export function buildSellTx(sourceAddress: string, marketId: number, sellYes: boolean, shares: number, minAmountOut: number) {
  return buildContractTx(
    sourceAddress,
    "sell",
    scU64(marketId),
    scAddress(sourceAddress),
    StellarSdk.xdr.ScVal.scvBool(sellYes),
    scI128(usdcToContractAmount(shares)),
    scI128(usdcToContractAmount(minAmountOut)),
  );
}

export function buildClaimTx(sourceAddress: string, marketId: number) {
  return buildContractTx(sourceAddress, "claim", scU64(marketId), scAddress(sourceAddress));
}

export function buildClaimLpTx(sourceAddress: string, marketId: number) {
  return buildContractTx(sourceAddress, "claim_lp", scU64(marketId), scAddress(sourceAddress));
}

export function buildBorrowTx(sourceAddress: string, marketId: number, borrowYes: boolean, collateralShares: number, cashCollateral: number, amount: number) {
  return buildContractTx(sourceAddress, "borrow", scU64(marketId), scAddress(sourceAddress), StellarSdk.xdr.ScVal.scvBool(borrowYes), scI128(usdcToContractAmount(collateralShares)), scI128(usdcToContractAmount(cashCollateral)), scI128(usdcToContractAmount(amount)));
}

export function buildRepayTx(sourceAddress: string, marketId: number, amount: number) {
  return buildContractTx(sourceAddress, "repay", scU64(marketId), scAddress(sourceAddress), scI128(usdcToContractAmount(amount)));
}

export function buildSettleLoanTx(sourceAddress: string, marketId: number) {
  return buildContractTx(sourceAddress, "settle_loan", scU64(marketId), scAddress(sourceAddress));
}

export async function buildRestoreFootprintTx(sourceAddress: string, method: "claim" | "claim_lp", marketId: number) {
  const account = await rpc.getAccount(sourceAddress);
  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract().call(method, scU64(marketId), scAddress(sourceAddress)))
    .setTimeout(180)
    .build();

  const simulation = await rpc.simulateTransaction(tx);
  const restorePreamble = (simulation as unknown as { restorePreamble?: { transactionData: StellarSdk.xdr.SorobanTransactionData; minResourceFee: string } }).restorePreamble;

  if (!restorePreamble) {
    throw new Error(CLAIM_RESTORE_ERROR);
  }

  return new StellarSdk.TransactionBuilder(account, {
    fee: String(Number(StellarSdk.BASE_FEE) + Number(restorePreamble.minResourceFee)),
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .setSorobanData(restorePreamble.transactionData)
    .addOperation(StellarSdk.Operation.restoreFootprint({}))
    .setTimeout(180)
    .build()
    .toXDR();
}

export async function submitSignedTx(signedXdr: string) {
  const tx = StellarSdk.TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE) as StellarSdk.Transaction;
  const sent = await rpc.sendTransaction(tx);

  if (sent.status === "ERROR") {
    throw new Error(String(sent.errorResult));
  }

  const deadline = Date.now() + 30_000;
  let result = await rpc.getTransaction(sent.hash);
  while (result.status === "NOT_FOUND") {
    if (Date.now() > deadline) throw new Error(`transaction timed out: ${sent.hash}`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    result = await rpc.getTransaction(sent.hash);
  }

  if (result.status !== "SUCCESS") {
    throw new Error(`transaction failed: ${result.status}`);
  }

  return { hash: sent.hash, returnValue: result.returnValue };
}

function parseMarket(raw: Record<string, unknown>, yesPriceBps: number): ParsedMarket {
  return {
    id: Number(raw.id),
    question: String(raw.question || ""),
    category: String(raw.category || "general"),
    criteriaRef: String(raw.criteria_ref || ""),
    lockTime: new Date(Number(raw.lock_time || 0) * 1000),
    resolveTime: new Date(Number(raw.resolve_time || 0) * 1000),
    disputeWindow: Number(raw.dispute_window || 0),
    positionCap: contractAmountToUSDC(raw.position_cap as bigint),
    bond: contractAmountToUSDC(raw.bond as bigint),
    state: normalizeMarketState(raw.state),
    yesReserve: contractAmountToUSDC(raw.yes_reserve as bigint),
    noReserve: contractAmountToUSDC(raw.no_reserve as bigint),
    totalLpShares: contractAmountToUSDC(raw.total_lp_shares as bigint),
    lpFeesAccrued: contractAmountToUSDC(raw.lp_fees_accrued as bigint),
    collateralLocked: contractAmountToUSDC(raw.collateral_locked as bigint),
    proposer: normalizeAddress(raw.proposer),
    proposedOutcome: normalizeOutcome(raw.proposed_outcome),
    proposalTime: Number(raw.proposal_time || 0) > 0 ? new Date(Number(raw.proposal_time) * 1000) : null,
    disputer: normalizeAddress(raw.disputer),
    outcome: normalizeOutcome(raw.outcome),
    poolPayoutTotal: contractAmountToUSDC(raw.pool_payout_total as bigint),
    yesPriceBps,
  };
}

function normalizeMarketState(value: unknown) {
  if (typeof value === "number") return value as MarketState;
  const text = String(value || "").toLowerCase();
  if (text.includes("proposed")) return MarketState.Proposed;
  if (text.includes("disputed")) return MarketState.Disputed;
  if (text.includes("resolved")) return MarketState.Resolved;
  return MarketState.Open;
}

function normalizeOutcome(value: unknown): Outcome | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value as Outcome;
  const text = String(value).toLowerCase();
  if (text === "0" || text.includes("yes")) return Outcome.Yes;
  if (text === "1" || text.includes("no")) return Outcome.No;
  if (text === "2" || text.includes("void")) return Outcome.Void;
  return null;
}

function normalizeAddress(value: unknown) {
  if (!value) return null;
  if (typeof value === "string") return value || null;
  if (typeof value === "object" && "toString" in value) return String(value);
  return null;
}

export { CLAIM_RESTORE_ERROR };
