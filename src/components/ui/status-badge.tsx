"use client";

import { cn } from "@/lib/utils";
import { STATUS_STYLE, type ComponentStatus } from "@/lib/constants";
import { useLocale } from "@/i18n/client";
import { labelFor } from "@/i18n/labels";

function isStatus(v: string): v is ComponentStatus {
  return v in STATUS_STYLE;
}

export function StatusDot({ status, pulse = false }: { status: string; pulse?: boolean }) {
  const s = isStatus(status) ? STATUS_STYLE[status] : STATUS_STYLE.OPERATIONAL;
  return (
    <span className="relative inline-flex h-2 w-2">
      {pulse && <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", s.dot)} />}
      <span className={cn("relative inline-flex h-2 w-2 rounded-full", s.dot)} />
    </span>
  );
}

/** Ohne `label` wird die Beschriftung in der Sprache der Seite gewählt (im Admin-Bereich ohne SiteProvider: Deutsch). */
export function StatusBadge({ status, label, className }: { status: string; label?: string; className?: string }) {
  const locale = useLocale();
  const known = isStatus(status);
  const s = known ? STATUS_STYLE[status] : STATUS_STYLE.OPERATIONAL;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
        s.badge,
        className,
      )}
    >
      <StatusDot status={status} />
      {label ?? (known ? labelFor("status", status, locale) : status)}
    </span>
  );
}
