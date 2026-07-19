import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { rateLimit, requestKey } from "@/lib/rate-limit";

const BPS = 10_000n;
// The deployed Testnet contract was initialized with 100 protocol + 100 LP bps.
const TOTAL_FEE_BPS = 200n;

type EventRow = { ledger: number; name: string; data: unknown; ledger_closed_at: string | null };
type Point = { time: number; priceBps: number };

function asBigInt(value: unknown) { return BigInt(String(value ?? 0)); }
function asBool(value: unknown) { return value === true || value === "true" || value === 1 || value === "1"; }
function sqrt(value: bigint) {
  if (value < 2n) return value;
  let previous = value;
  let next = (value >> 1n) + 1n;
  while (next < previous) { previous = next; next = (next + value / next) >> 1n; }
  return previous;
}

function priceBps(yesReserve: bigint, noReserve: bigint) {
  const total = yesReserve + noReserve;
  return total > 0n ? Number((noReserve * BPS) / total) : 5_000;
}

function dateForEvent(event: EventRow) {
  const parsed = event.ledger_closed_at ? Date.parse(event.ledger_closed_at) : NaN;
  return Number.isFinite(parsed) ? parsed : event.ledger * 5_000;
}

/** Replays public AMM events to provide an exact history for the 2% Testnet pool. */
function buildHistory(events: EventRow[]) {
  let yesReserve = 0n;
  let noReserve = 0n;
  let totalLp = 0n;
  const points: Point[] = [];

  for (const event of events) {
    const data = Array.isArray(event.data) ? event.data : [];
    try {
      if (event.name === "mkt_new") {
        yesReserve = asBigInt(event.data);
        noReserve = yesReserve;
        totalLp = yesReserve;
      } else if (yesReserve > 0n && noReserve > 0n && event.name === "buy") {
        const buyYes = asBool(data[0]);
        const amountIn = asBigInt(data[1]);
        const sharesOut = asBigInt(data[2]);
        const invest = (amountIn * (BPS - TOTAL_FEE_BPS)) / BPS;
        if (buyYes) { yesReserve = invest + yesReserve - sharesOut; noReserve += invest; }
        else { noReserve = invest + noReserve - sharesOut; yesReserve += invest; }
      } else if (yesReserve > 0n && noReserve > 0n && event.name === "sell") {
        const sellYes = asBool(data[0]);
        const sharesIn = asBigInt(data[1]);
        const a = sellYes ? yesReserve : noReserve;
        const b = sellYes ? noReserve : yesReserve;
        const total = a + sharesIn + b;
        const amountBurned = (total - sqrt(total * total - 4n * sharesIn * b)) / 2n;
        if (sellYes) { yesReserve = a + sharesIn - amountBurned; noReserve = b - amountBurned; }
        else { noReserve = a + sharesIn - amountBurned; yesReserve = b - amountBurned; }
      } else if (yesReserve > 0n && noReserve > 0n && event.name === "liq_add") {
        const amount = asBigInt(event.data);
        const maxReserve = yesReserve >= noReserve ? yesReserve : noReserve;
        const addYes = (amount * yesReserve) / maxReserve;
        const addNo = (amount * noReserve) / maxReserve;
        const minted = (amount * totalLp) / maxReserve;
        yesReserve += addYes; noReserve += addNo; totalLp += minted;
      } else if (yesReserve > 0n && noReserve > 0n && totalLp > 0n && event.name === "liq_rem") {
        const amount = asBigInt(event.data);
        yesReserve -= (yesReserve * amount) / totalLp;
        noReserve -= (noReserve * amount) / totalLp;
        totalLp -= amount;
      } else {
        continue;
      }
      points.push({ time: dateForEvent(event), priceBps: priceBps(yesReserve, noReserve) });
    } catch {
      // One malformed legacy event must not prevent an otherwise useful chart.
    }
  }
  return points;
}

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const marketId = Number(id);
  const limit = rateLimit(requestKey(request));
  if (!Number.isInteger(marketId) || marketId < 0) return NextResponse.json({ error: "Invalid market id." }, { status: 400 });
  if (!limit.allowed) return NextResponse.json({ error: "Too many requests." }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
  try {
    const contractId = process.env.NEXT_PUBLIC_CONTRACT_ID ?? process.env.CONTRACT_ID;
    if (!contractId) throw new Error("Contract ID is not configured.");
    const { data, error } = await getSupabaseAdmin()
      .from("contract_events")
      .select("ledger,name,data,ledger_closed_at")
      .eq("contract_id", contractId)
      .contains("topics", [marketId])
      .in("name", ["mkt_new", "buy", "sell", "liq_add", "liq_rem"])
      .order("ledger", { ascending: true })
      .limit(2_000);
    if (error) throw error;
    return NextResponse.json({ points: buildHistory((data ?? []) as EventRow[]) }, { headers: { "cache-control": "public, max-age=10, stale-while-revalidate=60" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 503 });
  }
}
