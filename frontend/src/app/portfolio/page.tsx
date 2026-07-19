"use client";

import { useState, useEffect } from "react";
import { useFreighter } from "@/hooks/useFreighter";
import { getMarketCount, getMarket, getUserPosition, getUserLpShares } from "@/lib/contract";
import { ParsedMarket, ParsedPosition, MarketState } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

interface PortfolioEntry {
  market: ParsedMarket;
  position: ParsedPosition;
  lpShares: number;
}

export default function PortfolioPage() {
  const { connected, address } = useFreighter();
  const [entries, setEntries] = useState<PortfolioEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPortfolio = async () => {
    if (!address) return;
    setLoading(true);
    try {
      const count = await getMarketCount();
      const portfolio: PortfolioEntry[] = [];

      for (let i = 0; i < count; i++) {
        const market = await getMarket(i);
        if (!market) continue;

        const position = await getUserPosition(i, address);
        const lpShares = await getUserLpShares(i, address);

        if (
          (position && (position.yes > 0 || position.no > 0)) ||
          lpShares > 0
        ) {
          portfolio.push({ market, position: position || { yes: 0, no: 0, spent: 0 }, lpShares });
        }
      }

      setEntries(portfolio);
    } catch (err) {
      console.error("Failed to load portfolio:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (address) {
      void (async () => {
        await loadPortfolio();
      })();
    }
  }, [address]);

  if (!connected) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12 text-muted-foreground">
          Connect your Freighter wallet to view your portfolio.
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Your Portfolio</h1>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-40 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No positions found. Start trading on a market!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {entries.map(({ market, position, lpShares }) => (
            <Link key={market.id} href={`/market/${market.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-tight line-clamp-2">
                      {market.question}
                    </CardTitle>
                    <Badge variant="outline">
                      {market.state === MarketState.Resolved ? "Resolved" : "Active"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(position.yes > 0 || position.no > 0) && (
                    <div className="flex gap-4 text-sm">
                      {position.yes > 0 && (
                        <span className="text-green-500">
                          YES: {position.yes.toFixed(2)}
                        </span>
                      )}
                      {position.no > 0 && (
                        <span className="text-red-500">
                          NO: {position.no.toFixed(2)}
                        </span>
                      )}
                    </div>
                  )}
                  {lpShares > 0 && (
                    <div className="text-sm text-muted-foreground">
                      LP: {lpShares.toLocaleString()} shares
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    Spent: {position.spent.toFixed(2)} USDC
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
