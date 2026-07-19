"use client";

import Link from "next/link";
import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { countdownLabel, formatPriceFromBps, stateLabel } from "@/lib/format";
import { MarketState, ParsedMarket } from "@/lib/types";
import { cn } from "@/lib/utils";

export function MarketCard({ market }: { market: ParsedMarket }) {
  const price = formatPriceFromBps(market.yesPriceBps);

  return (
    <Link href={`/markets/${market.id}`}>
      <Card className="h-full transition-colors hover:bg-muted/40">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <Badge variant="outline">{market.category}</Badge>
            <Badge
              variant="outline"
              className={cn(
                market.state === MarketState.Open && "border-emerald-500/40 text-emerald-400",
                market.state === MarketState.Proposed && "border-yellow-500/40 text-yellow-400",
                market.state === MarketState.Disputed && "border-red-500/40 text-red-400",
              )}
            >
              {stateLabel(market.state)}
            </Badge>
          </div>
          <CardTitle className="text-base leading-snug">{market.question}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-end justify-between">
            <span className="text-muted-foreground">YES price</span>
            <span className="font-medium">
              {price.cents} / {price.percent}
            </span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="size-4" />
            {countdownLabel(market)}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
