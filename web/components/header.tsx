"use client";
import { Menu, Sparkles, WalletCards } from "lucide-react";
import { Button } from "@/components/ui";
import { shortAddress } from "@/lib/utils";
import { useWallet } from "@/providers/wallet-provider";

export function Header() {
  const wallet = useWallet();
  return <header className="flex h-20 items-center justify-between border-b hairline px-4 sm:px-8">
    <div className="flex items-center gap-3"><div className="grid size-9 place-items-center rounded-lg bg-blue-500/15 text-blue-300"><Sparkles size={18} /></div><div><div className="font-semibold tracking-tight">Stellar Predict</div><div className="text-[11px] text-slate-500">Testnet markets</div></div></div>
    <div className="flex items-center gap-2"><Button className="hidden sm:inline-flex" variant="outline" disabled>Faucet <span className="ml-2 text-[10px] text-slate-500">Coming this week</span></Button>{wallet.address ? <Button variant="outline" onClick={wallet.disconnect}><WalletCards size={15} className="mr-2" />{shortAddress(wallet.address)}</Button> : <Button onClick={wallet.connect} disabled={wallet.connecting}>{wallet.connecting ? "Connecting…" : "Connect wallet"}</Button>}<button className="focus-ring rounded-md p-2 text-slate-400 sm:hidden"><Menu size={20} /></button></div>
  </header>;
}
