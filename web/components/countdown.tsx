"use client";

import { useEffect, useState } from "react";

function formatRemaining(seconds: number) {
  if (seconds <= 0) return "Ended";
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const secs = seconds % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  return `${minutes}m ${secs}s`;
}

export function Countdown({ timestamp }: { timestamp: number }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, timestamp - Math.floor(Date.now() / 1000)));
  useEffect(() => {
    const update = () => setRemaining(Math.max(0, timestamp - Math.floor(Date.now() / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [timestamp]);
  return <span>{formatRemaining(remaining)}</span>;
}
