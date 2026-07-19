import { Account, Address, BASE_FEE, Networks, Operation, TransactionBuilder, nativeToScVal, rpc, scValToNative, xdr } from "@stellar/stellar-sdk/minimal";
import type { Loan, Market, MarketState, Outcome, Position } from "@/types/market";

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://soroban-testnet.stellar.org";
export const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID || "";
export const NETWORK_PASSPHRASE = Networks.TESTNET;
export const server = new rpc.Server(RPC_URL);
export const TOKEN_DECIMALS = 7;
export const FEE_BPS = 200n;

const READ_SOURCE = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

function u64(value: number | bigint) { return nativeToScVal(BigInt(value), { type: "u64" }); }
function i128(value: bigint | number | string) { return nativeToScVal(BigInt(value), { type: "i128" }); }
function addr(value: string) { return new Address(value).toScVal(); }
function bool(value: boolean) { return nativeToScVal(value, { type: "bool" }); }
function asNumber(value: unknown) { return Number(value ?? 0); }
function asBigInt(value: unknown) { return typeof value === "bigint" ? value : BigInt(value as string | number | undefined ?? 0); }
function state(value: unknown): MarketState {
  const n = typeof value === "object" && value !== null && "tag" in value ? String((value as { tag: () => string }).tag()) : String(value);
  if (n.includes("Proposed") || n === "1") return "Proposed";
  if (n.includes("Disputed") || n === "2") return "Disputed";
  if (n.includes("Resolved") || n === "3") return "Resolved";
  return "Open";
}
function outcome(value: unknown): Outcome | undefined {
  if (value === undefined || value === null) return undefined;
  const n = asNumber(value);
  return n === 0 ? "Yes" : n === 1 ? "No" : "Void";
}
function normalizeMarket(raw: Record<string, unknown>, price: bigint): Market {
  return {
    id: asNumber(raw.id), question: String(raw.question ?? "Untitled market"), category: String(raw.category ?? "general"),
    criteriaRef: String(raw.criteria_ref ?? raw.criteriaRef ?? ""), lockTime: asNumber(raw.lock_time ?? raw.lockTime), resolveTime: asNumber(raw.resolve_time ?? raw.resolveTime),
    disputeWindow: asNumber(raw.dispute_window ?? raw.disputeWindow), positionCap: asBigInt(raw.position_cap ?? raw.positionCap), bond: asBigInt(raw.bond), state: state(raw.state),
    yesReserve: asBigInt(raw.yes_reserve ?? raw.yesReserve), noReserve: asBigInt(raw.no_reserve ?? raw.noReserve), totalLpShares: asBigInt(raw.total_lp_shares ?? raw.totalLpShares),
    lpFeesAccrued: asBigInt(raw.lp_fees_accrued ?? raw.lpFeesAccrued), collateralLocked: asBigInt(raw.collateral_locked ?? raw.collateralLocked),
    proposer: raw.proposer ? String(raw.proposer) : undefined, proposedOutcome: outcome(raw.proposed_outcome ?? raw.proposedOutcome), proposalTime: asNumber(raw.proposal_time ?? raw.proposalTime),
    disputer: raw.disputer ? String(raw.disputer) : undefined, outcome: outcome(raw.outcome), poolPayoutTotal: asBigInt(raw.pool_payout_total ?? raw.poolPayoutTotal), yesPriceBps: price,
  };
}

async function simulate(method: string, args: xdr.ScVal[] = []) {
  if (!CONTRACT_ID) throw new Error("NEXT_PUBLIC_CONTRACT_ID is not configured.");
  const tx = new TransactionBuilder(new Account(READ_SOURCE, "0"), { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(Operation.invokeContractFunction({ contract: CONTRACT_ID, function: method, args }))
    .setTimeout(30).build();
  const result = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(result)) throw new Error(result.error);
  if (!result.result?.retval) throw new Error(`No return value from ${method}.`);
  return scValToNative(result.result.retval) as unknown;
}

export async function getMarketCount() { return asNumber(await simulate("market_count")); }
export async function getMarket(id: number): Promise<Market> {
  const [raw, price] = await Promise.all([simulate("get_market", [u64(id)]), simulate("yes_price_bps", [u64(id)])]);
  return normalizeMarket(raw as Record<string, unknown>, asBigInt(price));
}
export async function getMarkets(): Promise<Market[]> {
  const count = await getMarketCount();
  return Promise.all(Array.from({ length: count }, (_, id) => getMarket(id)));
}
export async function getUserPosition(id: number, user: string): Promise<Position> {
  const raw = await simulate("get_user_position", [u64(id), addr(user)]) as Record<string, unknown>;
  return { yes: asBigInt(raw.yes), no: asBigInt(raw.no), spent: asBigInt(raw.spent) };
}
export async function getUserLp(id: number, user: string) { return asBigInt(await simulate("get_user_lp", [u64(id), addr(user)])); }
export async function getUserLoan(id: number, user: string): Promise<Loan> {
  const raw = await simulate("get_user_loan", [u64(id), addr(user)]) as Record<string, unknown>;
  return {
    yesCollateral: asBigInt(raw.yes_collateral ?? raw.yesCollateral),
    noCollateral: asBigInt(raw.no_collateral ?? raw.noCollateral),
    cashCollateral: asBigInt(raw.cash_collateral ?? raw.cashCollateral),
    debt: asBigInt(raw.debt),
    openedAt: asNumber(raw.opened_at ?? raw.openedAt),
  };
}

export function buyQuote(market: Market, amount: bigint, buyYes: boolean) {
  const invest = amount * (10000n - FEE_BPS) / 10000n;
  const y = buyYes ? market.yesReserve : market.noReserve;
  const n = buyYes ? market.noReserve : market.yesReserve;
  const newY = y * n / (n + invest);
  const shares = invest + y - newY;
  return { shares, effectiveBps: shares > 0n ? amount * 10000n / shares : 0n, fee: amount - invest, minSharesOut: shares * 985n / 1000n };
}
export function sellQuote(market: Market, shares: bigint, sellYes: boolean) {
  const a = sellYes ? market.yesReserve : market.noReserve;
  const b = sellYes ? market.noReserve : market.yesReserve;
  const sum = a + shares + b;
  const x = (sum - bigintSqrt(sum * sum - 4n * shares * b)) / 2n;
  const payout = x * (10000n - FEE_BPS) / 10000n;
  return { payout, effectiveBps: shares > 0n ? payout * 10000n / shares : 0n, fee: x - payout, minAmountOut: payout * 985n / 1000n };
}
function bigintSqrt(value: bigint) { if (value < 0n) throw new Error("sqrt of negative number"); if (value < 2n) return value; let x0 = 1n << BigInt(Math.ceil(Math.log2(Number(value)) / 2)); let x1 = (x0 + value / x0) >> 1n; while (x1 < x0) { x0 = x1; x1 = (x0 + value / x0) >> 1n; } return x0; }

export type ContractCall = { method: string; args: xdr.ScVal[] };
export function buyCall(id: number, user: string, buyYes: boolean, amount: bigint, minSharesOut: bigint): ContractCall { return { method: "buy", args: [u64(id), addr(user), bool(buyYes), i128(amount), i128(minSharesOut)] }; }
export function sellCall(id: number, user: string, sellYes: boolean, shares: bigint, minAmountOut: bigint): ContractCall { return { method: "sell", args: [u64(id), addr(user), bool(sellYes), i128(shares), i128(minAmountOut)] }; }
export function claimCall(id: number, user: string): ContractCall { return { method: "claim", args: [u64(id), addr(user)] }; }
export function claimLpCall(id: number, user: string): ContractCall { return { method: "claim_lp", args: [u64(id), addr(user)] }; }
export function borrowCall(id: number, user: string, borrowYes: boolean, collateralShares: bigint, cashCollateral: bigint, amount: bigint): ContractCall {
  return { method: "borrow", args: [u64(id), addr(user), bool(borrowYes), i128(collateralShares), i128(cashCollateral), i128(amount)] };
}
export function repayCall(id: number, user: string, amount: bigint): ContractCall { return { method: "repay", args: [u64(id), addr(user), i128(amount)] }; }
export function settleLoanCall(id: number, user: string): ContractCall { return { method: "settle_loan", args: [u64(id), addr(user)] }; }

function invocationTx(account: Account, call: ContractCall) {
  return new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE }).addOperation(Operation.invokeContractFunction({ contract: CONTRACT_ID, function: call.method, args: call.args })).setTimeout(90).build();
}

async function waitForTransaction(hash: string) {
  for (let attempt = 0; attempt < 45; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const settled = await server.getTransaction(hash);
    if (settled.status === "SUCCESS") return settled;
    if (settled.status === "FAILED") throw new Error("The transaction failed on the Stellar network.");
  }
  throw new Error("Transaction is still pending. Check the transaction hash before retrying.");
}

async function sendBuiltTransaction(tx: ReturnType<TransactionBuilder["build"]>, sign: (xdr: string) => Promise<string>) {
  const signed = await sign(tx.toXDR());
  const result = await server.sendTransaction(TransactionBuilder.fromXDR(signed, NETWORK_PASSPHRASE));
  if (result.status === "ERROR") throw new Error(result.errorResult?.toString() || "Transaction failed.");
  if (!result.hash) throw new Error("The network did not return a transaction hash.");
  return waitForTransaction(result.hash);
}

export async function submitCall(source: string, call: ContractCall, sign: (xdr: string) => Promise<string>) {
  if (!CONTRACT_ID) throw new Error("NEXT_PUBLIC_CONTRACT_ID is not configured.");
  const account = await server.getAccount(source);
  const prepared = await server.prepareTransaction(invocationTx(account, call));
  return sendBuiltTransaction(prepared, sign);
}

/**
 * Claims can fail when Soroban persistent storage for an old position is
 * archived. The simulation exposes a restore preamble containing the exact
 * footprint; restore it, wait for confirmation, then rebuild the claim with a
 * fresh sequence number and submit it.
 */
export async function submitClaimWithRestore(source: string, call: ContractCall, sign: (xdr: string) => Promise<string>, onRestoring?: () => void) {
  if (!CONTRACT_ID) throw new Error("NEXT_PUBLIC_CONTRACT_ID is not configured.");
  const account = await server.getAccount(source);
  const simulation = await server.simulateTransaction(invocationTx(account, call)) as unknown as { restorePreamble?: { minResourceFee?: string | number; transactionData: unknown } };
  if (simulation.restorePreamble?.transactionData) {
    onRestoring?.();
    const restoreAccount = await server.getAccount(source);
    const restoreTx = new TransactionBuilder(restoreAccount, { fee: String(simulation.restorePreamble.minResourceFee ?? BASE_FEE), networkPassphrase: NETWORK_PASSPHRASE })
      .addOperation(Operation.restoreFootprint({}))
      .setSorobanData(simulation.restorePreamble.transactionData as never)
      .setTimeout(90)
      .build();
    await sendBuiltTransaction(restoreTx, sign);
  }
  return submitCall(source, call, sign);
}
