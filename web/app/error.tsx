"use client";
import { useEffect } from "react";
import { Button, Card } from "@/components/ui";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Stellar Predict route error"); }, []);
  return <main className="grid min-h-screen place-items-center bg-[#07101d] px-6"><Card className="max-w-md p-8 text-center"><h1 className="text-xl font-semibold">Something went wrong</h1><p className="mt-2 text-sm text-slate-400">The page could not load. Try again before submitting another transaction.</p><Button className="mt-6" onClick={() => reset()}>Try again</Button></Card></main>;
}
