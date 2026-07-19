"use client";

import { useState, useEffect } from "react";
import { getMarketCount, getMarket } from "@/lib/contract";
import { MarketCard } from "@/components/MarketCard";
import { ParsedMarket } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import Hero from "@/components/Hero";

export default function HomePage() {
  const [markets, setMarkets] = useState<ParsedMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");

  const loadMarkets = async () => {
    setLoading(true);
    try {
      const count = await getMarketCount();
      const loaded: ParsedMarket[] = [];

      // Load markets in reverse order (newest first)
      for (let i = count - 1; i >= 0 && loaded.length < 20; i--) {
        const market = await getMarket(i);
        if (market) loaded.push(market);
      }

      setMarkets(loaded);
    } catch (err) {
      console.error("Failed to load markets:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void (async () => {
      await loadMarkets();
    })();
  }, []);

  const categories = ["all", ...new Set(markets.map((m) => m.category))];

  const filtered = markets.filter((m) => {
    const matchesSearch = m.question.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "all" || m.category === filter;
    return matchesSearch && matchesFilter;
  });

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
          },
          secondary: {
            text: "View Portfolio",
            onClick: () => window.location.assign("/portfolio")
          }
        }}
      />

      <div id="markets-section" className="container mx-auto px-4 py-12 scroll-mt-6">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Active Markets</h2>
          <p className="text-muted-foreground">
            Search and trade on any of the live markets.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <Input
            placeholder="Search markets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm text-white border-zinc-800 bg-zinc-950/50"
          />
          <div className="flex gap-2 flex-wrap">
            {categories.map((cat) => (
              <Badge
                key={cat}
                variant={filter === cat ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setFilter(cat)}
              >
                {cat}
              </Badge>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-40 rounded-lg bg-zinc-900 animate-pulse"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {markets.length === 0
              ? "No markets found. Create one from the admin panel."
              : "No markets match your search."}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((market) => (
              <MarketCard key={market.id} market={market} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
