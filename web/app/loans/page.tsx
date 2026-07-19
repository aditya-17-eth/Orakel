"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, RefreshCw, Search, Wallet } from "lucide-react";
import { LoanPanel } from "@/components/LoanPanel";
import { useWallet } from "@/components/WalletProvider";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getBackendPortfolio } from "@/lib/api";
import { formatUSDC, stateLabel } from "@/lib/format";
import { ParsedLoan, ParsedMarket, ParsedPosition } from "@/lib/types";
import { cn } from "@/lib/utils";

interface LoanMarket {
  market: ParsedMarket;
  position: ParsedPosition;
  loan: ParsedLoan;
}

export default function LoansPage() {
  const { address, connected } = useWallet();
  const [entries, setEntries] = useState<LoanMarket[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLoans = useCallback(async () => {
    if (!address) {
      setEntries([]);
      setSelectedId(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const portfolio = await getBackendPortfolio(address);
      const rows = portfolio.map(({ market, position, loan }) => ({ market, position, loan }));
      setEntries(rows);
      setSelectedId((current) => current !== null && rows.some(({ market }) => market.id === current)
        ? current
        : rows.find(({ loan }) => loan.debt > 0)?.market.id ?? rows[0]?.market.id ?? null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not load loan markets.");
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => { queueMicrotask(() => void loadLoans()); }, [loadLoans]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return entries.filter(({ market, position, loan }) => {
      if (!needle) return true;
      return market.question.toLowerCase().includes(needle)
        || market.category.toLowerCase().includes(needle)
        || (needle === "active" && loan.debt > 0)
        || (needle === "eligible" && (position.yes > 0 || position.no > 0));
    });
  }, [entries, search]);

  const selected = entries.find(({ market }) => market.id === selectedId) ?? null;
  const activeLoans = entries.filter(({ loan }) => loan.debt > 0);
  const totalDebt = activeLoans.reduce((sum, { loan }) => sum + loan.debt, 0);
  const totalCashCollateral = activeLoans.reduce((sum, { loan }) => sum + loan.cashCollateral, 0);

  if (!connected || !address) {
    return <WalletRequired />;
  }

  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Position loans</h1>
          <p className="mt-1 text-sm text-muted-foreground">Borrow against prediction shares with USDC collateral, up to 3x total exposure.</p>
        </div>
        <Button variant="outline" onClick={loadLoans} disabled={loading}>
          <RefreshCw className={loading ? "animate-spin" : ""} /> Refresh
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Summary label="Active loans" value={String(activeLoans.length)} />
        <Summary label="Outstanding debt" value={formatUSDC(totalDebt)} />
        <Summary label="Cash collateral" value={formatUSDC(totalCashCollateral)} />
      </div>

      {error && <Card className="border-destructive/40"><CardContent className="pt-6 text-sm text-destructive">{error}</CardContent></Card>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader className="gap-4">
            <div>
              <CardTitle className="text-base">All markets</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">Select a market to open, repay, or settle a loan.</p>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search markets or type active" className="pl-9" />
            </div>
          </CardHeader>
          <CardContent>
            {loading && entries.length === 0 ? (
              <div className="space-y-2">{[0, 1, 2, 3].map((id) => <div key={id} className="h-20 animate-pulse rounded-lg bg-muted" />)}</div>
            ) : filtered.length === 0 ? (
              <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">No matching markets.</div>
            ) : (
              <div className="space-y-2">
                {filtered.map(({ market, position, loan }) => (
                  <button key={market.id} type="button" onClick={() => setSelectedId(market.id)} className={cn("w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/40", selectedId === market.id && "border-primary bg-muted/40")}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="line-clamp-2 text-sm font-medium">{market.question}</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge variant="outline">{stateLabel(market.state)}</Badge>
                          {loan.debt > 0 && <Badge>Debt {formatUSDC(loan.debt)}</Badge>}
                          {(position.yes > 0 || position.no > 0) && <Badge variant="secondary">Shares available</Badge>}
                        </div>
                      </div>
                      <span className="font-mono text-xs text-muted-foreground">#{market.id}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {selected ? (
            <>
              <LoanPanel market={selected.market} position={selected.position} onComplete={loadLoans} />
              <Link className={buttonVariants({ variant: "outline", className: "w-full" })} href={`/markets/${selected.market.id}`}>Open market <ArrowUpRight /></Link>
            </>
          ) : (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Select a market to manage a loan.</CardContent></Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-xl font-semibold">{value}</div></CardContent></Card>;
}

function WalletRequired() {
  return <div className="container mx-auto px-4 py-8"><div className="flex flex-col items-center justify-center gap-4 py-24 text-center"><Wallet className="size-12 text-muted-foreground" /><div><h2 className="text-xl font-semibold">Connect your wallet</h2><p className="mt-1 text-sm text-muted-foreground">Your wallet is required to load collateral, debt, and available positions.</p></div><Link className={buttonVariants({ variant: "outline" })} href="/">Browse markets</Link></div></div>;
}
