import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { rateLimit, requestKey } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const limit = rateLimit(requestKey(request));
  if (!limit.allowed) return NextResponse.json({ error: "Too many requests." }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
  const url = new URL(request.url);
  const requested = Number(url.searchParams.get("limit") ?? 50);
  const pageSize = Number.isInteger(requested) ? Math.min(Math.max(requested, 1), 100) : 50;
  try {
    const { data, error } = await getSupabaseAdmin().from("contract_events").select("event_id,ledger,tx_hash,name,topics,data,ledger_closed_at").order("ledger", { ascending: false }).limit(pageSize);
    if (error) throw error;
    return NextResponse.json({ events: data ?? [] }, { headers: { "cache-control": "public, max-age=5, stale-while-revalidate=30" } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 503 }); }
}
