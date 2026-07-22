import * as StellarSdk from "@stellar/stellar-sdk";
import { rpc, config, CONTRACT_ID, stroopToUSDC } from "./stellar";
import { Market, MarketState, Outcome, ParsedMarket, Position, ParsedPosition } from "./types";

// --- Read helpers ---

export async function getMarket(id: number): Promise<ParsedMarket | null> {
  try {
    const ledgerKey = StellarSdk.xdr.LedgerKey.contractData(
      new StellarSdk.xdr.LedgerKeyContractData({
        contract: new StellarSdk.Address(CONTRACT_ID).toScAddress(),
        key: StellarSdk.xdr.ScVal.scvVec([
          StellarSdk.xdr.ScVal.scvSymbol("Market"),
          StellarSdk.nativeToScVal(id, { type: "u64" }),
        ]),
        durability: StellarSdk.xdr.ContractDataDurability.persistent(),
      })
    );

    const entries = await rpc.getLedgerEntries(ledgerKey);
    if (!entries.entries.length) return null;

    const raw = StellarSdk.scValToNative(entries.entries[0].val.contractData().val()) as Market;
    return parseMarket(raw);
  } catch {
    return null;
  }
}

export async function getMarketCount(): Promise<number> {
  try {
    const contract = new StellarSdk.Contract(CONTRACT_ID);
    // Use the contract itself as source for simulation (read-only call)
    const tx = new StellarSdk.TransactionBuilder(
      await rpc.getAccount(CONTRACT_ID),
      { fee: "100", networkPassphrase: config.networkPassphrase }
    )
      .addOperation(contract.call("market_count"))
      .setTimeout(30)
      .build();

    const sim = await rpc.simulateTransaction(tx);
    if (StellarSdk.rpc.Api.isSimulationError(sim)) return 0;
    if (!sim.result?.retval) return 0;
    return Number(StellarSdk.scValToNative(sim.result.retval));
  } catch {
    return 0;
  }
}

export async function getUserPosition(
  marketId: number,
  address: string
): Promise<ParsedPosition | null> {
  try {
    const ledgerKey = StellarSdk.xdr.LedgerKey.contractData(
      new StellarSdk.xdr.LedgerKeyContractData({
        contract: new StellarSdk.Address(CONTRACT_ID).toScAddress(),
        key: StellarSdk.xdr.ScVal.scvVec([
          StellarSdk.xdr.ScVal.scvSymbol("Position"),
          StellarSdk.nativeToScVal(marketId, { type: "u64" }),
          new StellarSdk.Address(address).toScVal(),
        ]),
        durability: StellarSdk.xdr.ContractDataDurability.persistent(),
      })
    );

    const entries = await rpc.getLedgerEntries(ledgerKey);
    if (!entries.entries.length) return null;

    const raw = StellarSdk.scValToNative(entries.entries[0].val.contractData().val()) as Position;
    return {
      yes: stroopToUSDC(raw.yes),
      no: stroopToUSDC(raw.no),
      spent: stroopToUSDC(raw.spent),
    };
  } catch {
    return null;
  }
}

export async function getUserLpShares(
  marketId: number,
  address: string
): Promise<number> {
  try {
    const ledgerKey = StellarSdk.xdr.LedgerKey.contractData(
      new StellarSdk.xdr.LedgerKeyContractData({
        contract: new StellarSdk.Address(CONTRACT_ID).toScAddress(),
        key: StellarSdk.xdr.ScVal.scvVec([
          StellarSdk.xdr.ScVal.scvSymbol("LpShares"),
          StellarSdk.nativeToScVal(marketId, { type: "u64" }),
          new StellarSdk.Address(address).toScVal(),
        ]),
        durability: StellarSdk.xdr.ContractDataDurability.persistent(),
      })
    );

    const entries = await rpc.getLedgerEntries(ledgerKey);
    if (!entries.entries.length) return 0;

    const raw = StellarSdk.scValToNative(entries.entries[0].val.contractData().val()) as bigint;
    return Number(raw);
  } catch {
    return 0;
  }
}

// --- Write helpers (build XDR for wallet signing) ---
//
// Contract signatures (lib.rs):
//   buy(env, market_id: u64, from: Address, buy_yes: bool, amount_in: i128, min_shares_out: i128)
//   sell(env, market_id: u64, from: Address, sell_yes: bool, shares_in: i128, min_amount_out: i128)
//   claim(env, market_id: u64, user: Address)
//   claim_lp(env, market_id: u64, user: Address)
//   add_liquidity(env, market_id: u64, from: Address, amount: i128)
//   remove_liquidity(env, market_id: u64, from: Address, lp_amount: i128)

export async function buildBuyTx(
  sourceAddress: string,
  marketId: number,
  collateralIn: bigint,
  minSharesOut: bigint,
  buyYes: boolean
): Promise<string> {
  const account = await rpc.getAccount(sourceAddress);
  const contract = new StellarSdk.Contract(CONTRACT_ID);

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      contract.call(
        "buy",
        StellarSdk.nativeToScVal(marketId, { type: "u64" }),      // market_id first
        new StellarSdk.Address(sourceAddress).toScVal(),            // from
        StellarSdk.xdr.ScVal.scvBool(buyYes),                      // buy_yes: bool
        StellarSdk.nativeToScVal(collateralIn, { type: "i128" }),  // amount_in
        StellarSdk.nativeToScVal(minSharesOut, { type: "i128" })   // min_shares_out
      )
    )
    .setTimeout(180)
    .build();

  const sim = await rpc.simulateTransaction(tx);
  if (StellarSdk.rpc.Api.isSimulationError(sim)) {
    throw new Error(`Simulation failed: ${sim.error}`);
  }

  return StellarSdk.rpc.assembleTransaction(tx, sim).build().toXDR();
}

export async function buildSellTx(
  sourceAddress: string,
  marketId: number,
  sharesIn: bigint,
  minCollateralOut: bigint,
  sellYes: boolean
): Promise<string> {
  const account = await rpc.getAccount(sourceAddress);
  const contract = new StellarSdk.Contract(CONTRACT_ID);

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      contract.call(
        "sell",
        StellarSdk.nativeToScVal(marketId, { type: "u64" }),           // market_id first
        new StellarSdk.Address(sourceAddress).toScVal(),                 // from
        StellarSdk.xdr.ScVal.scvBool(sellYes),                          // sell_yes: bool
        StellarSdk.nativeToScVal(sharesIn, { type: "i128" }),           // shares_in
        StellarSdk.nativeToScVal(minCollateralOut, { type: "i128" })    // min_amount_out
      )
    )
    .setTimeout(180)
    .build();

  const sim = await rpc.simulateTransaction(tx);
  if (StellarSdk.rpc.Api.isSimulationError(sim)) {
    throw new Error(`Simulation failed: ${sim.error}`);
  }

  return StellarSdk.rpc.assembleTransaction(tx, sim).build().toXDR();
}

export async function buildClaimTx(
  sourceAddress: string,
  marketId: number
): Promise<string> {
  const account = await rpc.getAccount(sourceAddress);
  const contract = new StellarSdk.Contract(CONTRACT_ID);

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      contract.call(
        "claim",
        StellarSdk.nativeToScVal(marketId, { type: "u64" }),  // market_id first
        new StellarSdk.Address(sourceAddress).toScVal()          // user
      )
    )
    .setTimeout(180)
    .build();

  const sim = await rpc.simulateTransaction(tx);
  if (StellarSdk.rpc.Api.isSimulationError(sim)) {
    throw new Error(`Simulation failed: ${sim.error}`);
  }

  return StellarSdk.rpc.assembleTransaction(tx, sim).build().toXDR();
}

export async function buildClaimLpTx(
  sourceAddress: string,
  marketId: number
): Promise<string> {
  const account = await rpc.getAccount(sourceAddress);
  const contract = new StellarSdk.Contract(CONTRACT_ID);

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      contract.call(
        "claim_lp",
        StellarSdk.nativeToScVal(marketId, { type: "u64" }),  // market_id first
        new StellarSdk.Address(sourceAddress).toScVal()          // user
      )
    )
    .setTimeout(180)
    .build();

  const sim = await rpc.simulateTransaction(tx);
  if (StellarSdk.rpc.Api.isSimulationError(sim)) {
    throw new Error(`Simulation failed: ${sim.error}`);
  }

  return StellarSdk.rpc.assembleTransaction(tx, sim).build().toXDR();
}

export async function buildAddLiquidityTx(
  sourceAddress: string,
  marketId: number,
  amount: bigint
): Promise<string> {
  const account = await rpc.getAccount(sourceAddress);
  const contract = new StellarSdk.Contract(CONTRACT_ID);

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      contract.call(
        "add_liquidity",
        StellarSdk.nativeToScVal(marketId, { type: "u64" }),  // market_id first
        new StellarSdk.Address(sourceAddress).toScVal(),        // from
        StellarSdk.nativeToScVal(amount, { type: "i128" })     // amount (no minSharesOut)
      )
    )
    .setTimeout(180)
    .build();

  const sim = await rpc.simulateTransaction(tx);
  if (StellarSdk.rpc.Api.isSimulationError(sim)) {
    throw new Error(`Simulation failed: ${sim.error}`);
  }

  return StellarSdk.rpc.assembleTransaction(tx, sim).build().toXDR();
}

export async function buildRemoveLiquidityTx(
  sourceAddress: string,
  marketId: number,
  lpAmount: bigint
): Promise<string> {
  const account = await rpc.getAccount(sourceAddress);
  const contract = new StellarSdk.Contract(CONTRACT_ID);

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      contract.call(
        "remove_liquidity",
        StellarSdk.nativeToScVal(marketId, { type: "u64" }),  // market_id first
        new StellarSdk.Address(sourceAddress).toScVal(),        // from
        StellarSdk.nativeToScVal(lpAmount, { type: "i128" })   // lp_amount (no minCollateralOut)
      )
    )
    .setTimeout(180)
    .build();

  const sim = await rpc.simulateTransaction(tx);
  if (StellarSdk.rpc.Api.isSimulationError(sim)) {
    throw new Error(`Simulation failed: ${sim.error}`);
  }

  return StellarSdk.rpc.assembleTransaction(tx, sim).build().toXDR();
}

// --- Submit ---

export async function submitSignedTx(signedXdr: string): Promise<{ hash: string }> {
  const tx = StellarSdk.TransactionBuilder.fromXDR(
    signedXdr,
    config.networkPassphrase
  ) as StellarSdk.Transaction;

  const response = await rpc.sendTransaction(tx);
  if (response.status === "ERROR") {
    throw new Error(`Transaction failed: ${response.errorResult}`);
  }

  const MAX_POLL_MS = 30_000;
  const POLL_INTERVAL_MS = 1_000;
  const deadline = Date.now() + MAX_POLL_MS;

  let getResponse = await rpc.getTransaction(response.hash);
  while (getResponse.status === "NOT_FOUND") {
    if (Date.now() > deadline) {
      throw new Error(`Transaction timed out after ${MAX_POLL_MS / 1000}s (hash: ${response.hash})`);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    getResponse = await rpc.getTransaction(response.hash);
  }

  if (getResponse.status === "SUCCESS") {
    return { hash: response.hash };
  }

  throw new Error(`Transaction failed: ${getResponse.status}`);
}

// --- Helpers ---

function parseMarket(raw: Market): ParsedMarket {
  return {
    id: Number(raw.id),
    question: raw.question,
    category: raw.category,
    criteriaRef: raw.criteria_ref,
    lockTime: new Date(Number(raw.lock_time) * 1000),
    resolveTime: new Date(Number(raw.resolve_time) * 1000),
    disputeWindow: Number(raw.dispute_window),
    positionCap: Number(stroopToUSDC(raw.position_cap)),
    bond: stroopToUSDC(raw.bond),
    state: raw.state,
    yesReserve: stroopToUSDC(raw.yes_reserve),
    noReserve: stroopToUSDC(raw.no_reserve),
    totalLpShares: Number(raw.total_lp_shares),
    lpFeesAccrued: stroopToUSDC(raw.lp_fees_accrued),
    collateralLocked: stroopToUSDC(raw.collateral_locked),
    proposer: raw.proposer,
    proposedOutcome: raw.proposed_outcome,
    proposalTime: new Date(Number(raw.proposal_time) * 1000),
    disputer: raw.disputer,
    outcome: raw.outcome,
    poolPayoutTotal: stroopToUSDC(raw.pool_payout_total),
  };
}

export function yesPriceBps(market: ParsedMarket): number {
  const total = market.yesReserve + market.noReserve;
  if (total === 0) return 5000;
  return Math.round((market.yesReserve / total) * 10000);
}

export function stateLabel(state: MarketState): string {
  switch (state) {
    case MarketState.Open: return "Open";
    case MarketState.Proposed: return "Proposed";
    case MarketState.Disputed: return "Disputed";
    case MarketState.Resolved: return "Resolved";
  }
}

export function outcomeLabel(outcome: Outcome | null): string {
  if (outcome === null) return "—";
  switch (outcome) {
    case Outcome.Yes: return "Yes";
    case Outcome.No: return "No";
    case Outcome.Void: return "Void";
  }
}
