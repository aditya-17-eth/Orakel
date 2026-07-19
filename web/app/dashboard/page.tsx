import { Radio } from "lucide-react";
import { MarketList } from "@/components/market-list";

export default function DashboardPage() {
  return (
    <div className="min-h-screen py-8 relative">
      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-neon-cyan/3 rounded-full blur-[120px] animate-drift" />
        <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] bg-ultra-magenta/3 rounded-full blur-[100px] animate-drift" style={{ animationDelay: "-6s" }} />
      </div>

      <div className="container mx-auto px-4 relative">
        {/* Header */}
        <div className="mb-8 flex items-center gap-4 animate-fade-in-up">
          <div className="h-12 w-12 rounded-xl glass-shard flex items-center justify-center">
            <Radio className="h-6 w-6 text-neon-cyan" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Prediction Markets</h1>
            <p className="text-text-muted">Live Testnet markets read directly from the Orakel contract.</p>
          </div>
        </div>

        <div className="animate-fade-in-up delay-200"><MarketList /></div>
      </div>
    </div>
  );
}
