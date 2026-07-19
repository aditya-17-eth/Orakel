"use client";
import { useEffect, useState } from "react";
import { claimCall, claimLpCall, getUserLp, submitCall, submitClaimWithRestore } from "@/lib/contract";
import { humanizeContractError } from "@/lib/errors";
import { Button } from "@/components/ui";
import type { Market, Position } from "@/types/market";
import { useWallet } from "@/providers/wallet-provider";

export function ClaimActions({ market, position, onComplete }: { market: Market; position: Position; onComplete: () => Promise<void> }) {
  const wallet = useWallet();
  const [status, setStatus] = useState("");
  const [lp, setLp] = useState(0n);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!wallet.address || loaded) return;
    let cancelled = false;
    getUserLp(market.id, wallet.address).then((shares) => { if (!cancelled) { setLp(shares); setLoaded(true); } }).catch(() => { if (!cancelled) setStatus("Could not load LP position."); });
    return () => { cancelled = true; };
  }, [wallet.address, market.id, loaded]);
  if (market.state !== "Resolved") return null;
  const hasWinningPosition = market.outcome === "Yes" ? position.yes > 0n : market.outcome === "No" ? position.no > 0n : position.yes > 0n || position.no > 0n;
  async function claim(isLp: boolean) {
    if (!wallet.address) { setStatus("Connect a wallet first."); return; }
    setStatus(isLp ? "Claiming LP value…" : "Claiming position…");
    try {
      const call = isLp ? claimLpCall(market.id, wallet.address) : claimCall(market.id, wallet.address);
      await submitClaimWithRestore(wallet.address, call, wallet.signTransaction, () => setStatus("Restoring your position…"));
      await onComplete();
      setStatus("Claim confirmed.");
    } catch (e) {
      const message = humanizeContractError(e);
      setStatus(message === "Your position needs storage restoration." ? "Storage recovery could not complete. Try again shortly." : message);
    }
  }
  return <div className="space-y-2">{hasWinningPosition && <Button className="w-full" onClick={() => claim(false)}>Claim winning shares</Button>}{lp > 0n && <Button variant="outline" className="w-full" onClick={() => claim(true)}>Claim LP value</Button>}{status && <p className="text-center text-xs text-text-muted">{status}</p>}</div>;
}
