"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, ShieldCheck } from "lucide-react";
import { getMarket, getUserLp, getUserPosition } from "@/lib/contract";
import { formatPercent, formatStroops, ipfsUrl } from "@/lib/utils";
import type { Market, Position } from "@/types/market";
import { Badge, Card } from "@/components/ui";
import { TradingPanel } from "@/components/trading-panel";
import { ClaimActions } from "@/components/claim-actions";
import { LoanPanel } from "@/components/loan-panel";
import { MarketMetrics } from "@/components/market-metrics";
import { useWallet } from "@/providers/wallet-provider";

export function MarketDetail({ id }: { id: number }) {
  const wallet = useWallet();
  const [market, setMarket] = useState<Market>();
  const [position, setPosition] = useState<Position>({ yes: 0n, no: 0n, spent: 0n });
  const [lp, setLp] = useState(0n);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const next = await getMarket(id);
      setMarket(next);
      if (wallet.address) {
        const [pos, shares] = await Promise.all([getUserPosition(id, wallet.address), getUserLp(id, wallet.address)]);
        setPosition(pos); setLp(shares);
      } else {
        setPosition({ yes: 0n, no: 0n, spent: 0n }); setLp(0n);
      }
      setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  }, [id, wallet.address]);

  useEffect(() => { void refresh(); }, [refresh]);
  if (error) return <Card className="p-8 text-center text-red">{error}</Card>;
  if (!market) return <Card className="h-80 animate-pulse" />;

  return <div>
    <Link href="/dashboard" className="focus-ring mb-6 inline-flex items-center gap-2 text-sm text-text-muted hover:text-neon-cyan"><ArrowLeft size={15} /> All markets</Link>
    <div className="grid gap-5 lg:grid-cols-[1.35fr_.65fr]">
      <div className="space-y-5">
        <Card className="p-6 sm:p-8">
          <div className="mb-6 flex items-start justify-between gap-3"><div><div className="mb-3 text-xs uppercase tracking-wider text-text-muted">{market.category} · Market {market.id}</div><h1 className="text-2xl font-semibold leading-tight sm:text-4xl">{market.question}</h1></div><Badge className="border-neon-cyan/30 text-neon-cyan">{market.state}</Badge></div>
          <div className="grid gap-4 border-t hairline pt-5 sm:grid-cols-3"><div><div className="text-xs text-text-muted">YES price</div><div className="mt-1 text-2xl font-semibold">{(Number(market.yesPriceBps) / 100).toFixed(1)}¢ <span className="text-sm text-text-muted">{formatPercent(market.yesPriceBps)}</span></div></div><div><div className="text-xs text-text-muted">Lock time</div><div className="mt-1 text-sm">{new Date(market.lockTime * 1000).toLocaleString()}</div></div><div><div className="text-xs text-text-muted">Resolve time</div><div className="mt-1 text-sm">{new Date(market.resolveTime * 1000).toLocaleString()}</div></div></div>
        </Card>
        <Card className="p-6">
          <h2 className="font-semibold">Resolution criteria</h2><p className="mt-2 text-sm leading-6 text-text-muted">The market resolves according to the published evidence and named source in the linked criteria document.</p>
          {market.criteriaRef && <a className="focus-ring mt-4 inline-flex items-center gap-2 text-sm text-neon-cyan" href={ipfsUrl(market.criteriaRef)} target="_blank" rel="noreferrer">View criteria on Pinata <ExternalLink size={14} /></a>}
          {market.proposedOutcome && <div className="mt-5 rounded-md border border-yellow/20 bg-yellow/5 p-4"><div className="text-xs uppercase tracking-wider text-yellow">Proposed outcome</div><div className="mt-1 font-medium">{market.proposedOutcome}</div>{market.criteriaRef && <a className="mt-2 inline-flex items-center gap-2 text-xs text-yellow" href={ipfsUrl(market.criteriaRef)} target="_blank" rel="noreferrer">Open evidence CID <ExternalLink size={12} /></a>}</div>}
        </Card>
        <MarketMetrics market={market} />
        <Card className="p-6"><div className="flex items-center gap-2"><ShieldCheck size={17} className="text-neon-cyan" /><h2 className="font-semibold">Your position</h2></div>{wallet.address ? <div className="mt-4 grid grid-cols-3 gap-3 text-sm"><div><div className="text-xs text-text-muted">YES</div><div className="mt-1 font-medium">{formatStroops(position.yes)}</div></div><div><div className="text-xs text-text-muted">NO</div><div className="mt-1 font-medium">{formatStroops(position.no)}</div></div><div><div className="text-xs text-text-muted">LP shares</div><div className="mt-1 font-medium">{formatStroops(lp)}</div></div></div> : <p className="mt-3 text-sm text-text-muted">Connect a wallet to view your position.</p>}</Card>
      </div>
      <div className="space-y-5"><TradingPanel market={market} position={position} onComplete={refresh} /><LoanPanel market={market} position={position} onComplete={refresh} /><ClaimActions market={market} position={position} onComplete={refresh} /></div>
    </div>
  </div>;
}
