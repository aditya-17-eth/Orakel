"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Medal, RefreshCw, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMarketsFromContract } from "@/lib/contract";
import { outcomeLabel } from "@/lib/format";
import { MarketState, Outcome, ParsedMarket } from "@/lib/types";
import { cn } from "@/lib/utils";

// Note: True on-chain leaderboard requires event indexing.
// This page scans all resolved markets and their top proposers as a proxy
// for engagement — a lightweight MVP until the indexer is live.

interface LeaderEntry {
  address: string;
  resolvedCorrectly: number;
  totalProposed: number;
  category: string;
}

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <span className="inline-flex size-7 items-center justify-center rounded-full bg-yellow-500/20 text-yellow-400">
        <Trophy className="size-4" />
      </span>
    );
  if (rank === 2)
    return (
      <span className="inline-flex size-7 items-center justify-center rounded-full bg-slate-400/20 text-slate-300">
        <Medal className="size-4" />
      </span>
    );
  if (rank === 3)
    return (
      <span className="inline-flex size-7 items-center justify-center rounded-full bg-amber-700/20 text-amber-600">
        <Medal className="size-4" />
      </span>
    );
  return (
    <span className="inline-flex size-7 items-center justify-center rounded-full bg-muted text-muted-foreground text-xs font-medium">
      {rank}
    </span>
  );
}

function ResolvedMarketRow({ market }: { market: ParsedMarket }) {
  return (
    <Link href={`/markets/${market.id}`} className="block">
      <div className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm transition-colors hover:bg-muted/30">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-xs">{market.category}</Badge>
          </div>
          <div className="truncate text-sm">{market.question}</div>
        </div>
        <div className="shrink-0 text-right space-y-0.5">
          <div className="text-xs text-muted-foreground">Outcome</div>
          <div
            className={cn(
              "text-sm font-medium",
              market.outcome === Outcome.Yes && "text-emerald-400",
              market.outcome === Outcome.No && "text-red-400",
              market.outcome === Outcome.Void && "text-muted-foreground",
            )}
          >
            {outcomeLabel(market.outcome)}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function LeaderboardPage() {
  const [leaders, setLeaders] = useState<LeaderEntry[]>([]);
  const [resolvedMarkets, setResolvedMarkets] = useState<ParsedMarket[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      const markets = await getMarketsFromContract();
      const resolved = markets.filter((m) => m.state === MarketState.Resolved);
      setResolvedMarkets(resolved);

      // Build proposer leaderboard from resolved markets
      const proposerMap = new Map<string, LeaderEntry>();

      for (const market of resolved) {
        if (!market.proposer) continue;
        const addr = market.proposer;
        const existing = proposerMap.get(addr) ?? {
          address: addr,
          resolvedCorrectly: 0,
          totalProposed: 0,
          category: market.category,
        };
        existing.totalProposed += 1;
        if (market.proposedOutcome !== null && market.proposedOutcome === market.outcome) {
          existing.resolvedCorrectly += 1;
        }
        proposerMap.set(addr, existing);
      }

      const sorted = Array.from(proposerMap.values()).sort(
        (a, b) => b.resolvedCorrectly - a.resolvedCorrectly || b.totalProposed - a.totalProposed,
      );

      setLeaders(sorted);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void loadLeaderboard());
  }, [loadLeaderboard]);

  return (
    <div className="container mx-auto space-y-8 px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Leaderboard</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Top proposers by correct resolutions on Orakel.
          </p>
        </div>
        <Button variant="outline" onClick={loadLeaderboard} disabled={loading}>
          <RefreshCw className={loading ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Proposer rankings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Proposer Rankings</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Ranked by correct resolutions. Proposers stake bond to report outcomes.
            </p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
                ))}
              </div>
            ) : leaders.length === 0 ? (
              <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
                No resolved markets with proposers yet.
              </div>
            ) : (
              <div className="space-y-2">
                {leaders.map((leader, index) => {
                  const accuracy =
                    leader.totalProposed > 0
                      ? Math.round((leader.resolvedCorrectly / leader.totalProposed) * 100)
                      : 0;

                  return (
                    <div
                      key={leader.address}
                      className="flex items-center gap-3 rounded-lg border p-3 text-sm"
                    >
                      <RankBadge rank={index + 1} />
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-xs text-muted-foreground truncate">
                          {shortenAddress(leader.address)}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-emerald-400 text-xs font-medium">
                            {leader.resolvedCorrectly} correct
                          </span>
                          <span className="text-muted-foreground text-xs">
                            {leader.totalProposed} total
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div
                          className={cn(
                            "text-sm font-semibold",
                            accuracy >= 80 && "text-emerald-400",
                            accuracy >= 50 && accuracy < 80 && "text-yellow-400",
                            accuracy < 50 && "text-red-400",
                          )}
                        >
                          {accuracy}%
                        </div>
                        <div className="text-xs text-muted-foreground">accuracy</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recently resolved markets */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground text-xs">Resolved markets</div>
                  <div className="font-semibold text-2xl">{resolvedMarkets.length}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">Unique proposers</div>
                  <div className="font-semibold text-2xl">{leaders.length}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">YES outcomes</div>
                  <div className="font-semibold text-emerald-400">
                    {resolvedMarkets.filter((m) => m.outcome === Outcome.Yes).length}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">NO outcomes</div>
                  <div className="font-semibold text-red-400">
                    {resolvedMarkets.filter((m) => m.outcome === Outcome.No).length}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recently Resolved</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
                  ))}
                </div>
              ) : resolvedMarkets.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-4">
                  No resolved markets yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {resolvedMarkets.slice(-5).reverse().map((market) => (
                    <ResolvedMarketRow key={market.id} market={market} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
