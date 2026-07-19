import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function ipfsUrl(reference: string) {
  if (reference.startsWith("ipfs://")) return `https://gateway.pinata.cloud/ipfs/${reference.slice(7)}`;
  if (/^bafy|^Qm/.test(reference)) return `https://gateway.pinata.cloud/ipfs/${reference}`;
  return reference;
}
