import "server-only";
import { siteLink } from "@/lib/account";
import { getLegal } from "@/lib/legal";
import { isMailConfigured, sendMail, type SendResult } from "@/lib/mailer";
import {
  ticketConfirmationMail,
  ticketNotifyMail,
  ticketReplyMail,
  ticketStatusMail,
  type MailContent,
  type TicketMailData,
} from "@/lib/mail-templates";
import { oneLine } from "@/lib/mail-layout";
import { adminMailCtx, getRequestMailCtx, mailCtxFor, type MailCtx } from "@/lib/mail-ctx";
import { getMailConfig, getTicketMailSettings } from "@/lib/settings";

// E-Mails rund um Tickets. Alle Funktionen schlagen nie mit einer Exception fehl, sondern liefern ein SendResult;
// ohne Mailserver (oder bei deaktivierter Einstellung) wird nichts gesendet und { ok: false, error } zurückgegeben.
// Inhalte (Nachrichtentexte, Adressen) werden nicht protokolliert.
export type TicketForMail = {
  id: string;
  ticketNumber: string;
  name: string;
  email: string;
  subject: string;
  category: string;
  message: string;
  status: string;
  /** Domain und Sprache der Anfrage (Spalten der Tabelle); fehlen sie, gilt die laufende Anfrage */
  siteKey?: string | null;
  locale?: string | null;
};

const NO_MAIL: SendResult = { ok: false, error: "Es ist kein Mailserver eingerichtet." };
const FAILED: SendResult = { ok: false, error: "Die E-Mail konnte nicht erstellt oder versendet werden." };
const EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/;

const data = (t: TicketForMail): TicketMailData => ({
  ticketNumber: t.ticketNumber,
  name: oneLine(t.name),
  email: oneLine(t.email),
  subject: oneLine(t.subject),
  category: t.category,
  message: t.message,
  status: t.status,
});

/** Sprache, Marke und Domain der Seite, über die das Ticket eingegangen ist. */
const ctxOf = (t: TicketForMail): Promise<MailCtx> | MailCtx => (t.siteKey ? mailCtxFor(t.siteKey, t.locale) : getRequestMailCtx());

/** Kontakt-Adresse der Seite (Reply-To): eigene Adresse der Seite, sonst aus den Impressum-Angaben; nur wenn plausibel und einzeilig. */
async function contactAddress(ctx: MailCtx): Promise<string | undefined> {
  try {
    const email = (ctx.site.contactEmail ?? (await getLegal()).email)?.trim();
    return email && EMAIL_RE.test(email) ? email : undefined;
  } catch {
    return undefined;
  }
}

/** Alle Empfänger-Adressen müssen einzeilig und plausibel sein (Header-Injection ausschließen). */
const validAddress = (a: string) => EMAIL_RE.test(a) && !/[\r\n]/.test(a);

async function deliver(to: string, ctx: MailCtx, build: (canReply: boolean) => MailContent, opts: { reply?: boolean } = {}): Promise<SendResult> {
  try {
    if (!validAddress(to)) return { ok: false, error: "Ungültige Empfänger-Adresse." };
    const config = await getMailConfig();
    if (!config) return NO_MAIL;
    const replyTo = opts.reply ? await contactAddress(ctx) : undefined;
    const mail = build(Boolean(replyTo));
    return await sendMail({ to, subject: oneLine(mail.subject), text: mail.text, html: mail.html, replyTo, config });
  } catch {
    return FAILED;
  }
}

/** Eingangsbestätigung an den Absender (nur wenn tickets.confirmationEnabled). */
export async function sendTicketConfirmation(ticket: TicketForMail): Promise<SendResult> {
  try {
    if (!(await isMailConfigured())) return NO_MAIL;
    const settings = await getTicketMailSettings();
    if (!settings.confirmationEnabled) return { ok: false, error: "Die Eingangsbestätigung ist deaktiviert." };
    const ctx = await ctxOf(ticket);
    return await deliver(ticket.email, ctx, (canReply) => ticketConfirmationMail({ ...data(ticket), canReply }, ctx), { reply: true });
  } catch {
    return FAILED;
  }
}

/** Hinweis an die in den Einstellungen hinterlegte Adresse bei neuem Ticket (nur wenn notifyEmail gesetzt). */
export async function notifyNewTicket(ticket: TicketForMail): Promise<SendResult> {
  try {
    if (!(await isMailConfigured())) return NO_MAIL;
    const { notifyEmail } = await getTicketMailSettings();
    if (!notifyEmail) return { ok: false, error: "Es ist keine Adresse für Ticket-Hinweise hinterlegt." };
    // Team-Hinweise sind immer deutsch und verlinken auf vylaris.eu (dort liegt der Admin-Bereich).
    const ctx = adminMailCtx();
    const adminUrl = siteLink(`/admin/tickets/${encodeURIComponent(ticket.id)}`, undefined, ctx.baseUrl);
    const origin = (await ctxOf(ticket)).site.domain;
    return await deliver(notifyEmail, ctx, () => ticketNotifyMail({ ...data(ticket), adminUrl, origin }, ctx));
  } catch {
    return FAILED;
  }
}

/** Statusänderung an den Absender melden. */
export async function sendTicketStatusMail(ticket: TicketForMail): Promise<SendResult> {
  try {
    const ctx = await ctxOf(ticket);
    return await deliver(ticket.email, ctx, (canReply) => ticketStatusMail({ ...data(ticket), canReply }, ctx), { reply: true });
  } catch {
    return FAILED;
  }
}

/** Antwort aus dem Dashboard an den Absender (Reply-To: Kontakt-Adresse, falls vorhanden). */
export async function sendTicketReply(ticket: TicketForMail, message: string, author: string): Promise<SendResult> {
  try {
    const ctx = await ctxOf(ticket);
    return await deliver(ticket.email, ctx, (canReply) => ticketReplyMail({ ...data(ticket), reply: message, author, canReply }, ctx), { reply: true });
  } catch {
    return FAILED;
  }
}
