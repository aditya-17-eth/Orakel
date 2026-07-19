"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Landmark } from "lucide-react";
import { toast } from "sonner";
import { useWallet } from "@/components/WalletProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildBorrowTx, buildRepayTx, buildSettleLoanTx, getUserLoan, submitSignedTx } from "@/lib/contract";
import { formatUSDC, humanizeContractError } from "@/lib/format";
import { MarketState, ParsedLoan, ParsedMarket, ParsedPosition } from "@/lib/types";

const EMPTY_LOAN: ParsedLoan = { yesCollateral: 0, noCollateral: 0, cashCollateral: 0, debt: 0, openedAt: null };

export function LoanPanel({ market, position, onComplete }: { market: ParsedMarket; position: ParsedPosition | null; onComplete: () => void | Promise<void> }) {
  const { address, connected, sign } = useWallet();
  const [loan, setLoan] = useState(EMPTY_LOAN);
  const [side, setSide] = useState<"yes" | "no">("yes");
  const [shares, setShares] = useState("");
  const [cash, setCash] = useState("");
  const [amount, setAmount] = useState("");
  const [repay, setRepay] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const loadLoan = useCallback(async () => { if (!address) { setLoan(EMPTY_LOAN); return; } setLoan(await getUserLoan(market.id, address)); }, [address, market.id]);
  useEffect(() => { queueMicrotask(() => void loadLoan()); }, [loadLoan]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(timer); }, []);

  const shareNumber = Math.max(0, Number(shares) || 0);
  const cashNumber = Math.max(0, Number(cash) || 0);
  const amountNumber = Math.max(0, Number(amount) || 0);
  const sharePrice = side === "yes" ? market.yesPriceBps / 10_000 : (10_000 - market.yesPriceBps) / 10_000;
  const maxDebt = useMemo(() => (shareNumber * sharePrice + cashNumber) * 2, [cashNumber, shareNumber, sharePrice]);
  const available = side === "yes" ? position?.yes || 0 : position?.no || 0;
  const closed = now >= market.lockTime.getTime() || market.state !== MarketState.Open;

  async function execute(xdrPromise: Promise<string>, message: string) {
    setBusy(true); const toastId = toast.loading(message);
    try { const xdr = await xdrPromise; const signed = await sign(xdr); const result = await submitSignedTx(signed); await Promise.all([loadLoan(), onComplete()]); toast.success(`Confirmed: ${result.hash.slice(0, 8)}...`, { id: toastId }); setShares(""); setCash(""); setAmount(""); setRepay(""); }
    catch (error) { toast.error(humanizeContractError(error), { id: toastId }); }
    finally { setBusy(false); }
  }

  if (!connected || !address) return <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Landmark className="size-4" /> Position loan</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">Connect a wallet to manage collateral-backed loans.</CardContent></Card>;

  if (loan.debt > 0) return <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Landmark className="size-4" /> Active loan</CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid grid-cols-2 gap-3 text-sm"><Metric label="Debt" value={formatUSDC(loan.debt)} /><Metric label="Cash collateral" value={formatUSDC(loan.cashCollateral)} /><Metric label="YES pledged" value={loan.yesCollateral.toFixed(4)} /><Metric label="NO pledged" value={loan.noCollateral.toFixed(4)} /></div>{market.state === MarketState.Resolved ? <Button className="w-full" disabled={busy} onClick={() => execute(buildSettleLoanTx(address, market.id), "Preparing settlement...")}>Settle resolved loan</Button> : <div className="space-y-2"><Label htmlFor="repay-amount">Repay amount (USDC)</Label><Input id="repay-amount" type="number" min="0" value={repay} onChange={(event) => setRepay(event.target.value)} placeholder={loan.debt.toFixed(2)} /><Button className="w-full" disabled={busy || Number(repay) <= 0} onClick={() => execute(buildRepayTx(address, market.id, Number(repay)), "Preparing repayment...")}>Repay loan</Button></div>}</CardContent></Card>;

  if (closed) return null;
  return <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Landmark className="size-4" /> Borrow against position</CardTitle><p className="text-xs text-muted-foreground">Pledge shares plus USDC collateral. Maximum total exposure is 3x.</p></CardHeader><CardContent className="space-y-4"><div className="grid grid-cols-2 gap-2"><Button variant={side === "yes" ? "default" : "outline"} onClick={() => setSide("yes")}>YES {position?.yes.toFixed(2) || "0.00"}</Button><Button variant={side === "no" ? "default" : "outline"} onClick={() => setSide("no")}>NO {position?.no.toFixed(2) || "0.00"}</Button></div><Field id="loan-shares" label="Shares to pledge" value={shares} setValue={setShares} /><Field id="loan-cash" label="USDC collateral" value={cash} setValue={setCash} /><Field id="loan-amount" label="Amount to borrow" value={amount} setValue={setAmount} /><div className="flex justify-between rounded-lg border p-3 text-sm"><span className="text-muted-foreground">Estimated maximum</span><span>{formatUSDC(maxDebt)}</span></div><Button className="w-full" disabled={busy || shareNumber <= 0 || cashNumber <= 0 || amountNumber <= 0 || shareNumber > available || amountNumber > maxDebt} onClick={() => execute(buildBorrowTx(address, market.id, side === "yes", shareNumber, cashNumber, amountNumber), "Preparing collateralized loan...")}>Borrow funds</Button></CardContent></Card>;
}

function Field({ id, label, value, setValue }: { id: string; label: string; value: string; setValue: (value: string) => void }) { return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Input id={id} type="number" min="0" step="0.01" value={value} onChange={(event) => setValue(event.target.value)} placeholder="0.00" /></div>; }
function Metric({ label, value }: { label: string; value: string }) { return <div><div className="text-xs text-muted-foreground">{label}</div><div className="font-medium">{value}</div></div>; }
