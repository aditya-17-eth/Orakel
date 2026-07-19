"use client";

import { useState } from "react";
import { Droplets, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useWallet } from "@/components/WalletProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requestFaucet } from "@/lib/api";

export default function FaucetPage() {
  const { address, connected } = useWallet();
  const [busy, setBusy] = useState(false);

  async function fund() {
    if (!address) return;
    setBusy(true);
    const id = toast.loading("Requesting Testnet funds...");
    try {
      await requestFaucet(address);
      toast.success("Wallet funded with Testnet XLM.", { id });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Faucet request failed.", { id });
    } finally {
      setBusy(false);
    }
  }

  return <div className="container mx-auto px-4 py-12"><Card className="mx-auto max-w-xl"><CardHeader><div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Droplets className="size-5" /></div><CardTitle>Stellar Testnet faucet</CardTitle><p className="text-sm text-muted-foreground">Fund your connected wallet with Testnet XLM for transaction fees. Testnet assets have no monetary value.</p></CardHeader><CardContent className="space-y-5">{address && <div className="rounded-lg border p-3 font-mono text-xs break-all">{address}</div>}<Button className="w-full" onClick={fund} disabled={!connected || busy}>{busy ? "Requesting funds..." : connected ? "Fund connected wallet" : "Connect wallet to continue"}</Button><a href="https://laboratory.stellar.org/#account-creator?network=test" target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground">Open Stellar Laboratory <ExternalLink className="size-4" /></a></CardContent></Card></div>;
}
