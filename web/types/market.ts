export type MarketState = "Open" | "Proposed" | "Disputed" | "Resolved";
export type Outcome = "Yes" | "No" | "Void";

export type Market = {
  id: number;
  question: string;
  category: string;
  criteriaRef: string;
  lockTime: number;
  resolveTime: number;
  disputeWindow: number;
  positionCap: bigint;
  bond: bigint;
  state: MarketState;
  yesReserve: bigint;
  noReserve: bigint;
  totalLpShares: bigint;
  lpFeesAccrued: bigint;
  collateralLocked: bigint;
  proposer?: string;
  proposedOutcome?: Outcome;
  proposalTime: number;
  disputer?: string;
  outcome?: Outcome;
  poolPayoutTotal: bigint;
  yesPriceBps: bigint;
};

export type Position = { yes: bigint; no: bigint; spent: bigint };

export type Loan = {
  yesCollateral: bigint;
  noCollateral: bigint;
  cashCollateral: bigint;
  debt: bigint;
  openedAt: number;
};
