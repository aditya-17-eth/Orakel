"use client";

import {
  Activity,
  Radio,
} from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="min-h-screen py-8 relative">
      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-neon-cyan/3 rounded-full blur-[120px] animate-drift" />
        <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] bg-ultra-magenta/3 rounded-full blur-[100px] animate-drift" style={{ animationDelay: "-6s" }} />
      </div>

      <div className="container mx-auto px-4 relative">
        {/* Header */}
        <div className="mb-8 flex items-center gap-4 animate-fade-in-up">
          <div className="h-12 w-12 rounded-xl glass-shard flex items-center justify-center">
            <Radio className="h-6 w-6 text-neon-cyan" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Network Pulse</h1>
            <p className="text-text-muted">Real-time telemetry shards across the global topology.</p>
          </div>
        </div>

        {/* Empty State */}
        <div className="flex flex-col items-center justify-center py-24 animate-fade-in-up delay-200">
          <div className="h-20 w-20 rounded-2xl glass-panel flex items-center justify-center mb-6">
            <Activity className="h-10 w-10 text-text-muted" />
          </div>
          <h2 className="text-xl font-semibold mb-2">No feeds connected</h2>
          <p className="text-text-muted text-center max-w-md">
            Connect to the backend API to see live network telemetry, price feeds, and shard topology.
          </p>
        </div>
      </div>
    </div>
  );
}
