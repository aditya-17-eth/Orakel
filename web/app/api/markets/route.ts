import { NextResponse } from "next/server";
import { getMarkets } from "@/lib/contract";
import { rateLimit, requestKey } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const limit = rateLimit(requestKey(request));
  if (!limit.allowed) return NextResponse.json({ error: "Too many requests." }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
  try { return new NextResponse(JSON.stringify({ markets: await getMarkets(), network: "stellar-testnet" }, (_, value) => typeof value === "bigint" ? value.toString() : value), { headers: { "content-type": "application/json", "cache-control": "public, max-age=10, stale-while-revalidate=30" } }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 502 }); }
}
