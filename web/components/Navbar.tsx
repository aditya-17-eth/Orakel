"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Trophy, UserRound } from "lucide-react";
import { WalletConnect } from "@/components/WalletConnect";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/", label: "Markets" },
  { href: "/portfolio", label: "Portfolio", icon: UserRound },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="border-b">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-5">
          <Link href="/" className="font-semibold">
            Orakel
          </Link>
          <nav className="flex items-center gap-1">
            {navLinks.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm hover:bg-muted",
                  pathname === href && "bg-muted",
                )}
              >
                {Icon && <Icon className="size-3.5" />}
                {label}
              </Link>
            ))}
          </nav>
        </div>
        <WalletConnect />
      </div>
    </header>
  );
}
