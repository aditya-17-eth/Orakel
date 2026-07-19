"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, RefreshCw, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { useWallet } from "@/components/WalletProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  buildClaimLpTx,
  buildClaimTx,
  buildRestoreFootprintTx,
  getMarketsFromContract,
  getUserLpShares,
  getUserPosition,
  submitSignedTx,
} from "@/lib/contract";
import {
  countdownLabel,
  formatUSDC,
  holdsWinningShares,
  humanizeContractError,
  isArchivedEntryError,
  outcomeLabel,
  stateLabel,
} from "@/lib/format";
import { MarketState, ParsedMarket, ParsedPosition } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface PortfolioEntry {
  market: ParsedMarket;
  position: ParsedPosition;
  lpShares: number;
}

function PositionPnL({ position, market }: { position: ParsedPosition; market: ParsedMarket }) {
  // Rough unrealized P&L estimate based on current price
  const yesBps = market.yesPriceBps;
  const noBps = 10_000 - yesBps;
  const yesValue = position.yes * (yesBps / 10_000);
  const noValue = position.no * (noBps / 10_000);
  const currentValue = yesValue + noValue;
  const pnl = currentValue - position.spent;
  const pct = position.spent > 0 ? (pnl / position.spent) * 100 : 0;

  if (position.spent === 0) return null;

  return (
    <div className={cn("flex items-center gap-1 text-sm font-medium", pnl >= 0 ? "text-emerald-400" : "text-red-400")}>
      {pnl >= 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
      {pnl >= 0 ? "+" : ""}
      {formatUSDC(pnl)} ({pct.toFixed(1)}%)
    </div>
  );
}

function PortfolioCard({
  entry,
  onClaim,
  claiming,
}: {
  entry: PortfolioEntry;
  onClaim: (kind: "claim" | "claim_lp", marketId: number) => Promise<void>;
  claiming: string | null;
}) {
  const { market, position, lpShares } = entry;
  const isResolved = market.state === MarketState.Resolved;
  const canClaim = isResolved && holdsWinningShares(position, market.outcome);
  const canClaimLp = isResolved && lpShares > 0;
  const claimKey = `${market.id}-claim`;
  const claimLpKey = `${market.id}-claim_lp`;

  return (
    <Card className="transition-colors hover:bg-muted/30">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs">{market.category}</Badge>
              <Badge
                variant="outline"
                className={cn(
                  "text-xs",
                  market.state === MarketState.Open && "border-emerald-500/40 text-emerald-400",
                  market.state === MarketState.Proposed && "border-yellow-500/40 text-yellow-400",
                  market.state === MarketState.Disputed && "border-red-500/40 text-red-400",
                )}
              >
                {stateLabel(market.state)}
              </Badge>
              {market.outcome !== null && (
                <Badge variant="outline" className="text-xs border-violet-500/40 text-violet-400">
                  Outcome: {outcomeLabel(market.outcome)}
                </Badge>
              )}
            </div>
            <CardTitle className="text-sm leading-snug line-clamp-2">{market.question}</CardTitle>
          </div>
          <Link href={`/markets/${market.id}`} className="shrink-0">
            <Button variant="ghost" size="icon" className="size-7">
              <ArrowRight className="size-3.5" />
            </Button>
          </Link>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Position details */}
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          {position.yes > 0 && (
            <div>
              <div className="text-muted-foreground text-xs">YES shares</div>
              <div className="font-medium text-emerald-400">{position.yes.toFixed(4)}</div>
            </div>
          )}
          {position.no > 0 && (
            <div>
              <div className="text-muted-foreground text-xs">NO shares</div>
              <div className="font-medium text-red-400">{position.no.toFixed(4)}</div>
            </div>
          )}
          {lpShares > 0 && (
            <div>
              <div className="text-muted-foreground text-xs">LP shares</div>
              <div className="font-medium">{lpShares.toFixed(4)}</div>
            </div>
          )}
          {position.spent > 0 && (
            <div>
              <div className="text-muted-foreground text-xs">Spent</div>
              <div className="font-medium">{formatUSDC(position.spent)}</div>
            </div>
          )}
        </div>

        {/* P&L */}
        {!isResolved && <PositionPnL position={position} market={market} />}

        {/* Countdown or outcome */}
        {!isResolved && (
          <div className="text-xs text-muted-foreground">{countdownLabel(market)}</div>
        )}

        {/* Claim actions */}
        {(canClaim || canClaimLp) && (
          <>
            <Separator />
            <div className="flex flex-wrap gap-2">
              {canClaim && (
                <Button
                  size="sm"
                  onClick={() => onClaim("claim", market.id)}
                  disabled={Boolean(claiming)}
                >
                  {claiming === claimKey ? "Claiming..." : "Claim payout"}
                </Button>
              )}
              {canClaimLp && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onClaim("claim_lp", market.id)}
                  disabled={Boolean(claiming)}
                >
                  {claiming === claimLpKey ? "Claiming..." : "Claim LP"}
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SummaryCard({ entries }: { entries: PortfolioEntry[] }) {
  const totalSpent = entries.reduce((acc, e) => acc + e.position.spent, 0);
  const totalYes = entries.reduce((acc, e) => acc + e.position.yes, 0);
  const totalNo = entries.reduce((acc, e) => acc + e.position.no, 0);
  const totalLp = entries.reduce((acc, e) => acc + e.lpShares, 0);
  const activeMarkets = entries.filter((e) => e.market.state === MarketState.Open).length;
  const resolvedMarkets = entries.filter((e) => e.market.state === MarketState.Resolved).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div>
            <div className="text-muted-foreground text-xs">Total invested</div>
            <div className="font-semibold text-lg">{formatUSDC(totalSpent)}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Markets</div>
            <div className="font-semibold text-lg">{entries.length}</div>
            <div className="text-xs text-muted-foreground">{activeMarkets} active · {resolvedMarkets} resolved</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Total YES / NO</div>
            <div className="font-semibold">
              <span className="text-emerald-400">{totalYes.toFixed(2)}</span>
              {" / "}
              <span className="text-red-400">{totalNo.toFixed(2)}</span>
            </div>
          </div>
          {totalLp > 0 && (
            <div>
              <div className="text-muted-foreground text-xs">LP shares</div>
              <div className="font-semibold">{totalLp.toFixed(4)}</div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function PortfolioPage() {
  const { address, connected, sign } = useWallet();
  const [entries, setEntries] = useState<PortfolioEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  const loadPortfolio = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      const allMarkets = await getMarketsFromContract();

      const results = await Promise.all(
        allMarkets.map(async (market) => {
          const [position, lpShares] = await Promise.all([
            getUserPosition(market.id, address),
            getUserLpShares(market.id, address),
          ]);
          return { market, position, lpShares };
        }),
      );

      const portfolio = results.filter(
        ({ position, lpShares }) =>
          position.yes > 0 || position.no > 0 || position.spent > 0 || lpShares > 0,
      );

      setEntries(portfolio);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    if (address) {
      queueMicrotask(() => void loadPortfolio());
    } else {
      queueMicrotask(() => setEntries([]));
    }
  }, [address, loadPortfolio]);

  const handleClaim = useCallback(
    async (kind: "claim" | "claim_lp", marketId: number) => {
      if (!address) return;
      const key = `${marketId}-${kind}`;
      setClaiming(key);
      const toastId = toast.loading(kind === "claim" ? "Preparing claim..." : "Preparing LP claim...");

      try {
        const txXdr =
          kind === "claim"
            ? await buildClaimTx(address, marketId)
            : await buildClaimLpTx(address, marketId);

        toast.loading("Sign in your wallet...", { id: toastId });
        const signed = await sign(txXdr);
        toast.loading("Submitting...", { id: toastId });
        const result = await submitSignedTx(signed);
        toast.success(`Claim confirmed: ${result.hash.slice(0, 8)}...`, { id: toastId });
        void loadPortfolio();
      } catch (error) {
        if (isArchivedEntryError(error)) {
          try {
            setRestoring(true);
            toast.loading("Restoring your position...", { id: toastId });
            const restoreXdr = await buildRestoreFootprintTx(address, kind, marketId);
            const signedRestore = await sign(restoreXdr);
            const restoreTx = await submitSignedTx(signedRestore);
            if (!restoreTx) throw new Error("Restore failed");

            toast.loading("Retrying claim...", { id: toastId });
            const retryXdr =
              kind === "claim"
                ? await buildClaimTx(address, marketId)
                : await buildClaimLpTx(address, marketId);
            const signedRetry = await sign(retryXdr);
            const retry = await submitSignedTx(signedRetry);
            toast.success(`Claim confirmed: ${retry.hash.slice(0, 8)}...`, { id: toastId });
            void loadPortfolio();
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
    },
    [address, sign, loadPortfolio],
  );

  if (!connected) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
          <Wallet className="size-12 text-muted-foreground" />
          <div>
            <h2 className="text-xl font-semibold">Connect your wallet</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Connect a wallet to view your positions across all Orakel markets.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Portfolio</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Your positions across all markets
          </p>
        </div>
        <Button variant="outline" onClick={loadPortfolio} disabled={loading}>
          <RefreshCw className={loading ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>

      {loading && entries.length === 0 ? (
        <div className="space-y-4">
          <div className="h-32 animate-pulse rounded-lg bg-muted" />
          <div className="grid gap-4 sm:grid-cols-2">
            {[0, 1, 2].map((id) => (
              <div key={id} className="h-40 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-lg border p-12 text-center">
          <p className="text-sm text-muted-foreground">No positions found.</p>
          <Link href="/" className="mt-3 inline-flex items-center gap-2 text-sm underline-offset-4 hover:underline">
            <ArrowLeft className="size-4" />
            Browse markets
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {restoring && (
            <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3 text-sm text-yellow-400">
              Restoring archived position — this may take a moment…
            </div>
          )}

          <SummaryCard entries={entries} />

          <div className="grid gap-4 sm:grid-cols-2">
            {entries.map((entry) => (
              <PortfolioCard
                key={entry.market.id}
                entry={entry}
                onClaim={handleClaim}
                claiming={claiming}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
