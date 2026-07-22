"use client";

import { useState } from "react";
import { useFreighter } from "@/hooks/useFreighter";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { config, rpc } from "@/lib/stellar";
import { submitSignedTx } from "@/lib/contract";
import * as StellarSdk from "@stellar/stellar-sdk";

const MOCK_USDC = process.env.NEXT_PUBLIC_MOCK_USDC || "";

export function WalletConnect() {
  const { connected, address, connect, disconnect, sign, loading } = useFreighter();
  const [minting, setMinting] = useState(false);

  const handleMintTestUSDC = async () => {
    if (!address) return;
    setMinting(true);
    try {
      const account = await rpc.getAccount(address);
      const contract = new StellarSdk.Contract(MOCK_USDC);

      const tx = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: config.networkPassphrase,
      })
        .addOperation(
          contract.call(
            "mint",
            new StellarSdk.Address(address).toScVal(),
            StellarSdk.nativeToScVal(10000000000, { type: "i128" }) // 1000 USDC
          )
        )
        .setTimeout(180)
        .build();

      const sim = await rpc.simulateTransaction(tx);
      if (StellarSdk.rpc.Api.isSimulationError(sim)) {
        throw new Error(`Simulation failed: ${sim.error}`);
      }

      const assembled = StellarSdk.rpc.assembleTransaction(tx, sim).build();
      const signedXdr = await sign(assembled.toXDR(), config.networkPassphrase);

      toast.loading("Minting test USDC...");
      await submitSignedTx(signedXdr);

      toast.success("Minted 1,000 test USDC!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Mint failed");
    } finally {
      toast.dismiss();
      setMinting(false);
    }
  };

  if (loading) {
    return (
      <Button variant="outline" disabled>
        Loading...
      </Button>
    );
  }

  if (connected && address) {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleMintTestUSDC}
          disabled={minting}
        >
          {minting ? "Minting..." : "Get Test USDC"}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center gap-2 px-4 py-2 text-sm border rounded-md hover:bg-accent">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            {address.slice(0, 4)}...{address.slice(-4)}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem className="font-mono text-xs text-muted-foreground">
              {address}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={disconnect} className="text-red-500">
              Disconnect
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  return (
    <Button onClick={connect}>
      Connect Freighter
    </Button>
  );
}
