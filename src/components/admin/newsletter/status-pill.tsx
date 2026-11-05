import { AlertTriangle, CheckCheck, FileEdit, UserCheck, UserMinus, Hourglass, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { PILL } from "@/components/admin/core/styles";
import { CAMPAIGN_STATUS_LABEL, SUBSCRIBER_STATUS_LABEL } from "./types";

const CAMPAIGN_TONE: Record<string, { cls: string; icon: LucideIcon }> = {
  DRAFT: { cls: "bg-zinc-800/80 text-zinc-400 ring-zinc-700", icon: FileEdit },
  SENDING: { cls: "bg-indigo-500/10 text-indigo-300 ring-indigo-500/30", icon: Hourglass },
  SENT: { cls: "bg-green-500/10 text-green-800 ring-green-600/30", icon: CheckCheck },
  FAILED: { cls: "bg-rose-500/10 text-rose-300 ring-rose-500/40", icon: AlertTriangle },
};

export function CampaignStatusPill({ status, className }: { status: string; className?: string }) {
  const tone = CAMPAIGN_TONE[status] ?? CAMPAIGN_TONE.DRAFT;
  const Icon = tone.icon;
  return (
    <span className={cn(PILL, "whitespace-nowrap py-1", tone.cls, className)}>
      {status === "SENDING" ? (
        <span className="relative flex size-2" aria-hidden>
          <span className="absolute inset-0 rounded-full bg-indigo-400/60 motion-safe:animate-ping" />
          <span className="relative size-2 rounded-full bg-indigo-400" />
        </span>
      ) : (
        <Icon className="size-3" aria-hidden />
      )}
      {CAMPAIGN_STATUS_LABEL[status] ?? status}
    </span>
  );
}

const SUBSCRIBER_TONE: Record<string, { cls: string; icon: LucideIcon }> = {
  ACTIVE: { cls: "bg-green-500/10 text-green-800 ring-green-600/30", icon: UserCheck },
  PENDING: { cls: "bg-amber-500/10 text-amber-300 ring-amber-500/30", icon: Hourglass },
  UNSUBSCRIBED: { cls: "bg-zinc-800/80 text-zinc-400 ring-zinc-700", icon: UserMinus },
};

export function SubscriberStatusPill({ status, className }: { status: string; className?: string }) {
  const tone = SUBSCRIBER_TONE[status] ?? SUBSCRIBER_TONE.UNSUBSCRIBED;
  const Icon = tone.icon;
  return (
    <span className={cn(PILL, "whitespace-nowrap py-1", tone.cls, className)}>
      <Icon className="size-3" aria-hidden />
      {SUBSCRIBER_STATUS_LABEL[status] ?? status}
    </span>
  );
}

/** Fortschrittsbalken (zugestellt + fehlgeschlagen von allen Empfängern). */
export function SendProgress({ sent, failed, total, className }: { sent: number; failed: number; total: number; className?: string }) {
  const done = sent + failed;
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const failedPct = total > 0 ? Math.min(100, (failed / total) * 100) : 0;
  return (
    <div
      role="progressbar"
      aria-label="Versandfortschritt"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-valuetext={`${done} von ${total} verarbeitet`}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-zinc-900 ring-1 ring-inset ring-zinc-800", className)}
    >
      <div className="relative h-full rounded-full bg-emerald-400 transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${pct}%` }}>
        {failed > 0 && <div className="absolute inset-y-0 right-0 bg-rose-500" style={{ width: `${pct > 0 ? Math.min(100, (failedPct / pct) * 100) : 0}%` }} />}
      </div>
    </div>
  );
}
