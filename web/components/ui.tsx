import { cn } from "@/lib/utils";

export function Button({ className, variant = "default", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "outline" | "ghost" }) {
  return <button className={cn("focus-ring inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-45", variant === "default" && "bg-blue-500 text-white hover:bg-blue-400", variant === "outline" && "border border-slate-600 text-slate-100 hover:bg-slate-800", variant === "ghost" && "text-slate-300 hover:bg-slate-800", className)} {...props} />;
}
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) { return <div className={cn("panel rounded-xl", className)} {...props} />; }
export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) { return <span className={cn("inline-flex items-center rounded-full border border-slate-600 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide", className)} {...props} />; }
export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) { return <input className="focus-ring h-11 w-full rounded-md border border-slate-600 bg-slate-950/70 px-3 text-sm text-white placeholder:text-slate-500" {...props} />; }
