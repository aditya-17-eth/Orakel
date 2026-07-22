"use client";

import { MarketState, ParsedMarket } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { stateLabel, yesPriceBps } from "@/lib/contract";
import Link from "next/link";

function stateColor(state: MarketState) {
  switch (state) {
    case MarketState.Open: return "bg-green-500/10 text-green-500 border-green-500/20";
    case MarketState.Proposed: return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
    case MarketState.Disputed: return "bg-red-500/10 text-red-500 border-red-500/20";
    case MarketState.Resolved: return "bg-gray-500/10 text-gray-500 border-gray-500/20";
  }
}

export function MarketCard({ market }: { market: ParsedMarket }) {
  const yesPrice = yesPriceBps(market) / 100;
  const noPrice = 100 - yesPrice;

  return (
    <Link href={`/market/${market.id}`}>
      <Card className="hover:border-primary/50 transition-colors cursor-pointer">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base leading-tight line-clamp-2">
              {market.question}
            </CardTitle>
            <Badge variant="outline" className={stateColor(market.state)}>
              {stateLabel(market.state)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{market.category}</span>
            <div className="flex gap-3">
              <span className="text-green-500 font-medium">
                YES {yesPrice.toFixed(0)}%
              </span>
              <span className="text-red-500 font-medium">
                NO {noPrice.toFixed(0)}%
              </span>
            </div>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Pool: {market.collateralLocked.toLocaleString()} USDC
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
