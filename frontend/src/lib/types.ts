// Market state machine
export enum MarketState {
  Open = 0,
  Proposed = 1,
  Disputed = 2,
  Resolved = 3,
}

export enum Outcome {
  Yes = 0,
  No = 1,
  Void = 2,
}

export interface Market {
  id: bigint;
  question: string;
  category: string;
  criteria_ref: string;
  lock_time: bigint;
  resolve_time: bigint;
  dispute_window: bigint;
  position_cap: bigint;
  bond: bigint;
  state: MarketState;
  yes_reserve: bigint;
  no_reserve: bigint;
  total_lp_shares: bigint;
  lp_fees_accrued: bigint;
  collateral_locked: bigint;
  proposer: string;
  proposed_outcome: Outcome | null;
  proposal_time: bigint;
  disputer: string;
  outcome: Outcome | null;
  pool_payout_total: bigint;
}

export interface Position {
  yes: bigint;
  no: bigint;
  spent: bigint;
}

export interface LPShares {
  shares: bigint;
}

// Parsed market for UI (stroops → USDC)
export interface ParsedMarket {
  id: number;
  question: string;
  category: string;
  criteriaRef: string;
  lockTime: Date;
  resolveTime: Date;
  disputeWindow: number;
  positionCap: number;
  bond: number;
  state: MarketState;
  yesReserve: number;
  noReserve: number;
  totalLpShares: number;
  lpFeesAccrued: number;
  collateralLocked: number;
  proposer: string;
  proposedOutcome: Outcome | null;
  proposalTime: Date;
  disputer: string;
  outcome: Outcome | null;
  poolPayoutTotal: number;
}

export interface ParsedPosition {
  yes: number;
  no: number;
  spent: number;
}
