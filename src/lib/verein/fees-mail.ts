// Mails zu Rechnungen und Mahnungen (Marken-Layout über sendVereinMail). Links nur über die feste Basis-URL (links.ts).
import "server-only";
import type { SendResult } from "@/lib/mailer";
import { formatDateCh } from "./dates";
import { defaultInvoiceParagraphs, defaultReminderParagraphs, REMINDER_TITLE } from "./fees-reminders";
import { publicUrl } from "./links";
import { sendVereinMail } from "./mail";
import { formatChfWithCurrency } from "./money";
import { getVereinSettings } from "./settings";

/** Adresse der Rechnungsansicht ohne Konto. Das Token steht nur in der Mail; in der Datenbank liegt sein Hash. */
export const invoiceViewUrl = (token: string): string => publicUrl(`/rechnung/${encodeURIComponent(token)}`);

type MailTarget = { to: string; firstName: string };
type InvoiceFacts = { number: string; subject: string; totalRappen: number; paidRappen: number; dueDate: Date };

function greeting(firstName: string): string {
  const name = firstName.trim();
  return name ? `Hallo ${name}` : "Guten Tag";
}

/** Rechnung versenden: Hinweis, Eckdaten und Link zur Ansicht mit QR-Zahlteil. */
export async function sendInvoiceMail(target: MailTarget, inv: InvoiceFacts, token: string): Promise<SendResult> {
  const settings = await getVereinSettings();
  const open = Math.max(0, inv.totalRappen - inv.paidRappen);
  const defaults = defaultInvoiceParagraphs({
    invoiceNumber: inv.number,
    subject: inv.subject,
    totalText: formatChfWithCurrency(open),
    dueDateText: formatDateCh(inv.dueDate),
  });
  return sendVereinMail({
    to: target.to,
    subject: `Rechnung ${inv.number}`,
    heading: `Rechnung ${inv.number}`,
    preheader: `Betrag ${formatChfWithCurrency(open)}, zahlbar bis ${formatDateCh(inv.dueDate)}`,
    paragraphs: [greeting(target.firstName) + ",", ...(settings.invoiceMailIntro.trim() ? [settings.invoiceMailIntro.trim()] : []), ...defaults],
    details: [
      ["Rechnung", inv.number],
      ...(inv.subject ? ([["Betreff", inv.subject]] as Array<[string, string]>) : []),
      ["Betrag", formatChfWithCurrency(open)],
      ["Zahlbar bis", formatDateCh(inv.dueDate)],
    ],
    cta: { label: "Rechnung mit Zahlteil ansehen", url: invoiceViewUrl(token) },
    footerNote: "Du erhältst diese Mail, weil du Mitglied des Vereins bist oder eine Rechnung des Vereins erhältst.",
  });
}

/** Mahnung versenden. Die Fristen und Gebühren stammen aus den Einstellungen; der Text macht keine Rechtsaussage. */
export async function sendReminderMail(
  target: MailTarget,
  inv: InvoiceFacts,
  reminder: { level: number; dueDate: Date; feeRappen: number },
  token: string,
): Promise<SendResult> {
  const settings = await getVereinSettings();
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
  return sendVereinMail({
    to: target.to,
    subject: `${title} zur Rechnung ${inv.number}`,
    heading: title,
    preheader: `Rechnung ${inv.number}: offen ${formatChfWithCurrency(open)}, neue Frist ${formatDateCh(reminder.dueDate)}`,
    paragraphs: [greeting(target.firstName) + ",", ...(settings.reminderMailIntro.trim() ? [settings.reminderMailIntro.trim()] : []), ...defaults],
    details: [
      ["Rechnung", inv.number],
      ["Ursprünglich fällig", formatDateCh(inv.dueDate)],
      ["Offener Betrag", formatChfWithCurrency(open)],
      ["Zahlbar bis", formatDateCh(reminder.dueDate)],
    ],
    cta: { label: "Rechnung mit Zahlteil ansehen", url: invoiceViewUrl(token) },
    footerNote: "Du erhältst diese Mail, weil zu einer Rechnung des Vereins an dich noch ein Betrag offen ist.",
  });
}
