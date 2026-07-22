import * as StellarSdk from "@stellar/stellar-sdk";

const NETWORK = process.env.NEXT_PUBLIC_STELLAR_NETWORK || "testnet";

export const config = {
  testnet: {
    horizonUrl: "https://horizon-testnet.stellar.org",
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: StellarSdk.Networks.TESTNET,
    friendbotUrl: "https://friendbot.stellar.org",
  },
  mainnet: {
    horizonUrl: "https://horizon.stellar.org",
    rpcUrl: process.env.NEXT_PUBLIC_STELLAR_MAINNET_RPC_URL || "",
    networkPassphrase: StellarSdk.Networks.PUBLIC,
    friendbotUrl: null,
  },
}[NETWORK]!;

export const horizon = new StellarSdk.Horizon.Server(config.horizonUrl);
export const rpc = new StellarSdk.rpc.Server(config.rpcUrl);

// Contract ID from env
export const CONTRACT_ID = process.env.NEXT_PUBLIC_ORAKEL_CONTRACT_ID || "";

// USDC decimals on Stellar = 7
export const USDC_DECIMALS = 7;
export const USDC_TO_stroop = (amount: number) =>
  BigInt(Math.round(amount * 10 ** USDC_DECIMALS));
export const stroopToUSDC = (stroops: bigint) =>
  Number(stroops) / 10 ** USDC_DECIMALS;
