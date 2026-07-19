"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Landmark } from "lucide-react";
import { borrowCall, getUserLoan, repayCall, settleLoanCall, submitCall } from "@/lib/contract";
import { humanizeContractError } from "@/lib/errors";
import { formatStroops, parseTokenAmount } from "@/lib/utils";
import type { Loan, Market, Position } from "@/types/market";
import { Button, Card, Input } from "@/components/ui";
import { useWallet } from "@/providers/wallet-provider";

const EMPTY_LOAN: Loan = { yesCollateral: 0n, noCollateral: 0n, cashCollateral: 0n, debt: 0n, openedAt: 0 };

export function LoanPanel({ market, position, onComplete }: { market: Market; position: Position; onComplete: () => Promise<void> }) {
  const wallet = useWallet();
  const [loan, setLoan] = useState<Loan>(EMPTY_LOAN);
  const [borrowYes, setBorrowYes] = useState(true);
  const [shares, setShares] = useState("");
  const [cash, setCash] = useState("");
  const [amount, setAmount] = useState("");
  const [repayAmount, setRepayAmount] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const refreshLoan = useCallback(async () => {
    if (!wallet.address) { setLoan(EMPTY_LOAN); return; }
    try { setLoan(await getUserLoan(market.id, wallet.address)); }
    catch (error) { setStatus(humanizeContractError(error)); }
  }, [market.id, wallet.address]);

  useEffect(() => { void refreshLoan(); }, [refreshLoan]);

  const shareAmount = parseTokenAmount(shares);
  const cashAmount = parseTokenAmount(cash);
  const borrowAmount = parseTokenAmount(amount);
  const availableShares = borrowYes ? position.yes : position.no;
  const sharePriceBps = borrowYes ? market.yesPriceBps : 10_000n - market.yesPriceBps;
  const maxDebt = useMemo(() => {
    const shareValue = shareAmount * sharePriceBps / 10_000n;
    return (shareValue + cashAmount) * 2n;
  }, [cashAmount, shareAmount, sharePriceBps]);
  const closed = Date.now() / 1000 >= market.lockTime;

  async function run(call: ReturnType<typeof borrowCall>, pending: string, complete: string) {
    if (!wallet.address) { setStatus("Connect a wallet first."); return; }
    setBusy(true); setStatus(pending);
    try {
      await submitCall(wallet.address, call, wallet.signTransaction);
      await Promise.all([refreshLoan(), onComplete()]);
      setShares(""); setCash(""); setAmount(""); setRepayAmount("");
      setStatus(complete);
    } catch (error) { setStatus(humanizeContractError(error)); }
    finally { setBusy(false); }
  }

  if (!wallet.address) return <Card className="p-5"><div className="flex items-center gap-2"><Landmark className="h-4 w-4 text-ultra-magenta" /><h3 className="font-semibold">Position loan</h3></div><p className="mt-2 text-sm text-text-muted">Connect your wallet to view or manage collateral-backed loans.</p></Card>;

  if (loan.debt > 0n) {
    return <Card className="p-5"><div className="flex items-center gap-2"><Landmark className="h-4 w-4 text-ultra-magenta" /><h3 className="font-semibold">Active loan</h3></div><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><div className="text-xs text-text-muted">Debt</div><div className="mt-1 font-mono text-ultra-magenta">{formatStroops(loan.debt)}</div></div><div><div className="text-xs text-text-muted">Cash collateral</div><div className="mt-1 font-mono">{formatStroops(loan.cashCollateral)}</div></div><div><div className="text-xs text-text-muted">YES pledged</div><div className="mt-1 font-mono">{formatStroops(loan.yesCollateral)}</div></div><div><div className="text-xs text-text-muted">NO pledged</div><div className="mt-1 font-mono">{formatStroops(loan.noCollateral)}</div></div></div>{market.state === "Resolved" ? <Button className="mt-4 w-full" disabled={busy} onClick={() => run(settleLoanCall(market.id, wallet.address!), "Settling resolved loan…", "Loan settled.")}>Settle resolved loan</Button> : <><label className="mb-2 mt-5 block text-xs uppercase tracking-wider text-text-muted">Repay amount</label><Input value={repayAmount} onChange={(event) => setRepayAmount(event.target.value)} inputMode="decimal" placeholder={formatStroops(loan.debt)} /><Button className="mt-3 w-full" disabled={busy || parseTokenAmount(repayAmount) <= 0n} onClick={() => run(repayCall(market.id, wallet.address!, parseTokenAmount(repayAmount)), "Preparing repayment…", "Repayment confirmed.")}>Repay loan</Button></>}{status && <p className="mt-3 text-center text-xs text-text-muted">{status}</p>}</Card>;
  }

  if (closed || market.state !== "Open") return null;

  return <Card className="p-5"><div className="flex items-center gap-2"><Landmark className="h-4 w-4 text-ultra-magenta" /><h3 className="font-semibold">Borrow against position</h3></div><p className="mt-2 text-xs leading-5 text-text-muted">Pledge market shares plus token collateral. Debt is capped at 2× collateral value, producing at most 3× total exposure.</p><div className="mt-4 flex gap-2">{[true, false].map((side) => <button key={String(side)} type="button" onClick={() => setBorrowYes(side)} className={`flex-1 rounded-md border p-2 text-sm ${borrowYes === side ? "border-ultra-magenta/50 bg-ultra-magenta/10 text-ultra-magenta" : "border-card-border text-text-muted"}`}>{side ? "YES" : "NO"} <span className="ml-1 text-xs">{formatStroops(side ? position.yes : position.no)}</span></button>)}</div><label className="mb-2 mt-4 block text-xs uppercase tracking-wider text-text-muted">Shares to pledge</label><Input value={shares} onChange={(event) => setShares(event.target.value)} inputMode="decimal" placeholder="0.00" /><label className="mb-2 mt-4 block text-xs uppercase tracking-wider text-text-muted">Token collateral</label><Input value={cash} onChange={(event) => setCash(event.target.value)} inputMode="decimal" placeholder="0.00" /><label className="mb-2 mt-4 block text-xs uppercase tracking-wider text-text-muted">Amount to borrow</label><Input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="0.00" /><div className="mt-3 flex justify-between rounded-md border border-card-border bg-deep-space/60 p-3 text-xs"><span className="text-text-muted">Estimated maximum</span><span className="font-mono text-ultra-magenta">{formatStroops(maxDebt)}</span></div><Button className="mt-4 w-full" disabled={busy || shareAmount <= 0n || cashAmount <= 0n || borrowAmount <= 0n || borrowAmount > maxDebt || shareAmount > availableShares} onClick={() => run(borrowCall(market.id, wallet.address!, borrowYes, shareAmount, cashAmount, borrowAmount), "Preparing collateralized loan…", "Loan opened.")}>Borrow funds</Button>{status && <p className="mt-3 text-center text-xs text-text-muted">{status}</p>}</Card>;
}
