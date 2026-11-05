// Mahnwesen (rein, ohne Datenbank): Wann ist welche Mahnstufe möglich, neue Fristen und neutrale Standardtexte.
// Die Fristen und Gebühren legt der Verein in den Vereinseinstellungen fest; diese Datei erfindet keine Werte.
// Eine Mahnung ist eine Aufforderung des Vereins. Welche rechtlichen Folgen sie hat (z. B. Verzug, Betreibung), entscheiden die Statuten
// und das Gesetz, nicht diese Software.
import { daysBetween, reminderDueDate } from "./dates";
import { MAX_REMINDER_LEVEL } from "./constants";
import { openAmount } from "./money";
import { reminderDaysFor, type VereinSettings } from "./settings-schema";

export type ReminderSettings = Pick<
  VereinSettings,
  "reminderAfterDays" | "reminderDays1" | "reminderDays2" | "reminderDays3" | "reminderFee1Rappen" | "reminderFee2Rappen" | "reminderFee3Rappen"
>;

export type ReminderInvoice = {
  status: string;
  dueDate: Date;
  totalRappen: number;
  paidRappen: number;
  /** bisher versandte Mahnstufe (0 = keine) */
  reminderLevel: number;
  /** Zahlungsfrist der zuletzt versandten Mahnung (null, wenn nie gemahnt) */
  lastReminderDueDate: Date | null;
};

export type ReminderState =
  | { state: "NONE"; reason: string }
  | { state: "NOT_DUE"; reason: string }
  | { state: "WAITING"; reason: string; since: Date }
  | { state: "READY"; nextLevel: number; daysOverdue: number }
  | { state: "FINAL"; reason: string };

/**
 * Wo steht die Rechnung im Mahnwesen?
 *  - NONE: Entwurf, storniert, bezahlt.
 *  - NOT_DUE: noch nicht fällig bzw. Karenzzeit bis zur 1. Mahnung läuft.
 *  - WAITING: Mahnung versandt, ihre Zahlungsfrist läuft noch.
 *  - READY: nächste Mahnstufe kann versandt werden.
 *  - FINAL: 3. Mahnung versandt; das weitere Vorgehen entscheidet der Vorstand.
 * Setzt voraus, dass reminderAfterDays und die Mahnfristen gesetzt sind (sonst NOT_DUE mit Hinweis).
 */
export function reminderStateOf(inv: ReminderInvoice, settings: ReminderSettings, today: Date): ReminderState {
  if (inv.status !== "OFFEN") return { state: "NONE", reason: "Nur offene Rechnungen werden gemahnt." };
  if (openAmount(inv.totalRappen, inv.paidRappen) <= 0) return { state: "NONE", reason: "Kein offener Betrag." };
  const overdue = daysBetween(inv.dueDate, today);
  if (inv.reminderLevel <= 0) {
    if (settings.reminderAfterDays === null) return { state: "NOT_DUE", reason: "Die Tage bis zur 1. Mahnung sind in den Einstellungen nicht festgelegt." };
    if (overdue <= 0) return { state: "NOT_DUE", reason: "Noch nicht fällig." };
    if (overdue < settings.reminderAfterDays) return { state: "NOT_DUE", reason: `Fristablauf erst vor ${overdue} ${overdue === 1 ? "Tag" : "Tagen"}; Mahnung ab ${settings.reminderAfterDays} Tagen.` };
    return { state: "READY", nextLevel: 1, daysOverdue: overdue };
  }
  if (inv.reminderLevel >= MAX_REMINDER_LEVEL) {
    return { state: "FINAL", reason: "Die letzte Mahnstufe ist erreicht. Das weitere Vorgehen entscheidet der Vorstand gemäss Statuten." };
  }
  const last = inv.lastReminderDueDate ?? inv.dueDate;
  if (daysBetween(last, today) <= 0) return { state: "WAITING", reason: "Die Zahlungsfrist der letzten Mahnung läuft noch.", since: last };
  return { state: "READY", nextLevel: inv.reminderLevel + 1, daysOverdue: Math.max(overdue, 0) };
}

/** Neue Zahlungsfrist der Mahnstufe ab dem Versanddatum; null, wenn die Frist der Stufe nicht festgelegt ist. */
export function dueDateForLevel(settings: ReminderSettings, level: number, sentOn: Date): Date | null {
  const days = reminderDaysFor(settings as VereinSettings, level);
  return days === null ? null : reminderDueDate(sentOn, days);
}

export const REMINDER_TITLE: Record<number, string> = {
  1: "Zahlungserinnerung",
  2: "2. Mahnung",
  3: "3. Mahnung",
};

export type ReminderTextContext = { level: number; invoiceNumber: string; dueDateText: string; newDueDateText: string; openAmountText: string; feeText: string | null };

/** Neutrale Standardtexte, wenn der Verein in den Einstellungen keinen eigenen Mailtext hinterlegt hat. */
export function defaultReminderParagraphs(c: ReminderTextContext): string[] {
  const first =
    c.level === 1
      ? `Für die Rechnung ${c.invoiceNumber} (fällig am ${c.dueDateText}) konnten wir bis heute keinen Zahlungseingang feststellen. Vielleicht ist die Zahlung untergegangen.`
      : `Für die Rechnung ${c.invoiceNumber} (fällig am ${c.dueDateText}) ist trotz früherer Mahnung weiterhin kein vollständiger Zahlungseingang verbucht.`;
  const second = c.feeText
    ? `Offen sind ${c.openAmountText} (davon ${c.feeText} Mahngebühr). Bitte zahle bis spätestens ${c.newDueDateText}.`
    : `Offen sind ${c.openAmountText}. Bitte zahle bis spätestens ${c.newDueDateText}.`;
  return [first, second, "Hast du die Zahlung inzwischen veranlasst, betrachte diese Mitteilung bitte als gegenstandslos. Bei Fragen melde dich gerne bei uns."];
}

export type InvoiceTextContext = { invoiceNumber: string; subject: string; totalText: string; dueDateText: string };

export function defaultInvoiceParagraphs(c: InvoiceTextContext): string[] {
  return [
    `Für dich liegt die Rechnung ${c.invoiceNumber}${c.subject ? ` («${c.subject}»)` : ""} über ${c.totalText} bereit. Sie ist zahlbar bis ${c.dueDateText}.`,
    "Über den Link siehst du die Rechnung mit dem Zahlteil (QR-Rechnung). Du kannst sie ausdrucken oder im Browser als PDF speichern und mit deiner Banking-App den QR-Code einlesen.",
  ];
}
