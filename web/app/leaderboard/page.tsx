"use client";

import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { Card } from "@/components/ui";
import { formatStroops, shortAddress } from "@/lib/utils";

type Entry = { rank: number; wallet: string; volume: string; trades: number; markets: number };

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [error, setError] = useState("");
  useEffect(() => { const controller = new AbortController(); fetch("/api/leaderboard", { signal: controller.signal }).then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error); return body.entries ?? []; }).then(setEntries).catch((reason) => { if (!(reason instanceof Error && reason.name === "AbortError")) setError(reason instanceof Error ? reason.message : String(reason)); }); return () => controller.abort(); }, []);
  return <div className="grid-bg min-h-screen py-10"><div className="container mx-auto max-w-5xl px-4"><div className="mb-8 flex items-center gap-4"><div className="glass-shard flex h-12 w-12 items-center justify-center"><Trophy className="h-6 w-6 text-electric-lime" /></div><div><h1 className="text-3xl font-bold">Leaderboard</h1><p className="text-text-muted">Testnet traders ranked by indexed trading volume.</p></div></div><Card className="overflow-hidden"><div className="grid grid-cols-[64px_1fr_1fr_80px_80px] gap-3 border-b border-card-border px-5 py-3 text-xs uppercase tracking-wider text-text-muted"><span>Rank</span><span>Wallet</span><span>Volume</span><span>Trades</span><span>Markets</span></div>{entries.map((entry) => <div key={entry.wallet} className="grid grid-cols-[64px_1fr_1fr_80px_80px] gap-3 border-b border-card-border/60 px-5 py-4 text-sm last:border-0"><span className="font-mono text-electric-lime">#{entry.rank}</span><span className="font-mono">{shortAddress(entry.wallet)}</span><span className="font-mono text-neon-cyan">{formatStroops(entry.volume)}</span><span>{entry.trades}</span><span>{entry.markets}</span></div>)}{!entries.length && <div className="p-10 text-center text-text-muted">{error || "No indexed trades yet."}</div>}</Card></div></div>;
}
