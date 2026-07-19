import * as StellarSdk from "@stellar/stellar-sdk";

export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://soroban-testnet.stellar.org";
export const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID || "";
export const NETWORK_PASSPHRASE = StellarSdk.Networks.TESTNET;
export const rpc = new StellarSdk.rpc.Server(RPC_URL, { allowHttp: RPC_URL.startsWith("http://") });

export const USDC_DECIMALS = 7;
export const UNIT = 10 ** USDC_DECIMALS;

export function usdcToContractAmount(amount: number) {
  return BigInt(Math.round(amount * UNIT));
}

export function contractAmountToUSDC(amount: bigint | number | string | null | undefined) {
  if (amount === null || amount === undefined) return 0;
  return Number(amount) / UNIT;
}

export function requireContractId() {
  if (!CONTRACT_ID) throw new Error("Missing NEXT_PUBLIC_CONTRACT_ID");
  return CONTRACT_ID;
}
