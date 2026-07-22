"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Activity, Code, Server, Hexagon } from "lucide-react";

const navLinks = [
  { href: "/", label: "Protocol", icon: Hexagon },
  { href: "/dashboard", label: "Pulse", icon: Activity },
  { href: "/developers", label: "Terminal", icon: Code },
  { href: "/operators", label: "Telemetry", icon: Server },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass-strong border-b border-card-border/50">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative h-9 w-9 rounded-lg bg-gradient-to-br from-neon-cyan/20 to-ultra-magenta/10 flex items-center justify-center group-hover:from-neon-cyan/30 group-hover:to-ultra-magenta/20 transition-all duration-300">
            <Hexagon className="h-5 w-5 text-neon-cyan" />
            <div className="absolute inset-0 rounded-lg border border-neon-cyan/20 group-hover:border-neon-cyan/40 group-hover:glow-border-cyan transition-all duration-300" />
          </div>
          <span className="text-xl font-bold tracking-tight">
            <span className="text-foreground">Orak</span>
            <span className="text-neon-cyan">el</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                  isActive
                    ? "text-neon-cyan"
                    : "text-text-muted hover:text-foreground hover:bg-card-border/30"
                )}
              >
                {isActive && (
                  <div className="absolute inset-0 rounded-lg bg-neon-cyan/8 border border-neon-cyan/20 shadow-[0_0_12px_rgba(0,240,255,0.15)]" />
                )}
                <Icon className="h-4 w-4 relative z-10" />
                <span className="relative z-10">{link.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg glass-shard-sm hover:glow-border-cyan transition-all duration-200 cursor-default">
            <div className="relative">
              <div className="h-1.5 w-1.5 rounded-full bg-green" />
              <div className="absolute inset-0 h-1.5 w-1.5 rounded-full bg-green animate-ping" />
            </div>
            <span className="text-xs font-medium text-green">Mainnet</span>
          </div>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg glass-shard-sm">
            <span className="text-xs font-mono text-neon-cyan">v2.1.0</span>
          </div>
        </div>
      </div>
    </header>
  );
}
