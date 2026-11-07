// Inhalt der Rechnungs- und Mahnungsmails (rein, ohne Versand und ohne Datenbank; Tests: scripts/test/fees.test.mts).
// Je nach Konto des Vereins steht in der Mail der QR-Zahlteil (Schweizer Konto) oder der Block «Einzahlungsangaben» (ausländische IBAN):
// Wo es keinen QR-Zahlteil gibt, spricht die Mail weder von «QR-Rechnung» noch von «Zahlteil» oder vom Einlesen eines QR-Codes.
import type { VereinMail } from "./mail";
import type { InvoiceBill, PaymentDetails } from "./fees-bill";
import type { BillMode } from "./fees-calc";
import { formatDateCh } from "./dates";
import { defaultInvoiceParagraphs, defaultReminderParagraphs, REMINDER_TITLE } from "./fees-reminders";
import { formatChfWithCurrency } from "./money";

export type MailTarget = { to: string; firstName: string };
export type InvoiceFacts = { number: string; subject: string; totalRappen: number; paidRappen: number; dueDate: Date };
export type MailContent = Omit<VereinMail, "to">;

function greeting(firstName: string): string {
  const name = firstName.trim();
  return name ? `Hallo ${name}` : "Guten Tag";
}

/** Art der Zahlungsangaben, soweit sie aus der Rechnung hervorgeht (ohne Zusammenstellung: QR-Rechnung). */
export const billModeOfBill = (bill: InvoiceBill | null | undefined): BillMode => bill?.mode ?? "QR_BILL";

/** Beschriftung des Links zur Rechnungsansicht. */
export const viewLinkLabel = (mode: BillMode): string => (mode === "DETAILS" ? "Rechnung mit Einzahlungsangaben ansehen" : "Rechnung mit Zahlteil ansehen");

/** Zeilen «Label: Wert» der Einzahlungsangaben für die Mail (leer bei Schweizer Konto). */
export function paymentDetailRows(bill: InvoiceBill | null | undefined): Array<[string, string]> {
  if (!bill || !bill.ok || bill.mode !== "DETAILS") return [];
  const d: PaymentDetails = bill.details;
  return [
    ["Zahlungsempfänger", d.payeeLines.join(", ")],
    ["IBAN", d.iban],
    ...(d.bic ? ([["BIC/SWIFT", d.bic]] as Array<[string, string]>) : []),
    ...(d.bank ? ([["Bank", d.bank]] as Array<[string, string]>) : []),
    ["Zahlungsreferenz", d.reference],
    ["Währung", d.currency],
  ];
}

/** Hinweis zum Konto im Ausland (nur bei Einzahlungsangaben). */
export function foreignAccountNote(bill: InvoiceBill | null | undefined): string | null {
  if (!bill || !bill.ok || bill.mode !== "DETAILS") return null;
  return `Das Konto des Vereins wird im Ausland geführt (IBAN-Länderkürzel ${bill.details.ibanCountry}). Der Betrag lautet auf Schweizer Franken (CHF).`;
}

/** Rechnung versenden: Hinweis, Eckdaten, Einzahlungsangaben (bei ausländischer IBAN) und Link zur Ansicht. */
export function invoiceMailContent(target: MailTarget, inv: InvoiceFacts, viewUrl: string, intro: string, bill: InvoiceBill | null | undefined): MailContent {
  const mode = billModeOfBill(bill);
  const open = Math.max(0, inv.totalRappen - inv.paidRappen);
  const defaults = defaultInvoiceParagraphs({ invoiceNumber: inv.number, subject: inv.subject, totalText: formatChfWithCurrency(open), dueDateText: formatDateCh(inv.dueDate), mode });
  const note = foreignAccountNote(bill);
  return {
    subject: `Rechnung ${inv.number}`,
    heading: `Rechnung ${inv.number}`,
    preheader: `Betrag ${formatChfWithCurrency(open)}, zahlbar bis ${formatDateCh(inv.dueDate)}`,
    paragraphs: [greeting(target.firstName) + ",", ...(intro.trim() ? [intro.trim()] : []), ...defaults, ...(note ? [note] : [])],
    details: [
      ["Rechnung", inv.number],
      ...(inv.subject ? ([["Betreff", inv.subject]] as Array<[string, string]>) : []),
      ["Betrag", formatChfWithCurrency(open)],
      ["Zahlbar bis", formatDateCh(inv.dueDate)],
      ...paymentDetailRows(bill),
    ],
    cta: { label: viewLinkLabel(mode), url: viewUrl },
    footerNote: "Du erhältst diese Mail, weil du Mitglied des Vereins bist oder eine Rechnung des Vereins erhältst.",
  };
}

/** Mahnung: Fristen und Gebühren stammen aus den Einstellungen; der Text macht keine Rechtsaussage. */
export function reminderMailContent(
  target: MailTarget,
  inv: InvoiceFacts,
  reminder: { level: number; dueDate: Date; feeRappen: number },
  viewUrl: string,
  intro: string,
  bill: InvoiceBill | null | undefined,
): MailContent {
  const mode = billModeOfBill(bill);
  const open = Math.max(0, inv.totalRappen - inv.paidRappen);
  const title = REMINDER_TITLE[reminder.level] ?? "Mahnung";
  const defaults = defaultReminderParagraphs({
    level: reminder.level,
    invoiceNumber: inv.number,
    dueDateText: formatDateCh(inv.dueDate),
    newDueDateText: formatDateCh(reminder.dueDate),
    openAmountText: formatChfWithCurrency(open),
    feeText: reminder.feeRappen > 0 ? formatChfWithCurrency(reminder.feeRappen) : null,
  });
  const note = foreignAccountNote(bill);
  return {
    subject: `${title} zur Rechnung ${inv.number}`,
    heading: title,
    preheader: `Rechnung ${inv.number}: offen ${formatChfWithCurrency(open)}, neue Frist ${formatDateCh(reminder.dueDate)}`,
    paragraphs: [greeting(target.firstName) + ",", ...(intro.trim() ? [intro.trim()] : []), ...defaults, ...(note ? [note] : [])],
    details: [
      ["Rechnung", inv.number],
      ["Ursprünglich fällig", formatDateCh(inv.dueDate)],
      ["Offener Betrag", formatChfWithCurrency(open)],
      ["Zahlbar bis", formatDateCh(reminder.dueDate)],
      ...paymentDetailRows(bill),
    ],
    cta: { label: viewLinkLabel(mode), url: viewUrl },
    footerNote: "Du erhältst diese Mail, weil zu einer Rechnung des Vereins an dich noch ein Betrag offen ist.",
  };
}
