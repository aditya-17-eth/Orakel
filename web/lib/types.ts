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
  proposer: string | null;
  proposedOutcome: Outcome | null;
  proposalTime: Date | null;
  disputer: string | null;
  outcome: Outcome | null;
  poolPayoutTotal: number;
  yesPriceBps: number;
}

export interface ParsedPosition {
  yes: number;
  no: number;
  spent: number;
}

export interface ParsedLoan {
  yesCollateral: number;
  noCollateral: number;
  cashCollateral: number;
  debt: number;
  openedAt: Date | null;
}

export interface ContractQuote {
  amountIn: number;
  quotedOut: number;
  effectivePrice: number;
  minOut: number;
}

export interface BackendMarketDetail {
  id?: number;
  criteria_cid?: string;
  criteriaRef?: string;
  evidence_cid?: string;
  evidenceCid?: string;
  proposed_outcome?: string | number | null;
}
