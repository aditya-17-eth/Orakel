import { NextResponse } from "next/server";
import { Address } from "@stellar/stellar-sdk";
import { getMarketCount, getMarket, getUserLoan, getUserLp, getUserPosition } from "@/lib/server/market-contract";
import { rateLimit, requestKey } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

function validateWallet(wallet: string) {
  if (!/^G[A-Z2-7]{55}$/.test(wallet)) throw new Error("A valid Stellar wallet address is required.");
  new Address(wallet);
}

export async function GET(request: Request) {
  const limitResult = rateLimit(requestKey(request));
  if (!limitResult.allowed) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const wallet = new URL(request.url).searchParams.get("wallet") ?? "";
  try {
    validateWallet(wallet);
    const count = await getMarketCount();
    const ids = Array.from({ length: Math.min(count, 100) }, (_, id) => id);
    const positions = (await Promise.all(ids.map(async (id) => {
      const [market, position, lpShares, loan] = await Promise.all([getMarket(id), getUserPosition(id, wallet), getUserLp(id, wallet), getUserLoan(id, wallet)]);
      if (position.yes <= 0n && position.no <= 0n && lpShares <= 0n && loan.debt <= 0n) return null;
      const markValue = (position.yes * market.yesPriceBps + position.no * (10_000n - market.yesPriceBps)) / 10_000n;
      const claimable = market.state !== "Resolved" ? 0n : market.outcome === "Yes" ? position.yes : market.outcome === "No" ? position.no : (position.yes + position.no) / 2n;
      return { marketId: id, question: market.question, state: market.state, yesPriceBps: market.yesPriceBps, yesShares: position.yes, noShares: position.no, lpShares, spent: position.spent, markValue, claimable, loanDebt: loan.debt };
    }))).filter(Boolean);
    const totals = positions.reduce((sum, row) => ({ spent: sum.spent + row!.spent, markValue: sum.markValue + row!.markValue, claimable: sum.claimable + row!.claimable, debt: sum.debt + row!.loanDebt }), { spent: 0n, markValue: 0n, claimable: 0n, debt: 0n });
    return new NextResponse(JSON.stringify({ wallet, positions, totals }, (_, value) => typeof value === "bigint" ? value.toString() : value), { headers: { "content-type": "application/json", "cache-control": "private, no-store" } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 }); }
}
