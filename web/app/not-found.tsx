import Link from "next/link";
import { Card } from "@/components/ui";
export default function NotFound() { return <main className="grid min-h-screen place-items-center bg-[#07101d] px-6"><Card className="max-w-md p-8 text-center"><h1 className="text-xl font-semibold">Market not found</h1><p className="mt-2 text-sm text-slate-400">That market does not exist in the current Testnet contract.</p><Link className="mt-6 inline-block text-sm text-blue-300" href="/">Back to markets</Link></Card></main>; }
