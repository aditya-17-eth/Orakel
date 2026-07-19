import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { rateLimit, requestKey } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const limitResult = rateLimit(requestKey(request));
  if (!limitResult.allowed) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  try {
    const contractId = process.env.NEXT_PUBLIC_CONTRACT_ID ?? process.env.CONTRACT_ID;
    if (!contractId) throw new Error("Contract ID is not configured.");
    const { data, error } = await getSupabaseAdmin().rpc("get_trading_leaderboard", { p_contract_id: contractId, p_limit: 50 });
    if (error) throw error;
    return NextResponse.json({ entries: data ?? [], metric: "trading_volume", assetDecimals: 7 }, { headers: { "cache-control": "public, max-age=30, stale-while-revalidate=120" } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 503 }); }
}
