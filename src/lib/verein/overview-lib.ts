// Fachlogik der Übersicht (Dashboard): welche Bereiche eine Rolle sieht, Zusammenfassung der Rechnungen, Einrichtungshilfe.
// Reine Funktionen ohne Seiteneffekte (Tests: scripts/test/overview.test.mts); Datenzugriff: ./overview-data.ts.
import { isPastDue } from "./dates";
import { canAccess } from "./permissions";
import type { MissingSetting, VereinSettingField } from "./settings-schema";

/** Welche Bereiche der Übersicht eine Rolle sieht. Grundlage ist die Rechtematrix (permissions.ts), nie eine zweite Liste. */
export type DashboardSections = {
  members: boolean;
  fees: boolean;
  ledger: boolean;
  meetings: boolean;
  events: boolean;
  tasks: boolean;
  /** Website-Kennzahlen (Tickets, Dienste, Status, Blog, Lizenzen) */
  website: boolean;
  /** Einrichtungshilfe (fehlende Einstellungen) */
  setup: boolean;
  /** Link zu den Vereins-/Finanzeinstellungen darf angezeigt werden */
  verein: boolean;
  finance: boolean;
  /** Betriebsanzeige «Täglicher Lauf» (Rechte «system» oder «verein_settings», nur lesend) */
  cron: boolean;
};

export function dashboardSections(roles: readonly string[]): DashboardSections {
  const verein = canAccess(roles, "verein_settings", "read");
  const finance = canAccess(roles, "finance_settings", "read");
  return {
    members: canAccess(roles, "members", "read"),
    fees: canAccess(roles, "fees", "read"),
    ledger: canAccess(roles, "ledger", "read"),
    meetings: canAccess(roles, "meetings", "read"),
    events: canAccess(roles, "events", "read"),
    tasks: canAccess(roles, "tasks", "read"),
    website: canAccess(roles, "website", "read"),
    setup: verein || finance,
    verein,
    finance,
    cron: canAccess(roles, "system", "read") || verein,
  };
}

export type InvoiceLike = { status: string; totalRappen: number; paidRappen: number; dueDate: Date };

export type InvoiceSummary = { openCount: number; openRappen: number; overdueCount: number; overdueRappen: number };

/**
 * Offene und überfällige Rechnungen. Offen = Status OFFEN mit Restbetrag; überfällig = offen und die Frist ist vor `now` abgelaufen
 * (der Fälligkeitstag selbst gilt noch als rechtzeitig). Entwürfe, bezahlte und stornierte Rechnungen zählen nie.
 */
export function summarizeInvoices(rows: readonly InvoiceLike[], now: Date = new Date()): InvoiceSummary {
  const out: InvoiceSummary = { openCount: 0, openRappen: 0, overdueCount: 0, overdueRappen: 0 };
  for (const r of rows) {
    if (r.status !== "OFFEN") continue;
    const rest = Math.max(0, r.totalRappen - r.paidRappen);
    if (rest === 0) continue;
    out.openCount += 1;
    out.openRappen += rest;
    if (isPastDue(r.dueDate, now)) {
      out.overdueCount += 1;
      out.overdueRappen += rest;
    }
  }
  return out;
}

// ---- Einrichtungshilfe ---------------------------------------------------------------------------------------------

export type SetupGroupKey = "invoicing" | "reminders" | "invitations";

export type SetupGroup = {
  key: SetupGroupKey;
  title: string;
  /** Wofür die Angaben gebraucht werden */
  purpose: string;
  items: string[];
  /** Wo die Angaben eingetragen werden */
  href: string;
  linkLabel: string;
};

const FINANCE_FIELDS: readonly VereinSettingField[] = [
  "accountHolder",
  "iban",
  "qrIban",
  "bank",
  "bic",
  "payeeName",
  "paymentDays",
  "reminderAfterDays",
  "reminderDays1",
  "reminderDays2",
  "reminderDays3",
  "reminderFee1Rappen",
  "reminderFee2Rappen",
  "reminderFee3Rappen",
];

/** Einstellungsseite, auf der ein Feld eingetragen wird. */
export function settingsHrefFor(field: VereinSettingField): string {
  return FINANCE_FIELDS.includes(field) ? "/admin/verein/finanzen" : "/admin/verein";
}

const GROUP_META: Record<SetupGroupKey, { title: string; purpose: string }> = {
  invoicing: { title: "Rechnungen", purpose: "Ohne Konto und Zahlungsfrist lassen sich keine Rechnungen erstellen." },
  reminders: { title: "Mahnungen", purpose: "Ohne Fristen lassen sich keine Mahnungen versenden." },
  invitations: { title: "Einladungen", purpose: "Ohne Einladungsfrist gemäss Statuten sperrt die Versammlungsverwaltung den Einladungsversand." },
};

/**
 * Fasst fehlende Einstellungen für die Einrichtungshilfe zusammen. Reihenfolge: Rechnungen, Mahnungen, Einladungen.
 * Gruppen ohne fehlende Angaben entfallen. Der Link führt auf die Seite, auf der die Mehrzahl der Angaben der Gruppe steht.
 */
export function groupMissingSettings(
  invoicing: readonly MissingSetting[],
  reminders: readonly MissingSetting[],
  invitations: readonly MissingSetting[],
): SetupGroup[] {
  const sets: Array<[SetupGroupKey, readonly MissingSetting[]]> = [
    ["invoicing", invoicing],
    ["reminders", reminders],
    ["invitations", invitations],
  ];
  const groups: SetupGroup[] = [];
  for (const [key, list] of sets) {
    if (list.length === 0) continue;
    const href = settingsHrefFor(list[0]!.field);
    groups.push({
      key,
      ...GROUP_META[key],
      items: list.map((m) => m.message),
      href,
      linkLabel: href === "/admin/verein/finanzen" ? "Finanzeinstellungen öffnen" : "Vereinseinstellungen öffnen",
    });
  }
  return groups;
}

/** Anteil der erledigten Einrichtungsschritte (0–100) bei `total` Pflichtangaben, von denen `missing` fehlen. */
export function setupPercent(total: number, missing: number): number {
  if (total <= 0) return 100;
  return Math.round(((total - Math.min(missing, total)) / total) * 100);
}

/** Satz für Kennzahlen mit Einzahl/Mehrzahl, z. B. plural(1, "Antrag", "Anträge") → «1 Antrag». */
export function countLabel(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}
