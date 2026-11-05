import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-zinc-300 ring-1 ring-inset ring-zinc-800",
        className,
      )}
      {...props}
    />
  );
}
