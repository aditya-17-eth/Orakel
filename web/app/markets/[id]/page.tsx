import { AppShell } from "@/components/app-shell";
import { MarketDetail } from "@/components/market-detail";
export default async function MarketPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <AppShell><MarketDetail id={Number(id)} /></AppShell>; }
