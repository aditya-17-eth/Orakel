"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, ExternalLink, RefreshCw } from "lucide-react";
import { useWallet } from "@/components/WalletProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContractEvent, getBackendActivity, getBackendEvents } from "@/lib/api";

const EVENT_LABELS: Record<string, string> = { buy: "Bought shares", sell: "Sold shares", borrow: "Opened loan", repay: "Repaid loan", loan_set: "Settled loan", claim: "Claimed payout", claim_lp: "Claimed LP", liq_add: "Added liquidity", liq_rem: "Removed liquidity" };

export default function ActivityPage() {
  const { address } = useWallet();
  const [events, setEvents] = useState<ContractEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = address ? await getBackendActivity(address) : await getBackendEvents();
      setEvents(response.events);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not load indexed activity.");
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => { queueMicrotask(() => void loadEvents()); }, [loadEvents]);

  return <div className="container mx-auto space-y-6 px-4 py-8">
    <div className="flex items-end justify-between gap-3"><div><h1 className="text-2xl font-semibold">Activity</h1><p className="mt-1 text-sm text-muted-foreground">{address ? "Transactions associated with your connected wallet." : "Latest indexed contract transactions."}</p></div><Button variant="outline" onClick={loadEvents} disabled={loading}><RefreshCw className={loading ? "animate-spin" : ""} /> Refresh</Button></div>
    <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Activity className="size-4" /> Contract events</CardTitle></CardHeader><CardContent>
      {error ? <div className="rounded-lg border border-destructive/40 p-6 text-sm text-destructive">{error}</div> : loading && events.length === 0 ? <div className="space-y-2">{[0,1,2,3].map((id) => <div key={id} className="h-16 animate-pulse rounded-lg bg-muted" />)}</div> : events.length === 0 ? <div className="rounded-lg border p-10 text-center text-sm text-muted-foreground">No indexed activity yet.</div> : <div className="divide-y">{events.map((event, index) => <div key={event.event_id ?? event.id ?? `${event.tx_hash}-${index}`} className="flex items-center justify-between gap-4 py-4"><div className="min-w-0"><div className="flex items-center gap-2"><span className="text-sm font-medium">{EVENT_LABELS[event.name] ?? event.name}</span><Badge variant="outline">Ledger {event.ledger}</Badge></div><div className="mt-1 truncate font-mono text-xs text-muted-foreground">{event.tx_hash}</div></div><a aria-label="View transaction on Stellar Expert" href={`https://stellar.expert/explorer/testnet/tx/${event.tx_hash}`} target="_blank" rel="noreferrer" className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><ExternalLink className="size-4" /></a></div>)}</div>}
    </CardContent></Card>
  </div>;
}
