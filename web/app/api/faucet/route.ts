import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { rateLimit, requestKey } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const limitResult = rateLimit(requestKey(request));
  if (!limitResult.allowed) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  let wallet = "";
  try { wallet = String((await request.json()).wallet ?? ""); }
  catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  if (!/^G[A-Z2-7]{55}$/.test(wallet)) return NextResponse.json({ error: "A valid Stellar wallet address is required." }, { status: 400 });
  let db: ReturnType<typeof getSupabaseAdmin> | null = null;
  let slotClaimed = false;
  try {
    const cooldownSeconds = 86_400;
    db = getSupabaseAdmin();
    const { data, error } = await db.rpc("claim_faucet_slot", { p_wallet: wallet, p_cooldown_seconds: cooldownSeconds });
    if (error) throw new Error(error.message);
    const slot = Array.isArray(data) ? data[0] : data;
    if (!slot?.allowed) return NextResponse.json({ error: "Faucet cooldown is active for this wallet.", nextAvailableAt: slot?.next_available_at ?? null }, { status: 429 });
    slotClaimed = true;
    const response = await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(wallet)}`, { headers: { accept: "application/json" }, cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(typeof result?.detail === "string" ? result.detail : `Friendbot returned ${response.status}.`);
    return NextResponse.json({ funded: true, wallet, result });
  } catch (error) {
    if (db && slotClaimed) await db.rpc("release_faucet_slot", { p_wallet: wallet });
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Supabase server configuration is missing")) return NextResponse.json({ error: "The faucet is temporarily unavailable while its server database connection is configured." }, { status: 503 });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
