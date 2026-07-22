"use client";

import { useState } from "react";
import { useFreighter } from "@/hooks/useFreighter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  buildBuyTx,
  buildSellTx,
  submitSignedTx,
  yesPriceBps,
} from "@/lib/contract";
import { config, USDC_TO_stroop } from "@/lib/stellar";
import { ParsedMarket } from "@/lib/types";
import { toast } from "sonner";

interface TradePanelProps {
  market: ParsedMarket;
  onTradeComplete?: () => void;
}

export function TradePanel({ market, onTradeComplete }: TradePanelProps) {
  const { connected, address, sign } = useFreighter();
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState("2");
  const [loading, setLoading] = useState(false);
  const [side, setSide] = useState<"yes" | "no">("yes");

  const price = yesPriceBps(market) / 10000;
  // Guard against division by zero when price is 0 or 1
  const noPrice = 1 - price;
  const effectivePrice = side === "yes"
    ? Math.max(price, 0.0001)
    : Math.max(noPrice, 0.0001);
  const sharesOut = Number(amount || 0) / effectivePrice;
  const minShares = sharesOut * (1 - Number(slippage || 2) / 100);

  const handleTrade = async (action: "buy" | "sell") => {
    if (!address || !amount || Number(amount) <= 0) return;

    setLoading(true);
    try {
      // Contract buy_yes/sell_yes: true = YES side, false = NO side
      const buyYes = side === "yes";

      const xdr =
        action === "buy"
          ? await buildBuyTx(
              address,
              market.id,
              USDC_TO_stroop(Number(amount)),
              USDC_TO_stroop(minShares),
              buyYes
            )
          : await buildSellTx(
              address,
              market.id,
              USDC_TO_stroop(Number(amount)),
              USDC_TO_stroop(Number(amount) * (1 - Number(slippage) / 100)),
              buyYes
            );

      toast.loading("Please sign in Freighter...");
      const signedXdr = await sign(xdr, config.networkPassphrase);
      toast.loading("Submitting...");

      const { hash } = await submitSignedTx(signedXdr);
      toast.success(`${action === "buy" ? "Bought" : "Sold"}! Tx: ${hash.slice(0, 8)}...`);
      setAmount("");
      onTradeComplete?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Trade failed");
    } finally {
      toast.dismiss();
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Trade</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={side} onValueChange={(v) => setSide(v as "yes" | "no")}>
          <TabsList className="w-full">
            <TabsTrigger value="yes" className="flex-1 text-green-500">
              YES {(price * 100).toFixed(0)}%
            </TabsTrigger>
            <TabsTrigger value="no" className="flex-1 text-red-500">
              NO {((1 - price) * 100).toFixed(0)}%
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="space-y-2">
          <Label>Amount (USDC)</Label>
          <Input
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min="0"
            step="0.01"
          />
          <div className="text-xs text-muted-foreground">
            Est. shares: ~{sharesOut.toFixed(2)}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Slippage tolerance (%)</Label>
          <Input
            type="number"
            value={slippage}
            onChange={(e) => setSlippage(e.target.value)}
            min="0.5"
            max="50"
            step="0.5"
          />
        </div>

        <div className="flex gap-2">
          <Button
            className="flex-1 bg-green-600 hover:bg-green-700"
            disabled={!connected || loading || !amount || Number(amount) <= 0}
            onClick={() => handleTrade("buy")}
          >
            {loading ? "Processing..." : "Buy"}
          </Button>
          <Button
            className="flex-1"
            variant="destructive"
            disabled={!connected || loading || !amount || Number(amount) <= 0}
            onClick={() => handleTrade("sell")}
          >
            {loading ? "Processing..." : "Sell"}
          </Button>
        </div>

        {!connected && (
          <p className="text-xs text-muted-foreground text-center">
            Connect Freighter to trade
          </p>
        )}
      </CardContent>
    </Card>
  );
}
