"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { TradePanel } from "@/components/TradePanel";
import { LoanPanel } from "@/components/LoanPanel";
import { PriceChart } from "@/components/PriceChart";
import { useWallet } from "@/components/WalletProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getBackendMarket } from "@/lib/api";
import {
  buildClaimLpTx,
  buildClaimTx,
  buildRestoreFootprintTx,
  getUserLpShares,
  getUserPosition,
  submitSignedTx,
} from "@/lib/contract";
import {
  formatPriceFromBps,
  formatUSDC,
  holdsWinningShares,
  humanizeContractError,
  ipfsGatewayUrl,
  isArchivedEntryError,
  outcomeLabel,
  stateLabel,
} from "@/lib/format";
import { MarketState, ParsedMarket, ParsedPosition } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function MarketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const marketId = Number(id);
  const { address, connected, sign } = useWallet();
  const [market, setMarket] = useState<ParsedMarket | null>(null);
  const [evidenceCid, setEvidenceCid] = useState("");
  const [position, setPosition] = useState<ParsedPosition | null>(null);
  const [lpShares, setLpShares] = useState(0);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<"claim" | "claim_lp" | null>(null);
  const [restoring, setRestoring] = useState(false);

  const loadMarket = useCallback(async () => {
    setLoading(true);
    try {
      const nextBackend = await getBackendMarket(marketId);
      const nextMarket = nextBackend.parsedMarket;
      setMarket(nextMarket);
      const rawMarket = nextBackend.market;
      setEvidenceCid(String(rawMarket.evidence_cid ?? rawMarket.evidenceCid ?? ""));

      if (address && nextMarket) {
        const [nextPosition, nextLpShares] = await Promise.all([
          getUserPosition(marketId, address),
          getUserLpShares(marketId, address),
        ]);
        setPosition(nextPosition);
        setLpShares(nextLpShares);
      } else {
        setPosition(null);
        setLpShares(0);
      }
    } finally {
      setLoading(false);
    }
  }, [address, marketId]);

  useEffect(() => {
    queueMicrotask(() => void loadMarket());
  }, [loadMarket]);

  async function signSubmitRefresh(xdr: string) {
    const signed = await sign(xdr);
    const result = await submitSignedTx(signed);
    await loadMarket();
    return result;
  }

  async function claim(kind: "claim" | "claim_lp") {
    if (!address) return;
    setClaiming(kind);
    const toastId = toast.loading(kind === "claim" ? "Preparing claim..." : "Preparing LP claim...");

    try {
      const txXdr = kind === "claim" ? await buildClaimTx(address, marketId) : await buildClaimLpTx(address, marketId);
      toast.loading("Sign in your wallet...", { id: toastId });
      const result = await signSubmitRefresh(txXdr);
      toast.success(`Claim confirmed: ${result.hash.slice(0, 8)}...`, { id: toastId });
    } catch (error) {
      if (isArchivedEntryError(error)) {
        try {
          setRestoring(true);
          toast.loading("restoring your position...", { id: toastId });
          const restoreXdr = await buildRestoreFootprintTx(address, kind, marketId);
          await signSubmitRefresh(restoreXdr);

          toast.loading("Retrying claim...", { id: toastId });
          const retryXdr = kind === "claim" ? await buildClaimTx(address, marketId) : await buildClaimLpTx(address, marketId);
          const retry = await signSubmitRefresh(retryXdr);
          toast.success(`Claim confirmed: ${retry.hash.slice(0, 8)}...`, { id: toastId });
        } catch (restoreError) {
          toast.error(humanizeContractError(restoreError), { id: toastId });
        } finally {
          setRestoring(false);
        }
      } else {
        toast.error(humanizeContractError(error), { id: toastId });
      }
    } finally {
      setClaiming(null);
    }
  }

  if (loading && !market) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="h-96 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (!market) {
    return (
      <div className="container mx-auto space-y-4 px-4 py-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          Markets
        </Link>
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">Market not found.</div>
      </div>
    );
  }

  const yesPrice = formatPriceFromBps(market.yesPriceBps);
  const noPrice = formatPriceFromBps(10_000 - market.yesPriceBps);
  const criteriaUrl = ipfsGatewayUrl(market.criteriaRef);
  const evidenceUrl = ipfsGatewayUrl(evidenceCid);
  const canClaim = connected && market.state === MarketState.Resolved && holdsWinningShares(position, market.outcome);
  const canClaimLp = connected && market.state === MarketState.Resolved && lpShares > 0;

  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          Markets
        </Link>
        <Button variant="outline" onClick={loadMarket} disabled={loading}>
          <RefreshCw className={loading ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <Badge variant="outline">{market.category}</Badge>
                  <CardTitle className="text-2xl leading-tight">{market.question}</CardTitle>
                </div>
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
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border p-4">
                  <div className="text-sm text-muted-foreground">YES price</div>
                  <div className="mt-1 text-2xl font-semibold">{yesPrice.cents}</div>
                  <div className="text-sm text-muted-foreground">{yesPrice.percent}</div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="text-sm text-muted-foreground">NO price</div>
                  <div className="mt-1 text-2xl font-semibold">{noPrice.cents}</div>
                  <div className="text-sm text-muted-foreground">{noPrice.percent}</div>
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 text-sm sm:grid-cols-2">
                <Detail label="Market ID" value={String(market.id)} />
                <Detail label="Pool size" value={formatUSDC(market.collateralLocked)} />
                <Detail label="YES reserve" value={formatUSDC(market.yesReserve)} />
                <Detail label="NO reserve" value={formatUSDC(market.noReserve)} />
                <Detail label="Lock time" value={market.lockTime.toLocaleString()} />
                <Detail label="Resolve time" value={market.resolveTime.toLocaleString()} />
                <Detail label="Bond" value={formatUSDC(market.bond)} />
                <Detail label="Position cap" value={market.positionCap > 0 ? formatUSDC(market.positionCap) : "None"} />
                <Detail label="LP shares" value={market.totalLpShares.toLocaleString()} />
                <Detail label="LP fees accrued" value={formatUSDC(market.lpFeesAccrued)} />
                <Detail label="Dispute window" value={`${Math.round(market.disputeWindow / 60)} minutes`} />
                <Detail label="Outcome" value={outcomeLabel(market.outcome)} />
              </div>

              {criteriaUrl && (
                <a href={criteriaUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm underline-offset-4 hover:underline">
                  Resolution criteria
                  <ExternalLink className="size-4" />
                </a>
              )}
            </CardContent>
          </Card>

          <PriceChart marketId={market.id} currentPriceBps={market.yesPriceBps} />

          {market.state === MarketState.Proposed && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Proposal</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Detail label="Proposed outcome" value={outcomeLabel(market.proposedOutcome)} />
                {market.proposalTime && <Detail label="Proposal time" value={market.proposalTime.toLocaleString()} />}
                {market.proposer && <Detail label="Proposer" value={market.proposer} />}
                {evidenceUrl && (
                  <a href={evidenceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 underline-offset-4 hover:underline">
                    Evidence CID
                    <ExternalLink className="size-4" />
                  </a>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Your Position</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {connected ? (
                <>
                  <div className="grid gap-4 text-sm sm:grid-cols-4">
                    <Detail label="YES shares" value={position ? position.yes.toFixed(4) : "0.0000"} />
                    <Detail label="NO shares" value={position ? position.no.toFixed(4) : "0.0000"} />
                    <Detail label="Spent" value={position ? formatUSDC(position.spent) : formatUSDC(0)} />
                    <Detail label="LP shares" value={lpShares.toFixed(4)} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {canClaim && (
                      <Button onClick={() => claim("claim")} disabled={Boolean(claiming)}>
                        {claiming === "claim" ? (restoring ? "Restoring" : "Claiming") : "Claim payout"}
                      </Button>
                    )}
                    {canClaimLp && (
                      <Button variant="outline" onClick={() => claim("claim_lp")} disabled={Boolean(claiming)}>
                        {claiming === "claim_lp" ? (restoring ? "Restoring" : "Claiming") : "Claim LP"}
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Connect a wallet to view your position.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6"><TradePanel market={market} onComplete={loadMarket} /><LoanPanel market={market} position={position} onComplete={loadMarket} /></div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-muted-foreground">{label}</div>
      <div className="truncate font-medium">{value}</div>
    </div>
  );
}
