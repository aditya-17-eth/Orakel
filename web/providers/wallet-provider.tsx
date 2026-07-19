"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { StellarWalletsKit, WalletNetwork, allowAllModules } from "@creit.tech/stellar-wallets-kit";
import { humanizeContractError } from "@/lib/errors";

type WalletContextValue = {
  address?: string; connecting: boolean; error?: string;
  connect: () => Promise<void>; disconnect: () => Promise<void>; signTransaction: (xdr: string) => Promise<string>;
};
const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string>();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string>();
  const kit = useRef<StellarWalletsKit | null>(null);
  useEffect(() => {
    const next = new StellarWalletsKit({ network: WalletNetwork.TESTNET, modules: allowAllModules() });
    kit.current = next;
    const selected = window.localStorage.getItem("orakel.wallet");
    if (selected) {
      next.setWallet(selected);
      next.getAddress().then((result) => { if (result.address) setAddress(result.address); }).catch(() => window.localStorage.removeItem("orakel.wallet"));
    }
  }, []);
  const connect = useCallback(async () => {
    setConnecting(true); setError(undefined);
    try { if (!kit.current) throw new Error("Wallet support is still loading."); await kit.current.openModal({ onWalletSelected: async (option) => { kit.current?.setWallet(option.id); const result = await kit.current?.getAddress(); if (result?.address) { setAddress(result.address); window.localStorage.setItem("orakel.wallet", option.id); } } }); }
    catch (e) { setError(humanizeContractError(e)); }
    finally { setConnecting(false); }
  }, []);
  const disconnect = useCallback(async () => { window.localStorage.removeItem("orakel.wallet"); setAddress(undefined); setError(undefined); }, []);
  const signTransaction = useCallback(async (xdr: string) => {
    if (!address) throw new Error("Connect a wallet first.");
    if (!kit.current) throw new Error("Wallet support is still loading.");
    const result = await kit.current.signTransaction(xdr, { networkPassphrase: "Test SDF Network ; September 2015" });
    return result.signedTxXdr;
  }, [address]);
  return <WalletContext.Provider value={{ address, connecting, error, connect, disconnect, signTransaction }}>{children}</WalletContext.Provider>;
}
export function useWallet() { const value = useContext(WalletContext); if (!value) throw new Error("useWallet must be used inside WalletProvider"); return value; }
