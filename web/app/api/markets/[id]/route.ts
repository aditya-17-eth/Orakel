import { NextResponse } from "next/server";
import { getMarket, getUserLp, getUserPosition } from "@/lib/contract";
import { ipfsUrl } from "@/lib/utils";
import { rateLimit, requestKey } from "@/lib/rate-limit";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const marketId = Number(id);
  const limit = rateLimit(requestKey(request));
  if (!Number.isInteger(marketId) || marketId < 0) return NextResponse.json({ error: "Invalid market id." }, { status: 400 });
  if (!limit.allowed) return NextResponse.json({ error: "Too many requests." }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
  const url = new URL(request.url);
  const user = url.searchParams.get("user");
  try {
    const market = await getMarket(marketId);
    const position = user ? await getUserPosition(marketId, user) : null;
    const lp = user ? await getUserLp(marketId, user) : null;
    return new NextResponse(JSON.stringify({ market, position, lp, network: "stellar-testnet", criteriaGateway: market.criteriaRef ? ipfsUrl(market.criteriaRef) : null }, (_, value) => typeof value === "bigint" ? value.toString() : value), { headers: { "content-type": "application/json" } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 502 }); }
}
