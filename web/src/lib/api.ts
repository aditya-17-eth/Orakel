import { BackendMarketDetail } from "@/lib/types";

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export function getBackendMarkets() {
  return getJson<unknown[]>("/api/markets");
}

export function getBackendMarket(id: number) {
  return getJson<BackendMarketDetail>(`/api/markets/${id}`);
}

export function getBackendEvents(limit = 50) {
  return getJson<unknown[]>(`/api/events?limit=${limit}`);
}

export function getBackendCriteria(cid: string) {
  return getJson<unknown>(`/api/criteria/${cid}`);
}

export function getBackendHealth() {
  return getJson<{ ok?: boolean; status?: string }>("/api/health");
}
