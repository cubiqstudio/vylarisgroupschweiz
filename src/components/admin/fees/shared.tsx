import Link from "next/link";
import { cn } from "@/lib/utils";
import { PILL } from "@/components/admin/core/styles";
import { Notice } from "@/components/admin/core/notice";
import { INVOICE_STATUS_LABEL, INVOICE_STATUS_TONE, REMINDER_LEVEL_LABEL, TONE_CLASS, type InvoiceStatus } from "@/lib/verein/constants";
import { isPastDue } from "@/lib/verein/dates";
import { formatChf } from "@/lib/verein/money";

/** Rechnungsstatus als Pille. Offene Rechnungen mit abgelaufener Fälligkeit zeigen «Überfällig». */
export function InvoiceStatusPill({ status, dueDate, openRappen }: { status: string; dueDate?: Date | string; openRappen?: number }) {
  const known = (status in INVOICE_STATUS_LABEL ? status : "ENTWURF") as InvoiceStatus;
  const overdue = known === "OFFEN" && dueDate !== undefined && (openRappen ?? 1) > 0 && isPastDue(new Date(dueDate));
  return <span className={cn(PILL, overdue ? TONE_CLASS.rose : TONE_CLASS[INVOICE_STATUS_TONE[known]])}>{overdue ? "Überfällig" : INVOICE_STATUS_LABEL[known]}</span>;
}

export function ReminderPill({ level }: { level: number }) {
  if (level <= 0) return null;
  return <span className={cn(PILL, level >= 3 ? TONE_CLASS.rose : TONE_CLASS.amber)}>{REMINDER_LEVEL_LABEL[level] ?? `${level}. Mahnung`}</span>;
}

/** Betrag rechtsbündig mit Tausendertrenner. */
export function Chf({ rappen, className, withCurrency }: { rappen: number; className?: string; withCurrency?: boolean }) {
  return <span className={cn("tabular-nums whitespace-nowrap", className)}>{withCurrency ? `CHF ${formatChf(rappen)}` : formatChf(rappen)}</span>;
}

/** Hinweis, wenn für Rechnungen oder Mahnungen Einstellungen fehlen. */
export function MissingSettingsNotice({ title, missing, canEdit }: { title: string; missing: Array<{ message: string }>; canEdit: boolean }) {
  if (missing.length === 0) return null;
  return (
    <Notice variant="warning" className="mb-6">
      <p className="font-medium">{title}</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5">
        {missing.map((m) => (
          <li key={m.message}>{m.message}</li>
        ))}
      </ul>
      <p className="mt-2">
        {canEdit ? (
          <Link href="/admin/verein/finanzen" className="font-medium underline underline-offset-2">
            Zu den Finanz-Einstellungen
          </Link>
        ) : (
          "Bitte den Kassier oder die Administration, diese Angaben in den Vereinseinstellungen (Finanzen) einzutragen."
        )}
      </p>
    </Notice>
  );
}

/** Tabellenrahmen, der auf schmalen Bildschirmen horizontal scrollt. */
export function TableWrap({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="overflow-x-auto" role="region" aria-label={label} tabIndex={0}>
      {children}
    </div>
  );
}

export const TH = "px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500";
export const TD = "px-4 py-3 text-sm text-zinc-300 align-top";
