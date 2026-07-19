"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { MarketCard } from "@/components/MarketCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getBackendMarkets } from "@/lib/api";
import { ParsedMarket } from "@/lib/types";
import Hero from "@/components/Hero";

export default function MarketListPage() {
  const [markets, setMarkets] = useState<ParsedMarket[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadMarkets() {
    setLoading(true);
    setError(null);
    try {
      const nextMarkets = await getBackendMarkets();
      setMarkets(nextMarkets);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not load markets");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    queueMicrotask(() => void loadMarkets());
  }, []);

  const filteredMarkets = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return markets;
    return markets.filter((market) => {
      return market.question.toLowerCase().includes(needle) || market.category.toLowerCase().includes(needle);
    });
  }, [markets, search]);

  return (
    <div className="w-full flex flex-col min-h-screen bg-black text-white">
      <Hero
        trustBadge={{ text: "Stellar Soroban Network", icons: ["✨", "🛡️"] }}
        headline={{ line1: "Orakel", line2: "Prediction Markets" }}
        subtitle="Decentralized, USDC-settled binary option pools on Stellar. Trade on sports, politics, and custom verified outcomes optimistically."
        buttons={{
          primary: {
            text: "Explore Markets",
            onClick: () => document.getElementById("markets-section")?.scrollIntoView({ behavior: "smooth" })
          }
        }}
      />

      <div id="markets-section" className="container mx-auto space-y-6 px-4 py-12 scroll-mt-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-3xl font-semibold">Markets</h2>
            <p className="mt-1 text-sm text-muted-foreground">Live contract markets on Stellar testnet.</p>
          </div>
          <Button variant="outline" onClick={loadMarkets} disabled={loading} className="text-white border-zinc-800 bg-zinc-950/50 hover:bg-zinc-900">
            <RefreshCw className={loading ? "animate-spin" : ""} />
            Refresh
          </Button>
        </div>

        <Input
          className="max-w-sm text-white border-zinc-800 bg-zinc-950/50"
          placeholder="Search markets"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/40 p-3 text-sm text-destructive">
            <AlertCircle className="size-4" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((id) => (
              <div key={id} className="h-44 animate-pulse rounded-lg bg-zinc-900" />
            ))}
          </div>
        ) : filteredMarkets.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredMarkets.map((market) => (
              <MarketCard key={market.id} market={market} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-zinc-850 p-8 text-center text-sm text-muted-foreground">
            {markets.length === 0 ? "No markets found on this contract." : "No markets match your search."}
          </div>
        )}
      </div>
    </div>
  );
}
