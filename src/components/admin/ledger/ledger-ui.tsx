import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PILL } from "@/components/admin/core/styles";
import { TONE_CLASS, TRANSACTION_DIRECTION_LABEL, type TransactionDirection } from "@/lib/verein/constants";
import { TRANSACTION_STATE_LABEL, type TransactionState } from "@/lib/verein/ledger-lib";
import { formatChf } from "@/lib/verein/money";

export const TH = "px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500";
export const THR = "px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-zinc-500";
export const TD = "px-4 py-3 align-top";
export const TDR = "px-4 py-3 text-right align-top tabular-nums whitespace-nowrap";

/** Betrag mit Tausendertrenner; `signed` färbt und setzt ein Vorzeichen (+ Einnahme, − Ausgabe). */
export function Amount({ rappen, signed = false, className }: { rappen: number; signed?: boolean; className?: string }) {
  const tone = !signed || rappen === 0 ? "" : rappen > 0 ? "text-emerald-400" : "text-rose-400";
  const text = signed && rappen > 0 ? `+${formatChf(rappen)}` : formatChf(rappen);
  return <span className={cn("tabular-nums whitespace-nowrap", tone, className)}>{text}</span>;
}

const STATE_TONE: Record<TransactionState, string> = { AKTIV: "", STORNIERT: TONE_CLASS.rose, STORNO: TONE_CLASS.amber };

export function StatePill({ state }: { state: TransactionState }) {
  if (state === "AKTIV") return null;
  return <span className={cn(PILL, STATE_TONE[state])}>{TRANSACTION_STATE_LABEL[state]}</span>;
}

const DIRECTION_TONE: Record<string, string> = { EINNAHME: TONE_CLASS.green, AUSGABE: TONE_CLASS.rose, UMBUCHUNG: TONE_CLASS.zinc };

export function DirectionPill({ direction }: { direction: string }) {
  return <span className={cn(PILL, DIRECTION_TONE[direction] ?? TONE_CLASS.zinc)}>{TRANSACTION_DIRECTION_LABEL[direction as TransactionDirection] ?? direction}</span>;
}

export function TableWrap({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="overflow-x-auto" role="region" aria-label={label} tabIndex={0}>
      {children}
    </div>
  );
}

export function Stat({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-surface px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-white">{children}</p>
      {hint && <p className="mt-0.5 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}
