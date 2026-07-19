"use client";

import { useState, useEffect, use } from "react";
import { getMarket, getUserPosition, getUserLpShares, yesPriceBps, stateLabel, outcomeLabel } from "@/lib/contract";
import { ParsedMarket, ParsedPosition, MarketState } from "@/lib/types";
import { TradePanel } from "@/components/TradePanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useFreighter } from "@/hooks/useFreighter";
import { buildClaimTx, buildClaimLpTx, submitSignedTx } from "@/lib/contract";
import { config } from "@/lib/stellar";
import { toast } from "sonner";

export default function MarketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { connected, address, sign } = useFreighter();
  const [market, setMarket] = useState<ParsedMarket | null>(null);
  const [position, setPosition] = useState<ParsedPosition | null>(null);
  const [lpShares, setLpShares] = useState(0);
  const [loadingData, setLoadingData] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const marketId = parseInt(id);

  const loadMarket = async () => {
    setLoadingData(true);
    try {
      const m = await getMarket(marketId);
      setMarket(m);

      if (address && m) {
        const pos = await getUserPosition(marketId, address);
        setPosition(pos);
        const lp = await getUserLpShares(marketId, address);
        setLpShares(lp);
      }
    } catch (err) {
      console.error("Failed to load market:", err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    void (async () => {
      await loadMarket();
    })();
  }, [marketId, address]);

  const handleClaim = async () => {
    if (!address) return;
    setActionLoading(true);
    try {
      toast.loading("Building claim transaction...");
      const xdr = await buildClaimTx(address, marketId);
      toast.loading("Sign in Freighter...");
      const signedXdr = await sign(xdr, config.networkPassphrase);
      toast.loading("Submitting...");
      const { hash } = await submitSignedTx(signedXdr);
      toast.success(`Claimed! Tx: ${hash.slice(0, 8)}...`);
      loadMarket();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Claim failed");
    } finally {
      toast.dismiss();
      setActionLoading(false);
    }
  };

  const handleClaimLp = async () => {
    if (!address) return;
    setActionLoading(true);
    try {
      toast.loading("Building LP claim...");
      const xdr = await buildClaimLpTx(address, marketId);
      toast.loading("Sign in Freighter...");
      const signedXdr = await sign(xdr, config.networkPassphrase);
      toast.loading("Submitting...");
      const { hash } = await submitSignedTx(signedXdr);
      toast.success(`LP Claimed! Tx: ${hash.slice(0, 8)}...`);
      loadMarket();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "LP claim failed");
    } finally {
      toast.dismiss();
      setActionLoading(false);
    }
  };

  if (loadingData && !market) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="h-64 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  if (!market) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12 text-muted-foreground">
          Market not found.
        </div>
      </div>
    );
  }

  const yesPrice = yesPriceBps(market) / 100;
  const noPrice = 100 - yesPrice;
  const isResolved = market.state === MarketState.Resolved;
  const canClaim = connected && position && (position.yes > 0 || position.no > 0);
  const canClaimLp = connected && lpShares > 0 && isResolved;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Market info */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Badge variant="outline" className="mb-2">{market.category}</Badge>
                  <CardTitle className="text-xl">{market.question}</CardTitle>
                </div>
                <Badge variant="outline" className={
                  market.state === MarketState.Open ? "bg-green-500/10 text-green-500" :
                  market.state === MarketState.Proposed ? "bg-yellow-500/10 text-yellow-500" :
                  market.state === MarketState.Disputed ? "bg-red-500/10 text-red-500" :
                  "bg-gray-500/10 text-gray-500"
                }>
                  {stateLabel(market.state)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Price display */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-green-500/5 border border-green-500/20">
                  <div className="text-sm text-muted-foreground">YES</div>
                  <div className="text-2xl font-bold text-green-500">{yesPrice.toFixed(0)}%</div>
                </div>
                <div className="p-4 rounded-lg bg-red-500/5 border border-red-500/20">
                  <div className="text-sm text-muted-foreground">NO</div>
                  <div className="text-2xl font-bold text-red-500">{noPrice.toFixed(0)}%</div>
                </div>
              </div>

              <Separator />

              {/* Market details */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Pool Size</span>
                  <div className="font-medium">{market.collateralLocked.toLocaleString()} USDC</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Bond</span>
                  <div className="font-medium">{market.bond.toLocaleString()} USDC</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Lock Time</span>
                  <div className="font-medium">{market.lockTime.toLocaleString()}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Resolve Time</span>
                  <div className="font-medium">{market.resolveTime.toLocaleString()}</div>
                </div>
                {market.outcome !== null && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Outcome</span>
                    <div className="font-medium text-lg">{outcomeLabel(market.outcome)}</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* User position */}
          {connected && position && (position.yes > 0 || position.no > 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Your Position</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">YES Shares</span>
                    <div className="font-medium text-green-500">{position.yes.toFixed(2)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">NO Shares</span>
                    <div className="font-medium text-red-500">{position.no.toFixed(2)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total Spent</span>
                    <div className="font-medium">{position.spent.toFixed(2)} USDC</div>
                  </div>
                </div>
                {canClaim && (
                  <Button onClick={handleClaim} className="mt-4" disabled={actionLoading}>
                    Claim Payout
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* LP position */}
          {connected && lpShares > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">LP Position</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm">
                  <span className="text-muted-foreground">Shares</span>
                  <div className="font-medium">{lpShares.toLocaleString()}</div>
                </div>
                {canClaimLp && (
                  <Button onClick={handleClaimLp} className="mt-4" disabled={actionLoading}>
                    Claim LP
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Trade panel */}
        <div>
          <TradePanel market={market} onTradeComplete={loadMarket} />
        </div>
      </div>
    </div>
  );
}
