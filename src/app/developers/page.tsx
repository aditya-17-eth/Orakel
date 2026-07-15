"use client";

import { useState } from "react";
import {
  Code,
  Copy,
  Check,
  FileJson,
  Terminal,
  Book,
  ExternalLink,
  Search,
  Layers,
  Cpu,
  RadioTower,
} from "lucide-react";

export default function DevelopersPage() {
  const [activeTab, setActiveTab] = useState<"solidity" | "javascript" | "curl">("solidity");
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText("// Connect to backend API to view code examples");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <div className="min-h-screen py-8 relative">
      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] bg-ultra-magenta/3 rounded-full blur-[120px] animate-drift" />
        <div className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] bg-neon-cyan/3 rounded-full blur-[100px] animate-drift" style={{ animationDelay: "-5s" }} />
      </div>

      <div className="container mx-auto px-4 relative">
        {/* Header */}
        <div className="mb-8 flex items-center gap-4 animate-fade-in-up">
          <div className="h-12 w-12 rounded-xl glass-shard flex items-center justify-center">
            <Terminal className="h-6 w-6 text-ultra-magenta" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Developer Terminal</h1>
            <p className="text-text-muted">Futuristic workspace for protocol integration.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Code Implementation Guide */}
          <div className="lg:col-span-2 p-6 rounded-2xl glass-panel animate-fade-in-up delay-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Cpu className="h-5 w-5 text-neon-cyan" />
                <h2 className="text-lg font-semibold">Quick Start</h2>
              </div>
              <button
                onClick={handleCopy}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg glass-shard-sm transition-all duration-300 text-sm ${
                  copied
                    ? "bg-green/10 text-green glow-border-cyan"
                    : "hover:bg-neon-cyan/10 hover:glow-border-cyan"
                }`}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>

            {/* Code Tabs */}
            <div className="flex gap-2 mb-4">
              {[
                { id: "solidity" as const, label: "Solidity", icon: Code },
                { id: "javascript" as const, label: "JavaScript", icon: FileJson },
                { id: "curl" as const, label: "cURL", icon: Terminal },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? "text-neon-cyan"
                        : "text-text-muted hover:text-foreground"
                    }`}
                  >
                    {isActive && (
                      <div className="absolute inset-0 rounded-lg glass-shard-sm border border-neon-cyan/20 animate-border-glow-pulse" />
                    )}
                    <Icon className="h-4 w-4 relative z-10" />
                    <span className="relative z-10">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Empty Code Block */}
            <div className="relative">
              <div className="absolute top-3 right-3 flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-red/60" />
                <div className="h-2.5 w-2.5 rounded-full bg-yellow/60" />
                <div className="h-2.5 w-2.5 rounded-full bg-green/60" />
              </div>
              <pre className="p-5 rounded-xl bg-deep-space/80 border border-card-border overflow-x-auto text-sm font-mono min-h-[300px] flex items-center justify-center">
                <code className="text-text-muted">{"// Connect to backend API to view code examples"}</code>
              </pre>
            </div>

            {/* Quick Links */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { icon: Book, title: "Documentation", desc: "Full reference", color: "cyan" },
                { icon: Code, title: "SDK Reference", desc: "TypeScript/JS", color: "magenta" },
                { icon: Terminal, title: "CLI Tools", desc: "Command line", color: "lime" },
              ].map((link) => {
                const Icon = link.icon;
                const accentClass = link.color === "cyan" ? "text-neon-cyan" :
                                    link.color === "magenta" ? "text-ultra-magenta" :
                                    "text-electric-lime";
                const glowClass = link.color === "cyan" ? "hover:glow-border-cyan" :
                                  link.color === "magenta" ? "hover:glow-border-magenta" :
                                  "hover:glow-border-lime";
                return (
                  <a
                    key={link.title}
                    href="#"
                    className={`flex items-center gap-3 p-4 rounded-xl glass-shard-sm hover:border-neon-cyan/20 transition-all duration-300 group ${glowClass}`}
                  >
                    <Icon className={`h-5 w-5 ${accentClass} group-hover:scale-110 transition-transform`} />
                    <div className="flex-1">
                      <div className="text-sm font-medium">{link.title}</div>
                      <div className="text-xs text-text-muted">{link.desc}</div>
                    </div>
                    <ExternalLink className="h-4 w-4 text-text-muted group-hover:text-foreground transition-colors" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* REST API Explorer */}
          <div className="p-6 rounded-2xl glass-panel animate-fade-in-up delay-200">
            <div className="flex items-center gap-3 mb-4">
              <Layers className="h-5 w-5 text-electric-lime" />
              <h2 className="text-lg font-semibold">API Explorer</h2>
            </div>
            
            <div className="space-y-3">
              {[
                { method: "GET", path: "/v1/prices/{feed}", desc: "Get latest price", accent: "green" },
                { method: "GET", path: "/v1/feeds/{feed}/rounds", desc: "Get round history", accent: "green" },
                { method: "WS", path: "/v1/stream", desc: "Real-time streaming", accent: "cyan" },
                { method: "GET", path: "/v1/nodes", desc: "List all nodes", accent: "green" },
                { method: "GET", path: "/v1/status", desc: "Network health", accent: "green" },
              ].map((endpoint, i) => (
                <div key={i} className="p-4 rounded-xl glass-shard-sm hover:glow-border-cyan transition-all duration-200 cursor-pointer">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-mono ${
                      endpoint.accent === "green" ? "bg-green/20 text-green" : "bg-neon-cyan/20 text-neon-cyan"
                    }`}>
                      {endpoint.method}
                    </span>
                    <span className="text-sm font-mono text-foreground">{endpoint.path}</span>
                  </div>
                  <p className="text-xs text-text-muted">{endpoint.desc}</p>
                </div>
              ))}
            </div>

            <a
              href="#"
              className="mt-4 flex items-center justify-center gap-2 w-full py-3 rounded-xl glass-shard-sm bg-electric-lime/10 text-electric-lime font-medium hover:bg-electric-lime/20 hover:glow-border-lime transition-all duration-300"
            >
              Open Full Explorer
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>

        {/* Live Feed Directory */}
        <div className="mt-6 p-6 rounded-2xl glass-panel animate-fade-in-up delay-300">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <RadioTower className="h-5 w-5 text-neon-cyan" />
              <h2 className="text-lg font-semibold">Live Feed Directory</h2>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-initial">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                <input
                  type="text"
                  placeholder="Search feeds..."
                  disabled
                  className="w-full sm:w-64 pl-10 pr-4 py-2 rounded-lg glass-shard-sm text-sm focus:outline-none focus:border-neon-cyan/40 focus:glow-border-cyan transition-all duration-200 opacity-50"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center py-12">
            <RadioTower className="h-10 w-10 text-text-muted mb-4" />
            <p className="text-text-muted text-center">
              No feeds available. Connect to the backend API to see live feed data.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
