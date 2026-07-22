"use client";

import { useCallback, useMemo, useState } from "react";
import { NETWORK_PASSPHRASE } from "@/lib/stellar";

type WalletKit = {
  openModal: (args: { onWalletSelected: (option: { id: string }) => Promise<void> }) => Promise<void>;
  setWallet: (id: string) => void;
  getAddress: () => Promise<{ address: string }>;
  signTransaction: (xdr: string, options?: Record<string, unknown>) => Promise<{ signedTxXdr: string } | string>;
};

let kitPromise: Promise<WalletKit> | null = null;

async function getKit() {
  if (!kitPromise) {
    kitPromise = import("@creit.tech/stellar-wallets-kit").then((wallets) => {
      const selectedWalletId = wallets.FREIGHTER_ID || "freighter";
      return new wallets.StellarWalletsKit({
        network: wallets.WalletNetwork.TESTNET,
        selectedWalletId,
        modules: wallets.allowAllModules(),
      }) as WalletKit;
    });
  }

  return kitPromise;
}

export function useStellarWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      const kit = await getKit();
      await kit.openModal({
        onWalletSelected: async (option) => {
          kit.setWallet(option.id);
          const result = await kit.getAddress();
          setAddress(result.address);
        },
      });
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
  }, []);

  const sign = useCallback(
    async (xdr: string) => {
      if (!address) throw new Error("Connect a wallet first");
      const kit = await getKit();
      const result = await kit.signTransaction(xdr, {
        address,
        networkPassphrase: NETWORK_PASSPHRASE,
      });

      return typeof result === "string" ? result : result.signedTxXdr;
    },
    [address],
  );

  return useMemo(
    () => ({
      address,
      connected: Boolean(address),
      connecting,
      connect,
      disconnect,
      sign,
    }),
    [address, connecting, connect, disconnect, sign],
  );
}
