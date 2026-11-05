import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-zinc-800 bg-surface shadow-sm shadow-slate-900/5", className)} {...props} />;
}
