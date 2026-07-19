"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Medal, RefreshCw, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getBackendLeaderboard, getBackendMarkets } from "@/lib/api";
import { formatUSDC, outcomeLabel } from "@/lib/format";
import { MarketState, Outcome, ParsedMarket } from "@/lib/types";
import { cn } from "@/lib/utils";

interface LeaderEntry { rank: number; wallet: string; volume: number; trades: number; markets: number }

function shortAddress(address: string) { return `${address.slice(0, 6)}...${address.slice(-4)}`; }

function Rank({ value }: { value: number }) {
  if (value === 1) return <span className="flex size-8 items-center justify-center rounded-full bg-yellow-500/15 text-yellow-400"><Trophy className="size-4" /></span>;
  if (value <= 3) return <span className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground"><Medal className="size-4" /></span>;
  return <span className="flex size-8 items-center justify-center rounded-full bg-muted font-mono text-xs">{value}</span>;
}

export default function LeaderboardPage() {
  const [leaders, setLeaders] = useState<LeaderEntry[]>([]);
  const [resolved, setResolved] = useState<ParsedMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [leaderResult, marketResult] = await Promise.allSettled([getBackendLeaderboard(), getBackendMarkets()]);
    if (leaderResult.status === "fulfilled") {
      setLeaders(leaderResult.value.entries.map((entry, index) => ({
        rank: Number(entry.rank ?? index + 1),
        wallet: String(entry.wallet ?? ""),
        volume: Number(entry.volume ?? 0) / 10_000_000,
        trades: Number(entry.trades ?? 0),
        markets: Number(entry.markets ?? 0),
      })).filter(({ wallet }) => wallet.length > 0));
    } else {
      setLeaders([]);
      setError("Trading rankings are waiting for the production indexer connection.");
    }
    if (marketResult.status === "fulfilled") setResolved(marketResult.value.filter(({ state }) => state === MarketState.Resolved));
    setLoading(false);
  }, []);

  useEffect(() => { queueMicrotask(() => void load()); }, [load]);

  return <div className="container mx-auto space-y-8 px-4 py-8">
    <div className="flex items-end justify-between gap-3"><div><h1 className="text-2xl font-semibold">Leaderboard</h1><p className="mt-1 text-sm text-muted-foreground">Ranked by indexed trading volume across the Testnet contract.</p></div><Button variant="outline" onClick={load} disabled={loading}><RefreshCw className={loading ? "animate-spin" : ""} /> Refresh</Button></div>
    {error && <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3 text-sm text-yellow-400">{error}</div>}
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card><CardHeader><CardTitle className="text-base">Top traders</CardTitle><p className="text-xs text-muted-foreground">Buy and sell volume indexed from Soroban events.</p></CardHeader><CardContent>
        {loading ? <div className="space-y-2">{[0,1,2,3].map((id) => <div key={id} className="h-16 animate-pulse rounded-lg bg-muted" />)}</div> : leaders.length === 0 ? <div className="rounded-lg border p-10 text-center text-sm text-muted-foreground">No indexed trades yet.</div> : <div className="divide-y">{leaders.map((leader) => <div key={leader.wallet} className="flex items-center gap-3 py-4"><Rank value={leader.rank} /><div className="min-w-0 flex-1"><a href={`https://stellar.expert/explorer/testnet/account/${leader.wallet}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-sm hover:underline">{shortAddress(leader.wallet)} <ExternalLink className="size-3" /></a><div className="mt-1 text-xs text-muted-foreground">{leader.trades} trades · {leader.markets} markets</div></div><div className="text-right"><div className="font-semibold">{formatUSDC(leader.volume)}</div><div className="text-xs text-muted-foreground">volume</div></div></div>)}</div>}
      </CardContent></Card>
      <div className="space-y-4"><Card><CardHeader><CardTitle className="text-base">Resolution stats</CardTitle></CardHeader><CardContent className="grid grid-cols-3 gap-3 text-center"><Stat label="Resolved" value={resolved.length} /><Stat label="YES" value={resolved.filter(({ outcome }) => outcome === Outcome.Yes).length} className="text-emerald-400" /><Stat label="NO" value={resolved.filter(({ outcome }) => outcome === Outcome.No).length} className="text-red-400" /></CardContent></Card><Card><CardHeader><CardTitle className="text-base">Recently resolved</CardTitle></CardHeader><CardContent className="space-y-2">{resolved.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No resolved markets yet.</p> : resolved.slice(0, 5).map((market) => <Link href={`/markets/${market.id}`} key={market.id} className="block rounded-lg border p-3 hover:bg-muted/40"><div className="mb-2 flex items-center justify-between gap-2"><Badge variant="outline">{market.category}</Badge><span className={cn("text-xs font-medium", market.outcome === Outcome.Yes ? "text-emerald-400" : market.outcome === Outcome.No ? "text-red-400" : "text-muted-foreground")}>{outcomeLabel(market.outcome)}</span></div><div className="line-clamp-2 text-sm">{market.question}</div></Link>)}</CardContent></Card></div>
    </div>
  </div>;
}

function Stat({ label, value, className }: { label: string; value: number; className?: string }) { return <div><div className={cn("text-2xl font-semibold", className)}>{value}</div><div className="text-xs text-muted-foreground">{label}</div></div>; }
