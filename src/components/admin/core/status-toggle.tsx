"use client";

import { STATUSES, STATUS_LABEL, STATUS_STYLE, type ComponentStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";

const ACTIVE: Record<ComponentStatus, string> = {
  OPERATIONAL: "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/40",
  MAINTENANCE: "bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-500/40",
  OUTAGE: "bg-rose-500/15 text-rose-300 ring-1 ring-inset ring-rose-500/40",
};

/** Segmentierter Ein-Klick-Umschalter für OPERATIONAL | MAINTENANCE | OUTAGE. */
export function StatusToggle({
  value,
  onChange,
  disabled = false,
  label,
  className,
}: {
  value: string;
  onChange: (next: ComponentStatus) => void;
  disabled?: boolean;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("inline-flex rounded-lg border border-zinc-800 bg-zinc-950 p-0.5", disabled && "opacity-60", className)}
    >
      {STATUSES.map((s) => {
        const active = value === s;
        return (
          <button
            key={s}
            type="button"
            aria-pressed={active}
            disabled={disabled}
            onClick={() => {
              if (!active) onChange(s);
            }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-wait",
              active ? ACTIVE[s] : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100",
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", active ? STATUS_STYLE[s].dot : "bg-zinc-600")} aria-hidden="true" />
            {STATUS_LABEL[s]}
          </button>
        );
      })}
    </div>
  );
}
