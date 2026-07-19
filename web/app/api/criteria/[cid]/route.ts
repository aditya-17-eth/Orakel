import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ cid: string }> }) {
  const { cid } = await params;
  const gateway = `https://gateway.pinata.cloud/ipfs/${encodeURIComponent(cid)}`;
  const headers: HeadersInit = {};
  if (process.env.PINATA_JWT) headers.Authorization = `Bearer ${process.env.PINATA_JWT}`;
  const response = await fetch(gateway, { headers, next: { revalidate: 60 } });
  if (!response.ok) return NextResponse.json({ error: `Pinata returned ${response.status}` }, { status: response.status });
  return new NextResponse(await response.text(), { status: 200, headers: { "content-type": response.headers.get("content-type") ?? "text/plain" } });
}
