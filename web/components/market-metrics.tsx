import type { Market } from "@/types/market";
import { formatStroops, shortAddress } from "@/lib/utils";
import { Card } from "@/components/ui";

export function MarketMetrics({ market }: { market: Market }) {
  const rows = [
    ["YES reserve", formatStroops(market.yesReserve)],
    ["NO reserve", formatStroops(market.noReserve)],
    ["LP shares", formatStroops(market.totalLpShares)],
    ["LP fees", formatStroops(market.lpFeesAccrued)],
    ["Collateral locked", formatStroops(market.collateralLocked)],
    ["Position cap", formatStroops(market.positionCap)],
    ["Resolution bond", formatStroops(market.bond)],
    ["Dispute window", `${market.disputeWindow}s`],
    ["Pool payout", formatStroops(market.poolPayoutTotal)],
    ["Final outcome", market.outcome ?? "Pending"],
    ["Proposer", market.proposer ? shortAddress(market.proposer) : "—"],
    ["Disputer", market.disputer ? shortAddress(market.disputer) : "—"],
  ];
  return <Card className="p-6"><h2 className="font-semibold">On-chain market data</h2><div className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">{rows.map(([label, value]) => <div key={label} className="flex items-center justify-between gap-4 border-b border-card-border/70 pb-2 text-sm"><span className="text-text-muted">{label}</span><span className="font-mono text-right">{value}</span></div>)}</div></Card>;
}
