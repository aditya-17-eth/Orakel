"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Droplets, Landmark, Menu, Trophy, UserRound } from "lucide-react";
import { WalletConnect } from "@/components/WalletConnect";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/", label: "Markets", icon: null },
  { href: "/portfolio", label: "Portfolio", icon: UserRound },
  { href: "/loans", label: "Loans", icon: Landmark },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/faucet", label: "Faucet", icon: Droplets },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="container mx-auto flex h-14 items-center justify-between gap-3 px-4">
        <div className="flex min-w-0 items-center gap-5">
          <Link href="/" className="shrink-0 font-semibold">Orakel</Link>
          <nav aria-label="Primary navigation" className="hidden items-center gap-1 lg:flex">
            {navLinks.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className={cn("inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm hover:bg-muted", (pathname === href || (href !== "/" && pathname.startsWith(href))) && "bg-muted")}>
                {Icon && <Icon className="size-3.5" />}{label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <WalletConnect />
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex size-8 items-center justify-center rounded-lg border hover:bg-muted lg:hidden" aria-label="Open navigation">
              <Menu className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {navLinks.map(({ href, label, icon: Icon }) => (
                <DropdownMenuItem key={href} render={<Link href={href} />} className={cn(pathname === href && "bg-muted")}>
                  {Icon && <Icon />}{label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
