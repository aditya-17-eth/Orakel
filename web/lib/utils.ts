import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function shortAddress(address: string) {
  return address.length > 12 ? `${address.slice(0, 5)}…${address.slice(-5)}` : address;
}

export function formatPercent(bps: bigint | number | string) {
  return `${(Number(bps) / 100).toFixed(2)}%`;
}

export function formatStroops(value: bigint | number | string) {
  return (Number(value) / 10_000_000).toFixed(4);
}

export function parseTokenAmount(value: string, decimals = 7) {
  const normalized = value.trim();
  if (!/^\d*(\.\d*)?$/.test(normalized) || normalized === "" || normalized === ".") return 0n;
  const [whole = "0", fraction = ""] = normalized.split(".");
  const padded = fraction.slice(0, decimals).padEnd(decimals, "0");
  return BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt(padded || "0");
}

export function ipfsUrl(reference: string) {
  if (reference.startsWith("ipfs://")) {
    return `https://gateway.pinata.cloud/ipfs/${reference.slice(7)}`;
  }
  if (/^bafy|^Qm/.test(reference)) {
    return `https://gateway.pinata.cloud/ipfs/${reference}`;
  }
  return reference;
}

export function formatNumber(num: number): string {
  if (num >= 1e9) return (num / 1e9).toFixed(2) + "B";
  if (num >= 1e6) return (num / 1e6).toFixed(2) + "M";
  if (num >= 1e3) return (num / 1e3).toFixed(2) + "K";
  return num.toFixed(2);
}

export function formatAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
