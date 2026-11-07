// Mails zu Rechnungen und Mahnungen (Marken-Layout über sendVereinMail). Links nur über die feste Basis-URL (links.ts).
// Der Inhalt (QR-Zahlteil oder Einzahlungsangaben) entsteht in ./fees-mail-text.ts.
import "server-only";
import type { SendResult } from "@/lib/mailer";
import type { InvoiceBill } from "./fees-bill";
import { invoiceMailContent, reminderMailContent, type InvoiceFacts, type MailTarget } from "./fees-mail-text";
import { publicUrl } from "./links";
import { sendVereinMail } from "./mail";
import { getVereinSettings } from "./settings";

/** Adresse der Rechnungsansicht ohne Konto. Das Token steht nur in der Mail; in der Datenbank liegt sein Hash. */
export const invoiceViewUrl = (token: string): string => publicUrl(`/rechnung/${encodeURIComponent(token)}`);

/** Rechnung versenden: Hinweis, Eckdaten und Link zur Ansicht (mit QR-Zahlteil oder Einzahlungsangaben, je nach Konto). */
export async function sendInvoiceMail(target: MailTarget, inv: InvoiceFacts, token: string, bill: InvoiceBill | null): Promise<SendResult> {
  const settings = await getVereinSettings();
  return sendVereinMail({ to: target.to, ...invoiceMailContent(target, inv, invoiceViewUrl(token), settings.invoiceMailIntro, bill) });
}

/** Mahnung versenden. Die Fristen und Gebühren stammen aus den Einstellungen; der Text macht keine Rechtsaussage. */
export async function sendReminderMail(
  target: MailTarget,
  inv: InvoiceFacts,
  reminder: { level: number; dueDate: Date; feeRappen: number },
  token: string,
  bill: InvoiceBill | null,
): Promise<SendResult> {
  const settings = await getVereinSettings();
  return sendVereinMail({ to: target.to, ...reminderMailContent(target, inv, reminder, invoiceViewUrl(token), settings.reminderMailIntro, bill) });
}
