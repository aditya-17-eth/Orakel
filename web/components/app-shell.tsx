export function AppShell({ children }: { children: React.ReactNode }) {
  return <div className="grid-bg min-h-screen"><main className="mx-auto max-w-7xl px-4 py-10 sm:px-8">{children}</main></div>;
}
