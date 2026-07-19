"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, Droplets, PieChart } from "lucide-react";
import { useWallet } from "@/providers/wallet-provider";
import { formatStroops } from "@/lib/utils";
import { Button, Card } from "@/components/ui";

type PortfolioRow = { marketId: number; question: string; state: string; yesPriceBps: string; yesShares: string; noShares: string; lpShares: string; markValue: string; claimable: string; loanDebt: string };
type ActivityRow = { id: string; name: string; ledger: number; tx_hash: string; ledger_closed_at?: string };
const EMPTY_TOTALS = { spent: "0", markValue: "0", claimable: "0", debt: "0" };

export default function PortfolioPage() {
  const wallet = useWallet();
  const [positions, setPositions] = useState<PortfolioRow[]>([]);
  const [events, setEvents] = useState<ActivityRow[]>([]);
  const [totals, setTotals] = useState(EMPTY_TOTALS);
  const [status, setStatus] = useState("");
  const [faucetBusy, setFaucetBusy] = useState(false);

  useEffect(() => {
    if (!wallet.address) { setPositions([]); setEvents([]); setTotals(EMPTY_TOTALS); return; }
    const controller = new AbortController();
    setStatus("Loading on-chain portfolio…");
    Promise.allSettled([
      fetch(`/api/portfolio?wallet=${wallet.address}`, { signal: controller.signal }).then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error); return body; }),
      fetch(`/api/activity?wallet=${wallet.address}`, { signal: controller.signal }).then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error); return body; }),
    ]).then(([portfolio, activity]) => {
      if (portfolio.status === "fulfilled") { setPositions(portfolio.value.positions ?? []); setTotals(portfolio.value.totals ?? EMPTY_TOTALS); }
      if (activity.status === "fulfilled") setEvents(activity.value.events ?? []);
      const failure = portfolio.status === "rejected" ? portfolio.reason : activity.status === "rejected" ? activity.reason : null;
      if (failure && !(failure instanceof Error && failure.name === "AbortError")) setStatus(failure instanceof Error ? failure.message : String(failure)); else setStatus("");
    });
    return () => controller.abort();
  }, [wallet.address]);

  async function requestFaucet() {
    if (!wallet.address) return;
    setFaucetBusy(true); setStatus("Requesting Testnet XLM…");
    try { const response = await fetch("/api/faucet", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ wallet: wallet.address }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error); setStatus("Testnet XLM sent to your wallet."); }
    catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
    finally { setFaucetBusy(false); }
  }

  return <div className="grid-bg min-h-screen py-10"><div className="container mx-auto px-4"><div className="mb-8 flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-4"><div className="glass-shard flex h-12 w-12 items-center justify-center"><PieChart className="h-6 w-6 text-neon-cyan" /></div><div><h1 className="text-3xl font-bold">Portfolio</h1><p className="text-text-muted">Positions, claims, loans, and indexed activity.</p></div></div><Button variant="outline" disabled={!wallet.address || faucetBusy} onClick={requestFaucet}><Droplets className="mr-2 h-4 w-4" />{faucetBusy ? "Requesting…" : "Testnet faucet"}</Button></div>{!wallet.address ? <Card className="p-10 text-center"><h2 className="text-lg font-semibold">Connect your wallet</h2><p className="mt-2 text-sm text-text-muted">Your portfolio is read from the Stellar Testnet contract.</p><Button className="mt-5" onClick={wallet.connect}>Connect wallet</Button></Card> : <><div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[["Marked value", totals.markValue], ["Total spent", totals.spent], ["Claimable", totals.claimable], ["Loan debt", totals.debt]].map(([label, value]) => <Card key={label} className="p-5"><div className="text-xs uppercase tracking-wider text-text-muted">{label}</div><div className="mt-2 font-mono text-2xl text-neon-cyan">{formatStroops(value)}</div></Card>)}</div>{positions.length ? <div className="grid gap-4 md:grid-cols-2">{positions.map((row) => <Link key={row.marketId} href={`/markets/${row.marketId}`}><Card className="h-full p-5 transition hover:border-neon-cyan/40"><div className="flex justify-between gap-4"><h2 className="font-semibold">{row.question}</h2><span className="text-xs text-neon-cyan">{row.state}</span></div><div className="mt-5 grid grid-cols-3 gap-3 text-sm"><div><div className="text-xs text-text-muted">YES</div><div className="mt-1 font-mono">{formatStroops(row.yesShares)}</div></div><div><div className="text-xs text-text-muted">NO</div><div className="mt-1 font-mono">{formatStroops(row.noShares)}</div></div><div><div className="text-xs text-text-muted">Debt</div><div className="mt-1 font-mono text-ultra-magenta">{formatStroops(row.loanDebt)}</div></div></div></Card></Link>)}</div> : !status && <Card className="p-8 text-center text-text-muted">No positions found for this wallet.</Card>}<Card className="mt-6 p-6"><div className="flex items-center gap-2"><Activity className="h-4 w-4 text-neon-cyan" /><h2 className="font-semibold">Recent activity</h2></div><div className="mt-4 divide-y divide-card-border">{events.length ? events.map((event) => <div key={event.id} className="flex items-center justify-between py-3 text-sm"><span className="font-mono uppercase text-neon-cyan">{event.name}</span><span className="text-text-muted">Ledger {event.ledger}</span></div>) : <p className="py-4 text-sm text-text-muted">No indexed activity yet.</p>}</div></Card></>}{status && <p className="mt-5 text-center text-sm text-text-muted">{status}</p>}</div></div>;
}
