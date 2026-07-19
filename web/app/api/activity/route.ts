import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { rateLimit, requestKey } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
const EVENT_NAMES = ["buy", "sell", "liq_add", "liq_rem", "borrow", "repay", "loan_set", "claim", "claim_lp"];

export async function GET(request: Request) {
  const limitResult = rateLimit(requestKey(request));
  if (!limitResult.allowed) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const url = new URL(request.url);
  const wallet = url.searchParams.get("wallet") ?? "";
  if (!/^G[A-Z2-7]{55}$/.test(wallet)) return NextResponse.json({ error: "A valid Stellar wallet address is required." }, { status: 400 });
  const requested = Number(url.searchParams.get("limit") ?? 30);
  const pageSize = Number.isInteger(requested) ? Math.min(Math.max(requested, 1), 100) : 30;
  try {
    const contractId = process.env.NEXT_PUBLIC_CONTRACT_ID ?? process.env.CONTRACT_ID;
    let query = getSupabaseAdmin().from("contract_events").select("id,ledger,tx_hash,name,topics,data,ledger_closed_at").in("name", EVENT_NAMES).contains("topics", [wallet]).order("id", { ascending: false }).limit(pageSize);
    if (contractId) query = query.eq("contract_id", contractId);
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ wallet, events: data ?? [] }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 503 }); }
}
