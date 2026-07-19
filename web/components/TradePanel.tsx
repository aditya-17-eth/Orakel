"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useWallet } from "@/components/WalletProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  buildBuyTx,
  buildSellTx,
  quoteBuy,
  quoteSell,
  submitSignedTx,
} from "@/lib/contract";
import { formatPriceFromBps, formatUSDC, humanizeContractError } from "@/lib/format";
import { ContractQuote, MarketState, ParsedMarket } from "@/lib/types";

interface TradePanelProps {
  market: ParsedMarket;
  onComplete: () => void;
}

export function TradePanel({ market, onComplete }: TradePanelProps) {
  const { address, connected, sign } = useWallet();
  const [mode, setMode] = useState<"buy" | "sell">("buy");
  const [side, setSide] = useState<"yes" | "no">("yes");
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<ContractQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const tradingClosed = now > market.lockTime.getTime() || market.state !== MarketState.Open;

  const numericAmount = useMemo(() => Number(amount || 0), [amount]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!address || !numericAmount || numericAmount <= 0 || tradingClosed) {
      queueMicrotask(() => setQuote(null));
      return;
    }

    let active = true;
    queueMicrotask(() => setQuoting(true));
    const run = mode === "buy" ? quoteBuy : quoteSell;

    run(address, market.id, side === "yes", numericAmount)
      .then((nextQuote) => {
        if (active) setQuote(nextQuote);
      })
      .catch(() => {
        if (active) setQuote(null);
      })
      .finally(() => {
        if (active) setQuoting(false);
      });

    return () => {
      active = false;
    };
  }, [address, market.id, mode, numericAmount, side, tradingClosed]);

  async function submitTrade() {
    if (!address || !quote || numericAmount <= 0) return;

    setSubmitting(true);
    const toastId = toast.loading("Preparing transaction...");
    try {
      const txXdr =
        mode === "buy"
          ? await buildBuyTx(address, market.id, side === "yes", numericAmount, quote.minOut)
          : await buildSellTx(address, market.id, side === "yes", numericAmount, quote.minOut);

      toast.loading("Sign in your wallet...", { id: toastId });
      const signed = await sign(txXdr);
      toast.loading("Submitting transaction...", { id: toastId });
      const result = await submitSignedTx(signed);
      toast.success(`Trade confirmed: ${result.hash.slice(0, 8)}...`, { id: toastId });
      setAmount("");
      setQuote(null);
      onComplete();
    } catch (error) {
      toast.error(humanizeContractError(error), { id: toastId });
    } finally {
      setSubmitting(false);
    }
  }

  if (tradingClosed) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Trade</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Trading is closed for this market because the lock time has passed.
        </CardContent>
      </Card>
    );
  }

  const price = formatPriceFromBps(market.yesPriceBps);
  const noBps = 10_000 - market.yesPriceBps;
  const noPrice = formatPriceFromBps(noBps);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Trade</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={mode} onValueChange={(value) => setMode(value as "buy" | "sell")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="buy">Buy</TabsTrigger>
            <TabsTrigger value="sell">Sell</TabsTrigger>
          </TabsList>
        </Tabs>

        <Tabs value={side} onValueChange={(value) => setSide(value as "yes" | "no")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="yes">YES {price.percent}</TabsTrigger>
            <TabsTrigger value="no">NO {noPrice.percent}</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="space-y-2">
          <Label htmlFor="trade-amount">{mode === "buy" ? "Amount (USDC)" : "Shares"}</Label>
          <Input
            id="trade-amount"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0.00"
          />
        </div>

        <div className="rounded-lg border p-3 text-sm">
          {quote ? (
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Quote</span>
                <span>{mode === "buy" ? `${quote.quotedOut.toFixed(4)} shares` : formatUSDC(quote.quotedOut, 4)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Effective price</span>
                <span>{mode === "buy" ? formatUSDC(quote.effectivePrice, 4) : formatUSDC(quote.effectivePrice, 4)} / share</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Minimum received</span>
                <span>{mode === "buy" ? `${quote.minOut.toFixed(4)} shares` : formatUSDC(quote.minOut, 4)}</span>
              </div>
              <p className="pt-1 text-xs text-muted-foreground">A 2% market fee is applied. Slippage protection is fixed at 1.5%, so minimum received is quote x 0.985.</p>
            </div>
          ) : (
            <span className="text-muted-foreground">
              {quoting ? "Getting quote..." : connected ? "Enter an amount to simulate." : "Connect a wallet to simulate trades."}
            </span>
          )}
        </div>

        <Button className="w-full" disabled={!connected || !quote || submitting} onClick={submitTrade}>
          {submitting ? "Submitting" : `${mode === "buy" ? "Buy" : "Sell"} ${side.toUpperCase()}`}
        </Button>
      </CardContent>
    </Card>
  );
}
