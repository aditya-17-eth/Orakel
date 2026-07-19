"use client";

import { ChevronDown, Wallet } from "lucide-react";
import { useWallet } from "@/components/WalletProvider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function WalletConnect() {
  const { address, connected, connecting, connect, disconnect } = useWallet();

  if (!connected || !address) {
    return (
      <Button onClick={connect} disabled={connecting}>
        <Wallet />
        {connecting ? "Connecting" : "Connect"}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex h-8 items-center gap-2 rounded-lg border border-border bg-background px-2.5 text-sm hover:bg-muted">
        <span className="size-2 rounded-full bg-emerald-500" />
        {address.slice(0, 4)}...{address.slice(-4)}
        <ChevronDown className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem className="font-mono text-xs text-muted-foreground">{address}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={disconnect}>Disconnect</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
