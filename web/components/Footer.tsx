import { Hexagon } from "lucide-react";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-card-border/50 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-t from-deep-space via-deep-space/80 to-transparent pointer-events-none" />
      <div className="container mx-auto px-4 py-12 relative">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-3 group cursor-default">
              <div className="h-10 w-10 rounded-xl glass-shard flex items-center justify-center group-hover:glow-border-cyan transition-all duration-300">
                <Hexagon className="h-5 w-5 text-neon-cyan" />
              </div>
              <span className="text-xl font-bold glow-cyan-text">Orakel</span>
            </div>
            <p className="text-sm text-text-muted leading-relaxed">
              Collateralized prediction markets and position lending on Stellar Testnet.
            </p>
            <div className="flex items-center gap-2 mt-2">
              <div className="relative">
                <div className="h-2 w-2 rounded-full bg-green" />
                <div className="absolute inset-0 h-2 w-2 rounded-full bg-green animate-ping" />
              </div>
              <span className="text-xs text-green font-mono">Protocol Active</span>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-sm tracking-wider uppercase text-neon-cyan/80">Protocol</h3>
            <div className="space-y-2 text-sm text-text-muted">
              <Link href="/" className="block hover:text-neon-cyan transition-colors duration-200">Overview</Link>
              <Link href="/dashboard" className="block hover:text-neon-cyan transition-colors duration-200">Markets</Link>
              <Link href="/portfolio" className="block hover:text-neon-cyan transition-colors duration-200">Portfolio</Link>
              <Link href="/developers" className="block hover:text-neon-cyan transition-colors duration-200">Documentation</Link>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-sm tracking-wider uppercase text-ultra-magenta/80">Community</h3>
            <div className="space-y-2 text-sm text-text-muted">
              <a href="https://github.com/aditya-17-eth/Orakel" target="_blank" rel="noreferrer" className="block hover:text-ultra-magenta transition-colors duration-200">GitHub</a>
              <Link href="/leaderboard" className="block hover:text-ultra-magenta transition-colors duration-200">Leaderboard</Link>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-sm tracking-wider uppercase text-electric-lime/80">Resources</h3>
            <div className="space-y-2 text-sm text-text-muted">
              <Link href="/developers" className="block hover:text-electric-lime transition-colors duration-200">Contract Reference</Link>
              <Link href="/operators" className="block hover:text-electric-lime transition-colors duration-200">Operations</Link>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-card-border/50 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-text-muted font-mono">
            © 2026 Orakel. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-xs font-mono text-text-muted">
            <span className="flex items-center gap-1.5">
              <span className="relative">
                <span className="h-1.5 w-1.5 rounded-full bg-green inline-block" />
                <span className="absolute inset-0 h-1.5 w-1.5 rounded-full bg-green animate-ping" />
              </span>
              Status: <span className="text-green">Operational</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-neon-cyan inline-block" />
              Network: <span className="text-neon-cyan">Stellar Testnet</span>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
