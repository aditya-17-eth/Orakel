"use client";

import { createContext, ReactNode, useContext } from "react";
import { useStellarWallet } from "@/hooks/useStellarWallet";

type WalletContextValue = ReturnType<typeof useStellarWallet>;

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const wallet = useStellarWallet();
  return <WalletContext.Provider value={wallet}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const wallet = useContext(WalletContext);
  if (!wallet) throw new Error("useWallet must be used inside WalletProvider");
  return wallet;
}
