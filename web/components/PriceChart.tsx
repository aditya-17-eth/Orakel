"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PricePoint { time: number; priceBps: number }
type Range = "1H" | "1D" | "ALL";

export function PriceChart({ marketId, currentPriceBps }: { marketId: number; currentPriceBps: number }) {
  const [points, setPoints] = useState<PricePoint[]>([]);
  const [range, setRange] = useState<Range>("ALL");
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setUnavailable(false);
    try {
      const response = await fetch(`/api/markets/${marketId}/history`, { cache: "no-store" });
      if (!response.ok) throw new Error("History is unavailable");
      const body = (await response.json()) as { points?: PricePoint[] };
      setPoints(Array.isArray(body.points) ? body.points : []);
    } catch {
      setUnavailable(true);
    } finally {
      setLoading(false);
    }
  }, [marketId]);

  useEffect(() => { queueMicrotask(() => void load()); }, [load]);

  const visiblePoints = useMemo(() => {
    if (range === "ALL" || points.length === 0) return points;
    const period = range === "1H" ? 3_600_000 : 86_400_000;
    const cutoff = (points.at(-1)?.time ?? 0) - period;
    const filtered = points.filter(({ time }) => time >= cutoff);
    return filtered.length > 1 ? filtered : points;
  }, [points, range]);

  const series = useMemo(() => visiblePoints.length > 0 ? visiblePoints : [{ time: 0, priceBps: currentPriceBps }], [currentPriceBps, visiblePoints]);
  const path = useMemo(() => linePath(series), [series]);
  const latest = series.at(-1)?.priceBps ?? currentPriceBps;

  return <Card>
    <CardHeader className="flex-row items-center justify-between space-y-0">
      <div><CardTitle className="flex items-center gap-2 text-lg"><BarChart3 className="size-4" /> YES price</CardTitle><p className="mt-1 text-xs text-muted-foreground">{latest / 100}% implied probability</p></div>
      <div className="flex items-center gap-1">{(["1H", "1D", "ALL"] as Range[]).map((item) => <Button key={item} size="xs" variant={range === item ? "secondary" : "ghost"} onClick={() => setRange(item)}>{item}</Button>)}<Button aria-label="Refresh price history" size="icon-xs" variant="ghost" onClick={load} disabled={loading}><RefreshCw className={loading ? "animate-spin" : ""} /></Button></div>
    </CardHeader>
    <CardContent>
      <div className="relative h-52 overflow-hidden rounded-lg border bg-muted/20">
        <div className="pointer-events-none absolute inset-x-3 top-4 flex justify-between text-xs text-muted-foreground"><span>100¢</span><span>50¢</span><span>0¢</span></div>
        <svg role="img" aria-label="YES price history" viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full px-3 py-6"><defs><linearGradient id={`price-fill-${marketId}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity="0.24"/><stop offset="100%" stopColor="currentColor" stopOpacity="0"/></linearGradient></defs><path d={areaPath(path)} fill={`url(#price-fill-${marketId})`} className="text-primary"/><path d={path} fill="none" stroke="currentColor" strokeWidth="1.6" vectorEffect="non-scaling-stroke" className="text-primary"/></svg>
        <div className="absolute bottom-3 left-3 text-xs text-muted-foreground">{loading ? "Loading indexed price history…" : unavailable ? "Price history will appear when the indexer database is connected." : points.length < 2 ? "History is building. Current price is shown." : `${points.length} indexed price points`}</div>
      </div>
    </CardContent>
  </Card>;
}

function linePath(points: PricePoint[]) {
  if (points.length === 1) { const y = 100 - points[0].priceBps / 100; return `M 0 ${y} L 100 ${y}`; }
  const firstTime = points[0].time;
  const lastTime = points.at(-1)?.time ?? firstTime;
  const span = Math.max(lastTime - firstTime, 1);
  return points.map((point, index) => {
    const x = ((point.time - firstTime) / span) * 100;
    const y = 100 - Math.min(Math.max(point.priceBps, 0), 10_000) / 100;
    return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");
}

function areaPath(path: string) { return `${path} L 100 100 L 0 100 Z`; }
