import Link from "next/link";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import type { ReactNode } from "react";

export function StatCard({
  label,
  value,
  detail,
  href,
  accent = "text-white",
  icon,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  href?: string;
  accent?: string;
  icon?: ReactNode;
}) {
  const inner = (
    <Card className={cn("h-full p-5 transition-colors", href && "hover:border-zinc-700 hover:bg-zinc-900")}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-zinc-400">{label}</p>
        {icon && <span className="text-zinc-500" aria-hidden="true">{icon}</span>}
      </div>
      <p className={cn("mt-3 text-3xl font-semibold tracking-tight tabular-nums", accent)}>{value}</p>
      {detail && <p className="mt-1.5 text-sm text-zinc-500">{detail}</p>}
    </Card>
  );
  if (!href) return inner;
  return (
    <Link href={href} className="block rounded-2xl">
      {inner}
    </Link>
  );
}
