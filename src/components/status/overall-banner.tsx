import { AlertTriangle, CheckCircle2, Wrench } from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";
import { STATUS_STYLE, type ComponentStatus } from "@/lib/constants";
import { labelFor } from "@/i18n/labels";
import { getLocale, getMessages } from "@/i18n/server";
import { status as messages } from "@/i18n/status";

const TINT: Record<ComponentStatus, string> = {
  OPERATIONAL: "border-green-600/30 bg-green-500/[0.08]",
  MAINTENANCE: "border-amber-600/30 bg-amber-500/[0.08]",
  OUTAGE: "border-rose-600/30 bg-rose-500/[0.08]",
};
const ICON: Record<ComponentStatus, typeof CheckCircle2> = {
  OPERATIONAL: CheckCircle2,
  MAINTENANCE: Wrench,
  OUTAGE: AlertTriangle,
};

export async function OverallBanner({
  status,
  updatedAt,
}: {
  status: ComponentStatus;
  updatedAt: Date | null;
}) {
  const locale = await getLocale();
  const m = (await getMessages(messages)).banner;
  const Icon = ICON[status];
  return (
    <section
      aria-label={m.label}
      className={cn("rounded-2xl border p-6 sm:p-8", TINT[status])}
    >
      <div
        role="status"
        className="flex flex-col gap-5 sm:flex-row sm:items-center"
      >
        <span
          className={cn(
            "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-surface/80 ring-1 ring-inset ring-zinc-800",
            STATUS_STYLE[status].text,
          )}
        >
          <Icon className="h-7 w-7" aria-hidden />
        </span>
        <div className="min-w-0">
          <p
            className={cn(
              "text-2xl font-semibold tracking-tight sm:text-3xl",
              STATUS_STYLE[status].text,
            )}
          >
            {labelFor("overall", status, locale)}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-zinc-400 sm:text-base">
            {m.sub[status]}
          </p>
          {updatedAt && (
            <p className="mt-3 text-xs text-zinc-500">
              {m.asOf} {formatDateTime(updatedAt, locale)}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
