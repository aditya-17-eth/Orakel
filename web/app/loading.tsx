export default function Loading() {
  return <div className="container mx-auto space-y-4 px-4 py-8"><div className="h-10 w-64 animate-pulse rounded-lg bg-muted" /><div className="grid gap-4 md:grid-cols-3">{[0, 1, 2].map((id) => <div key={id} className="h-44 animate-pulse rounded-lg bg-muted" />)}</div></div>;
}
