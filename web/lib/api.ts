import { contractAmountToUSDC } from "@/lib/stellar";
import { MarketState, Outcome, ParsedLoan, ParsedMarket, ParsedPosition } from "@/lib/types";

interface ApiErrorBody { error?: string }

interface MarketsResponse {
  markets: SerializedMarket[];
  network: string;
}

interface MarketResponse {
  market: SerializedMarket;
  position?: unknown;
  lp?: string;
  criteriaGateway?: string | null;
  network: string;
}

type SerializedMarket = Record<string, unknown>;

export interface LeaderboardEntry {
  wallet: string;
  volume: number;
  trades: number;
}

export interface ContractEvent {
  event_id?: string;
  id?: number;
  ledger: number;
  tx_hash: string;
  name: string;
  topics: unknown;
  data: unknown;
  ledger_closed_at: string | null;
}

export interface PortfolioMarket {
  market: ParsedMarket;
  position: ParsedPosition;
  lpShares: number;
  loan: ParsedLoan;
  markValue: number;
  claimable: number;
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { cache: "no-store" });
  const body = (await response.json().catch(() => ({}))) as T & ApiErrorBody;
  if (!response.ok) throw new Error(body.error || `Request failed with status ${response.status}.`);
  return body;
}

function numberValue(value: unknown) {
  return Number(value ?? 0);
}

function amountValue(value: unknown) {
  return contractAmountToUSDC(value as bigint | number | string | null | undefined);
}

function parseState(value: unknown) {
  const normalized = String(value ?? "Open").toLowerCase();
  if (normalized.includes("proposed") || normalized === "1") return MarketState.Proposed;
  if (normalized.includes("disputed") || normalized === "2") return MarketState.Disputed;
  if (normalized.includes("resolved") || normalized === "3") return MarketState.Resolved;
  return MarketState.Open;
}

function parseOutcome(value: unknown): Outcome | null {
  if (value === null || value === undefined || value === "") return null;
  const normalized = String(value).toLowerCase();
  if (normalized.includes("yes") || normalized === "0") return Outcome.Yes;
  if (normalized.includes("no") || normalized === "1") return Outcome.No;
  if (normalized.includes("void") || normalized === "2") return Outcome.Void;
  return null;
}

export function parseApiMarket(raw: SerializedMarket): ParsedMarket {
  const lockTime = numberValue(raw.lockTime ?? raw.lock_time);
  const resolveTime = numberValue(raw.resolveTime ?? raw.resolve_time);
  const proposalTime = numberValue(raw.proposalTime ?? raw.proposal_time);
  return {
    id: numberValue(raw.id),
    question: String(raw.question || "Untitled market"),
    category: String(raw.category || "general"),
    criteriaRef: String(raw.criteriaRef ?? raw.criteria_ref ?? ""),
    lockTime: new Date(lockTime * 1000),
    resolveTime: new Date(resolveTime * 1000),
    disputeWindow: numberValue(raw.disputeWindow ?? raw.dispute_window),
    positionCap: amountValue(raw.positionCap ?? raw.position_cap),
    bond: amountValue(raw.bond),
    state: parseState(raw.state),
    yesReserve: amountValue(raw.yesReserve ?? raw.yes_reserve),
    noReserve: amountValue(raw.noReserve ?? raw.no_reserve),
    totalLpShares: amountValue(raw.totalLpShares ?? raw.total_lp_shares),
    lpFeesAccrued: amountValue(raw.lpFeesAccrued ?? raw.lp_fees_accrued),
    collateralLocked: amountValue(raw.collateralLocked ?? raw.collateral_locked),
    proposer: raw.proposer ? String(raw.proposer) : null,
    proposedOutcome: parseOutcome(raw.proposedOutcome ?? raw.proposed_outcome),
    proposalTime: proposalTime > 0 ? new Date(proposalTime * 1000) : null,
    disputer: raw.disputer ? String(raw.disputer) : null,
    outcome: parseOutcome(raw.outcome),
    poolPayoutTotal: amountValue(raw.poolPayoutTotal ?? raw.pool_payout_total),
    yesPriceBps: numberValue(raw.yesPriceBps ?? raw.yes_price_bps),
  };
}

export async function getBackendMarkets() {
  const response = await getJson<MarketsResponse>("/api/markets");
  return response.markets.map(parseApiMarket).sort((a, b) => b.id - a.id);
}

export async function getBackendMarket(id: number) {
  const response = await getJson<MarketResponse>(`/api/markets/${id}`);
  return { ...response, parsedMarket: parseApiMarket(response.market) };
}

export async function getBackendEvents(limit = 50) {
  return getJson<{ events: ContractEvent[] }>(`/api/events?limit=${limit}`);
}

export async function getBackendActivity(wallet: string, limit = 50) {
  return getJson<{ events: ContractEvent[] }>(`/api/activity?wallet=${encodeURIComponent(wallet)}&limit=${limit}`);
}

export async function getBackendLeaderboard() {
  return getJson<{ entries: Record<string, unknown>[] }>("/api/leaderboard");
}

export async function getBackendPortfolio(wallet: string): Promise<PortfolioMarket[]> {
  const response = await getJson<{ positions: Array<Record<string, unknown>> }>(`/api/portfolio?wallet=${encodeURIComponent(wallet)}`);
  return response.positions.map((row) => {
    const position = row.position as Record<string, unknown>;
    const loan = row.loan as Record<string, unknown>;
    const openedAt = numberValue(loan.openedAt ?? loan.opened_at);
    return {
      market: parseApiMarket(row.market as SerializedMarket),
      position: { yes: amountValue(position.yes), no: amountValue(position.no), spent: amountValue(position.spent) },
      lpShares: amountValue(row.lpShares ?? row.lp_shares),
      loan: {
        yesCollateral: amountValue(loan.yesCollateral ?? loan.yes_collateral),
        noCollateral: amountValue(loan.noCollateral ?? loan.no_collateral),
        cashCollateral: amountValue(loan.cashCollateral ?? loan.cash_collateral),
        debt: amountValue(loan.debt),
        openedAt: openedAt > 0 ? new Date(openedAt * 1000) : null,
      },
      markValue: amountValue(row.markValue ?? row.mark_value),
      claimable: amountValue(row.claimable),
    };
  });
}

export async function getMarketPriceHistory(marketId: number) {
  return getJson<{ points: Array<{ time: number; priceBps: number }> }>(`/api/markets/${marketId}/history`);
}

export async function requestFaucet(wallet: string) {
  const response = await fetch("/api/faucet", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ wallet }),
  });
  const body = (await response.json().catch(() => ({}))) as { funded?: boolean; error?: string; nextAvailableAt?: string };
  if (!response.ok) throw new Error(body.error || `Faucet request failed with status ${response.status}.`);
  return body;
}

export function getBackendCriteria(cid: string) {
  return fetch(`/api/criteria/${encodeURIComponent(cid)}`, { cache: "no-store" });
}

export function getBackendHealth() {
  return getJson<{ ok?: boolean; status?: string }>("/api/health");
}
