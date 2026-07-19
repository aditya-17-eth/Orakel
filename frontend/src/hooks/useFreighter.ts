"use client";

import { useState, useEffect, useCallback } from "react";
import {
  isConnected,
  getAddress,
  requestAccess,
  signTransaction,
  getNetwork,
} from "@stellar/freighter-api";

export function useFreighter() {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [network, setNetwork] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const checkConnection = async () => {
    try {
      const { isConnected: installed } = await isConnected();
      if (!installed) {
        setLoading(false);
        return;
      }

      const { address: addr } = await getAddress();
      if (!addr) {
        setLoading(false);
        return;
      }

      const { network: net } = await getNetwork();
      setConnected(true);
      setAddress(addr);
      setNetwork(net);
    } catch {
      // Freighter not available
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void (async () => {
      await checkConnection();
    })();
  }, []);

  const connect = useCallback(async () => {
    const { isConnected: installed } = await isConnected();
    if (!installed) {
      throw new Error("Freighter extension not installed");
    }

    const { address: addr, error: accessError } = await requestAccess();
    if (accessError) throw new Error(accessError.message);

    const { network: net } = await getNetwork();
    setConnected(true);
    setAddress(addr);
    setNetwork(net);
    return addr;
  }, []);

  const disconnect = useCallback(() => {
    setConnected(false);
    setAddress(null);
    setNetwork(null);
  }, []);

  const sign = useCallback(
    async (xdr: string, networkPassphrase: string) => {
      if (!connected) throw new Error("Wallet not connected");
      const { signedTxXdr, error } = await signTransaction(xdr, {
        networkPassphrase,
      });
      if (error) throw new Error(error.message);
      return signedTxXdr;
    },
    [connected]
  );

  return { connected, address, network, connect, disconnect, sign, loading };
}
