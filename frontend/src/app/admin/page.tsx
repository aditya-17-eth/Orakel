"use client";

import { useState } from "react";
import { useFreighter } from "@/hooks/useFreighter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { config, USDC_TO_stroop, CONTRACT_ID } from "@/lib/stellar";
import { rpc } from "@/lib/stellar";
import { submitSignedTx } from "@/lib/contract";
import * as StellarSdk from "@stellar/stellar-sdk";

export default function AdminPage() {
  const { connected, address, sign } = useFreighter();
  const [loading, setLoading] = useState(false);

  const [question, setQuestion] = useState("");
  const [category, setCategory] = useState("football");
  const [criteriaRef, setCriteriaRef] = useState("");
  const [lockTime, setLockTime] = useState("");
  const [resolveTime, setResolveTime] = useState("");
  const [disputeWindow, setDisputeWindow] = useState("7200");
  const [positionCap, setPositionCap] = useState("5000");
  const [bond, setBond] = useState("1000");
  const [initialLiquidity, setInitialLiquidity] = useState("1000");

  const handleCreateMarket = async () => {
    if (!address || !question) return;

    setLoading(true);
    try {
      const account = await rpc.getAccount(address);
      const contract = new StellarSdk.Contract(CONTRACT_ID);

      const lockTimeUnix = Math.floor(new Date(lockTime).getTime() / 1000);
      const resolveTimeUnix = Math.floor(new Date(resolveTime).getTime() / 1000);

      const tx = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: config.networkPassphrase,
      })
        .addOperation(
          contract.call(
            "create_market",
            new StellarSdk.Address(address).toScVal(),
            StellarSdk.nativeToScVal(question, { type: "string" }),
            StellarSdk.nativeToScVal(category, { type: "symbol" }),
            StellarSdk.nativeToScVal(criteriaRef, { type: "string" }),
            StellarSdk.nativeToScVal(lockTimeUnix, { type: "u64" }),
            StellarSdk.nativeToScVal(resolveTimeUnix, { type: "u64" }),
            StellarSdk.nativeToScVal(parseInt(disputeWindow), { type: "u64" }),
            StellarSdk.nativeToScVal(USDC_TO_stroop(parseFloat(positionCap)), { type: "i128" }),
            StellarSdk.nativeToScVal(USDC_TO_stroop(parseFloat(bond)), { type: "i128" }),
            StellarSdk.nativeToScVal(USDC_TO_stroop(parseFloat(initialLiquidity)), { type: "i128" })
          )
        )
        .setTimeout(180)
        .build();

      const sim = await rpc.simulateTransaction(tx);
      if (StellarSdk.rpc.Api.isSimulationError(sim)) {
        throw new Error(`Simulation failed: ${sim.error}`);
      }

      const assembled = StellarSdk.rpc.assembleTransaction(tx, sim).build();
      const xdr = assembled.toXDR();

      toast.loading("Signing...");
      const signedXdr = await sign(xdr, config.networkPassphrase);

      toast.loading("Creating market...");
      const { hash } = await submitSignedTx(signedXdr);

      toast.success(`Market created! Hash: ${hash.slice(0, 8)}...`);
      resetForm();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create market");
    } finally {
      toast.dismiss();
      setLoading(false);
    }
  };

  const resetForm = () => {
    setQuestion("");
    setCategory("football");
    setCriteriaRef("");
    setLockTime("");
    setResolveTime("");
    setDisputeWindow("7200");
    setPositionCap("5000");
    setBond("1000");
    setInitialLiquidity("1000");
  };

  if (!connected) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12 text-muted-foreground">
          Connect your Freighter wallet to access admin functions.
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Create Market</h1>
        <p className="text-muted-foreground">
          Admin-only. Bond must be ≥ initial liquidity (M-1).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Market Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Question</Label>
            <Input
              placeholder="Will Team A beat Team B?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Input
              placeholder="football"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Criteria Reference (IPFS CID)</Label>
            <Input
              placeholder="ipfs://..."
              value={criteriaRef}
              onChange={(e) => setCriteriaRef(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Lock Time</Label>
              <Input
                type="datetime-local"
                value={lockTime}
                onChange={(e) => setLockTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Resolve Time</Label>
              <Input
                type="datetime-local"
                value={resolveTime}
                onChange={(e) => setResolveTime(e.target.value)}
              />
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Dispute Window (s)</Label>
              <Input
                type="number"
                value={disputeWindow}
                onChange={(e) => setDisputeWindow(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Position Cap (USDC)</Label>
              <Input
                type="number"
                value={positionCap}
                onChange={(e) => setPositionCap(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Bond (USDC)</Label>
              <Input
                type="number"
                value={bond}
                onChange={(e) => setBond(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Initial Liquidity (USDC)</Label>
            <Input
              type="number"
              value={initialLiquidity}
              onChange={(e) => setInitialLiquidity(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">
              Bond: {bond} USDC
            </Badge>
            <span>≥</span>
            <Badge variant="outline">
              Liquidity: {initialLiquidity} USDC
            </Badge>
          </div>

          <Button
            className="w-full"
            onClick={handleCreateMarket}
            disabled={loading || !question || !lockTime || !resolveTime}
          >
            {loading ? "Creating..." : "Create Market"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
