import { MarketState, Outcome, ParsedMarket, ParsedPosition } from "@/lib/types";

export function cidFromRef(ref: string | null | undefined) {
  if (!ref) return "";
  return ref.replace(/^ipfs:\/\//, "").replace(/^\/ipfs\//, "");
}

export function ipfsGatewayUrl(ref: string | null | undefined) {
  const cid = cidFromRef(ref);
  return cid ? `https://gateway.pinata.cloud/ipfs/${cid}` : "";
}

export function stateLabel(state: MarketState) {
  switch (state) {
    case MarketState.Open:
      return "Open";
    case MarketState.Proposed:
      return "Proposed";
    case MarketState.Disputed:
      return "Disputed";
    case MarketState.Resolved:
      return "Resolved";
  }
}

export function outcomeLabel(outcome: Outcome | null) {
  switch (outcome) {
    case Outcome.Yes:
      return "YES";
    case Outcome.No:
      return "NO";
    case Outcome.Void:
      return "Void";
    default:
      return "None";
  }
}

export function formatUSDC(value: number, digits = 2) {
  return `${value.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  })} USDC`;
}

export function formatPriceFromBps(bps: number) {
  const cents = bps / 100;
  return {
    cents: `${cents.toFixed(1)}c`,
    percent: `${cents.toFixed(1)}%`,
  };
}

export function countdownLabel(market: ParsedMarket, now = new Date()) {
  const target = market.state === MarketState.Open ? market.lockTime : market.resolveTime;
  const prefix = market.state === MarketState.Open ? "Locks" : "Resolve";
  const diffMs = target.getTime() - now.getTime();

  if (diffMs <= 0) return `${prefix} time passed`;

  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (days > 0) return `${prefix} in ${days}d ${hours}h`;
  if (hours > 0) return `${prefix} in ${hours}h ${minutes}m`;
  return `${prefix} in ${minutes}m`;
}

export function holdsWinningShares(position: ParsedPosition | null, outcome: Outcome | null) {
  if (!position) return false;
  if (outcome === Outcome.Yes) return position.yes > 0;
  if (outcome === Outcome.No) return position.no > 0;
  if (outcome === Outcome.Void) return position.yes > 0 || position.no > 0;
  return false;
}

export function humanizeContractError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (lower.includes("tradinglocked") || lower.includes("#8") || lower.includes("trading locked")) {
    return "trading is closed for this market";
  }

  if (lower.includes("slippage") || lower.includes("#20")) {
    return "price moved, try again";
  }

  if (lower.includes("user declined") || lower.includes("rejected") || lower.includes("denied")) {
    return "transaction was rejected in your wallet";
  }

  if (lower.includes("tx_insufficient_fee") || lower.includes("insufficient balance")) {
    return "your wallet needs testnet XLM for fees";
  }

  if (isArchivedEntryError(error)) {
    return "your position needs to be restored before claiming";
  }

  return message || "Something went wrong";
}

export function isArchivedEntryError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  return lower.includes("restore") || lower.includes("archiv") || lower.includes("expired");
}
