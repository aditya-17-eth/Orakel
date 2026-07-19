"use client";

import Link from "next/link";
import {
  Shield,
  Zap,
  Globe,
  Lock,
  ArrowRight,
  Activity,
  TrendingUp,
  Server,
  CheckCircle,
  Hexagon,
  Layers,
  Binary,
} from "lucide-react";

const features = [
  {
    icon: Zap,
    title: "On-Chain Market AMM",
    description: "YES and NO shares trade against a Soroban constant-product pool with contract-enforced fees, caps, and slippage protection.",
    accent: "cyan" as const,
  },
  {
    icon: Shield,
    title: "Optimistic Resolution",
    description: "Bonded proposals, a dispute window, and an arbiter fallback make outcomes transparent and recoverable when sources disagree.",
    accent: "magenta" as const,
  },
  {
    icon: Globe,
    title: "Collateralized Leverage",
    description: "Opt-in position loans use pledged shares plus token collateral and an isolated reserve with a hard 3× exposure ceiling.",
    accent: "lime" as const,
  },
  {
    icon: Lock,
    title: "Wallet-Native Execution",
    description: "Freighter, xBull, and Albedo sign prepared Stellar Testnet transactions without sending secret keys to the application.",
    accent: "cyan" as const,
  },
];

const stats = [
  { label: "Network", value: "Testnet", change: "", accent: "cyan" },
  { label: "Max Leverage", value: "3×", change: "", accent: "magenta" },
  { label: "Total Fee Cap", value: "5%", change: "", accent: "lime" },
  { label: "Settlement", value: "USDC", change: "", accent: "cyan" },
];

const securityLayers = [
  {
    layer: 1,
    title: "Hard Trading Locks",
    description: "Every market enforces its lock timestamp and per-wallet position cap inside the contract.",
    accent: "cyan" as const,
  },
  {
    layer: 2,
    title: "Bonded Disputes",
    description: "Proposers escrow a bond and watchers can dispute during a defined window before final settlement.",
    accent: "magenta" as const,
  },
  {
    layer: 3,
    title: "Isolated Loan Reserve",
    description: "Borrowing cannot consume market collateral; loan liquidity and bad-debt exposure remain isolated from trading pools.",
    accent: "lime" as const,
  },
];

export default function HomePage() {
  return (
    <div className="grid-bg min-h-screen relative">
      {/* Ambient Depth */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[800px] h-[800px] bg-neon-cyan/5 rounded-full blur-[150px] animate-drift" />
        <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-ultra-magenta/5 rounded-full blur-[120px] animate-drift" style={{ animationDelay: "-4s" }} />
      </div>

      {/* Hero Section */}
      <section className="relative py-32 md:py-40 overflow-hidden">
        {/* Decorative Shards */}
        <div className="absolute top-20 right-10 w-32 h-32 glass-shard opacity-30 animate-float" />
        <div className="absolute bottom-20 left-10 w-24 h-24 glass-shard opacity-20 animate-float" style={{ animationDelay: "-2s" }} />
        <div className="absolute top-1/2 right-1/4 w-16 h-16 glass-shard opacity-15 animate-float" style={{ animationDelay: "-4s" }} />

        <div className="container relative mx-auto px-4">
          <div className="text-center max-w-5xl mx-auto">
            {/* Status Badge */}
            <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-xl glass-shard-sm mb-10 animate-fade-in-up">
              <div className="relative">
                <div className="h-2 w-2 rounded-full bg-green" />
                <div className="absolute inset-0 h-2 w-2 rounded-full bg-green animate-ping" />
              </div>
              <span className="text-sm font-medium text-green">Stellar Testnet</span>
              <div className="h-4 w-px bg-card-border" />
              <span className="text-xs font-mono text-text-muted">Contract deployed</span>
            </div>

            {/* Headline */}
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-8 leading-[0.9] animate-fade-in-up delay-100">
              <span className="block text-foreground">Prediction Markets</span>
              <span className="block mt-2">
                <span className="text-neon-cyan glow-cyan-text">Built</span>{" "}
                <span className="text-foreground">on Stellar</span>
              </span>
            </h1>

            <p className="text-lg md:text-xl text-text-muted max-w-2xl mx-auto mb-12 leading-relaxed animate-fade-in-up delay-200">
              Trade binary outcomes, supply liquidity, claim resolved positions,
              and borrow against collateralized market shares on Stellar Testnet.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in-up delay-300">
              <Link
                href="/dashboard"
                className="group inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl glass-shard bg-neon-cyan/10 text-neon-cyan font-semibold hover:bg-neon-cyan/20 hover:glow-border-cyan transition-all duration-300"
              >
                Explore Markets
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/portfolio"
                className="inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl glass-panel text-foreground font-semibold hover:bg-card-bg/80 hover:glow-border-cyan transition-all duration-300"
              >
                Open Portfolio
                <Activity className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Consensus Visualizer */}
      <section className="relative py-16">
        <div className="container mx-auto px-4">
          <div className="relative p-8 rounded-2xl glass-panel overflow-hidden animate-fade-in-up delay-200">
            <div className="absolute inset-0 grid-bg-dense opacity-30" />
            <div className="relative flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="flex items-center gap-6">
                <div className="relative">
                  <div className="h-20 w-20 rounded-full consensus-ring-active animate-pulse-glow" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Hexagon className="h-8 w-8 text-neon-cyan" />
                  </div>
                </div>
                <div>
                  <div className="text-3xl font-bold font-mono text-neon-cyan">3×</div>
                  <div className="text-sm text-text-muted">Maximum Exposure</div>
                </div>
              </div>
              <div className="flex gap-8">
                {stats.map((stat) => {
                  const accentClass = stat.accent === "cyan" ? "text-neon-cyan" :
                                      stat.accent === "magenta" ? "text-ultra-magenta" :
                                      "text-electric-lime";
                  return (
                    <div key={stat.label} className="text-center">
                      <div className={`text-xl font-bold ${accentClass}`}>{stat.value}</div>
                      <div className="text-xs text-text-muted">{stat.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 relative">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16 animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl glass-shard-sm mb-6">
              <Layers className="h-4 w-4 text-neon-cyan" />
              <span className="text-sm font-medium text-neon-cyan">Protocol Architecture</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Why <span className="text-neon-cyan">Orakel</span>?
            </h2>
            <p className="text-text-muted max-w-2xl mx-auto">
              Contract-enforced trading, resolution, lending, and recovery flows.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((feature, i) => {
              const Icon = feature.icon;
              const accentClass = feature.accent === "cyan" ? "text-neon-cyan" :
                                  feature.accent === "magenta" ? "text-ultra-magenta" :
                                  "text-electric-lime";
              const bgClass = feature.accent === "cyan" ? "bg-neon-cyan/10" :
                              feature.accent === "magenta" ? "bg-ultra-magenta/10" :
                              "bg-electric-lime/10";
              const glowClass = feature.accent === "cyan" ? "hover:glow-border-cyan" :
                                feature.accent === "magenta" ? "hover:glow-border-magenta" :
                                "hover:glow-border-lime";
              return (
                <div
                  key={feature.title}
                  className={`group p-6 rounded-2xl glass-panel hover:border-neon-cyan/20 transition-all duration-500 ${glowClass} animate-fade-in-up`}
                  style={{ animationDelay: `${(i + 1) * 100}ms` }}
                >
                  <div className={`h-12 w-12 rounded-xl ${bgClass} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className={`h-6 w-6 ${accentClass}`} />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-text-muted leading-relaxed">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Security Architecture */}
      <section className="py-24 relative">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16 animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl glass-shard-sm mb-6">
              <Shield className="h-4 w-4 text-ultra-magenta" />
              <span className="text-sm font-medium text-ultra-magenta">Security Layers</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Multi-Layered <span className="text-ultra-magenta">Defenses</span>
            </h2>
            <p className="text-text-muted max-w-2xl mx-auto">
              Three independent controls limit trading, resolution, and lending risk.
            </p>
          </div>

          <div className="max-w-4xl mx-auto space-y-6">
            {securityLayers.map((layer, i) => {
              const accentClass = layer.accent === "cyan" ? "text-neon-cyan border-neon-cyan/30" :
                                  layer.accent === "magenta" ? "text-ultra-magenta border-ultra-magenta/30" :
                                  "text-electric-lime border-electric-lime/30";
              const bgClass = layer.accent === "cyan" ? "bg-neon-cyan/10" :
                              layer.accent === "magenta" ? "bg-ultra-magenta/10" :
                              "bg-electric-lime/10";
              const glowClass = layer.accent === "cyan" ? "hover:glow-border-cyan" :
                                layer.accent === "magenta" ? "hover:glow-border-magenta" :
                                "hover:glow-border-lime";
              return (
                <div
                  key={layer.layer}
                  className={`flex gap-6 p-6 rounded-2xl glass-panel transition-all duration-300 ${glowClass} animate-slide-in-left`}
                  style={{ animationDelay: `${(i + 1) * 150}ms` }}
                >
                  <div className={`h-14 w-14 rounded-xl ${bgClass} border ${accentClass} flex items-center justify-center flex-shrink-0`}>
                    <span className="text-2xl font-bold font-mono">{layer.layer}</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">{layer.title}</h3>
                    <p className="text-text-muted leading-relaxed">{layer.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 relative">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16 animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl glass-shard-sm mb-6">
              <Binary className="h-4 w-4 text-electric-lime" />
              <span className="text-sm font-medium text-electric-lime">Market Lifecycle</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              How <span className="text-electric-lime">Orakel</span> Works
            </h2>
            <p className="text-text-muted max-w-2xl mx-auto">
              From market entry to transparent on-chain settlement.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: Server, title: "Trade", desc: "Connect a Stellar wallet, select YES or NO, review the quote, fee, and slippage floor, then sign the prepared transaction.", accent: "cyan" },
              { icon: CheckCircle, title: "Resolve", desc: "After the market closes, a bonded outcome is proposed, disputed when necessary, and finalized on-chain.", accent: "magenta" },
              { icon: TrendingUp, title: "Claim or Settle", desc: "Winning traders and LPs claim value, while resolved position loans settle from pledged collateral.", accent: "lime" },
            ].map((step, i) => {
              const Icon = step.icon;
              const accentClass = step.accent === "cyan" ? "text-neon-cyan" :
                                  step.accent === "magenta" ? "text-ultra-magenta" :
                                  "text-electric-lime";
              const bgClass = step.accent === "cyan" ? "bg-neon-cyan/10" :
                              step.accent === "magenta" ? "bg-ultra-magenta/10" :
                              "bg-electric-lime/10";
              const glowClass = step.accent === "cyan" ? "hover:glow-border-cyan" :
                                step.accent === "magenta" ? "hover:glow-border-magenta" :
                                "hover:glow-border-lime";
              return (
                <div key={i} className={`text-center group animate-fade-in-up`} style={{ animationDelay: `${(i + 1) * 150}ms` }}>
                  <div className={`h-20 w-20 rounded-2xl ${bgClass} flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300 ${glowClass}`}>
                    <Icon className={`h-10 w-10 ${accentClass}`} />
                  </div>
                  <div className="text-xs font-mono text-text-muted mb-2">STEP {i + 1}</div>
                  <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                  <p className="text-sm text-text-muted leading-relaxed">{step.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 relative">
        <div className="container mx-auto px-4">
          <div className="relative p-12 md:p-16 rounded-3xl glass-panel overflow-hidden animate-fade-in-scale">
            <div className="absolute inset-0 grid-bg-dense opacity-20" />
            <div className="absolute top-0 right-0 w-80 h-80 bg-neon-cyan/10 rounded-full blur-[100px]" />
            <div className="absolute bottom-0 left-0 w-60 h-60 bg-ultra-magenta/10 rounded-full blur-[80px]" />

            <div className="relative text-center">
              <h2 className="text-4xl md:text-5xl font-bold mb-6">
                Ready to Build the <span className="text-neon-cyan">Future</span>?
              </h2>
              <p className="text-text-muted max-w-xl mx-auto mb-10 text-lg">
                Explore the live Testnet contract, connect a supported wallet, and test the complete market lifecycle.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/developers"
                  className="group inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl glass-shard bg-neon-cyan/10 text-neon-cyan font-semibold hover:bg-neon-cyan/20 hover:glow-border-cyan transition-all duration-300"
                >
                  Read Documentation
                  <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  href="/leaderboard"
                  className="inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl glass-panel text-foreground font-semibold hover:bg-card-bg/80 hover:glow-border-cyan transition-all duration-300"
                >
                  View Leaderboard
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
