// Mails zu Anlässen: Bitte um Bestätigung der E-Mail-Adresse, Bestätigung, Warteliste, Nachrücken, Absage durch den Vorstand, Absage des Anlasses, Erinnerung.
// Versand über sendVereinMail im Marken-Layout. Links entstehen ausschliesslich aus der festen Basis-URL (links.ts).
// Abmelde-Links (mit Token) stehen nur in der Bestätigungsmail; die übrigen Mails verweisen darauf bzw. auf das Mitgliederportal.
import "server-only";
import type { SendResult } from "@/lib/mailer";
import { CONFIRM_TTL_HOURS, formatEventWhen } from "./events-lib";
import { eventCancelUrl, eventConfirmUrl, eventUrl, memberPortalUrl, publicUrl } from "./links";
import { sendVereinMail } from "./mail";

export type MailEvent = { id: string; title: string; location: string; startsAt: Date; endsAt: Date | null; isPublic: boolean };

export type Recipient = {
  to: string;
  name: string;
  /** Mitglied (Portal-Link statt Token-Link) oder Gast */
  isMember: boolean;
};

const hello = (name: string) => `Guten Tag ${name.trim() || ""}`.trim();

function details(event: MailEvent, seats?: number): Array<[string, string]> {
  const rows: Array<[string, string]> = [["Anlass", event.title], ["Datum und Zeit", formatEventWhen(event.startsAt, event.endsAt)]];
  if (event.location.trim()) rows.push(["Ort", event.location.trim()]);
  if (seats !== undefined) rows.push(["Personen", String(seats)]);
  return rows;
}

/** Adresse des Kalendereintrags; nur öffentliche Anlässe haben einen offenen Link (sonst gibt es ihn im Portal). */
export const eventIcsUrl = (event: Pick<MailEvent, "id" | "isPublic">): string | null => (event.isPublic ? publicUrl(`/anlaesse/${encodeURIComponent(event.id)}/termin.ics`) : null);

/** Öffentliche Seite des Anlasses; Anlässe nur für Mitglieder gibt es nur im Mitgliederportal. */
const eventLink = (event: Pick<MailEvent, "id" | "isPublic">): string => (event.isPublic ? eventUrl(event.id) : memberPortalUrl("anlaesse"));

const guestFooter = "Du erhältst diese Mail, weil diese Adresse für den Anlass angemeldet wurde. Warst du das nicht, melde die Anmeldung über den Link ab.";
const memberFooter = "Du erhältst diese Mitteilung als Mitglied des Vereins.";

const confirmFooter = `Du erhältst diese Mail, weil diese Adresse für einen Anlass angemeldet wurde. Warst du das nicht, musst du nichts tun: Ohne Bestätigung wird die Anmeldung nach ${CONFIRM_TTL_HOURS} Stunden gelöscht.`;

/**
 * Gäste: Bitte um Bestätigung der E-Mail-Adresse (Double-Opt-In). Erst der Klick auf den Link macht die Anmeldung gültig;
 * bis dahin ist kein Platz reserviert. Der Link führt auf eine Seite mit Schaltfläche (der Aufruf allein bestätigt nichts).
 */
export function sendConfirmRequestMail(opts: { recipient: Recipient; event: MailEvent; seats: number; token: string }): Promise<SendResult> {
  const { recipient, event, seats, token } = opts;
  return sendVereinMail({
    to: recipient.to,
    subject: `Bitte bestätige deine Anmeldung: ${event.title}`,
    heading: "Bitte bestätige deine E-Mail-Adresse",
    preheader: formatEventWhen(event.startsAt, event.endsAt),
    paragraphs: [
      hello(recipient.name),
      `Du hast dich für den Anlass «${event.title}» angemeldet. Damit die Anmeldung gilt, bestätige bitte deine E-Mail-Adresse über die Schaltfläche unten.`,
      `Erst nach der Bestätigung bekommst du einen Platz oder, wenn der Anlass ausgebucht ist, einen Platz auf der Warteliste. Der Link gilt ${CONFIRM_TTL_HOURS} Stunden. Danach löschen wir die unbestätigte Anmeldung samt deinen Angaben.`,
    ],
    details: details(event, seats),
    cta: { label: "Anmeldung bestätigen", url: eventConfirmUrl(token) },
    footerNote: confirmFooter,
  });
}

/** Bestätigung einer Anmeldung bzw. Hinweis, dass die Person auf der Warteliste steht. `token` nur bei neuen oder erneuerten Abmelde-Links. */
export function sendRegistrationMail(opts: { recipient: Recipient; event: MailEvent; status: "ANGEMELDET" | "WARTELISTE"; seats: number; token?: string }): Promise<SendResult> {
  const { recipient, event, status, seats, token } = opts;
  const waiting = status === "WARTELISTE";
  const paragraphs = [
    hello(recipient.name),
    waiting
      ? `Der Anlass «${event.title}» ist zurzeit ausgebucht. Du stehst auf der Warteliste. Sobald ein Platz frei wird, rückst du automatisch nach und wir informieren dich per Mail.`
      : `Vielen Dank, deine Anmeldung für den Anlass «${event.title}» ist eingegangen.`,
  ];
  const ics = eventIcsUrl(event);
  if (!waiting && ics) paragraphs.push(`Zum Kalender hinzufügen: ${ics}`);
  if (recipient.isMember) paragraphs.push(`Du kannst dich jederzeit im Mitgliederportal wieder abmelden: ${memberPortalUrl("anlaesse")}`);
  else if (token) paragraphs.push("Wenn du nicht teilnehmen kannst, melde dich bitte über die Schaltfläche unten ab, damit andere nachrücken können.");

  return sendVereinMail({
    to: recipient.to,
    subject: waiting ? `Warteliste: ${event.title}` : `Anmeldung bestätigt: ${event.title}`,
    heading: waiting ? "Du stehst auf der Warteliste" : "Anmeldung bestätigt",
    preheader: formatEventWhen(event.startsAt, event.endsAt),
    paragraphs,
    details: details(event, seats),
    cta: token && !recipient.isMember ? { label: "Abmelden", url: eventCancelUrl(event.id, token) } : { label: "Anlass ansehen", url: eventLink(event) },
    footerNote: recipient.isMember ? memberFooter : guestFooter,
  });
}

/** Nachgerückt von der Warteliste. */
export function sendPromotionMail(opts: { recipient: Recipient; event: MailEvent; seats: number }): Promise<SendResult> {
  const { recipient, event, seats } = opts;
  return sendVereinMail({
    to: recipient.to,
    subject: `Platz frei geworden: ${event.title}`,
    heading: "Du bist nachgerückt",
    preheader: formatEventWhen(event.startsAt, event.endsAt),
    paragraphs: [
      hello(recipient.name),
      `Gute Nachricht: Für den Anlass «${event.title}» ist ein Platz frei geworden. Du bist von der Warteliste nachgerückt und jetzt angemeldet.`,
      recipient.isMember
        ? `Falls du doch nicht teilnehmen kannst, melde dich bitte im Mitgliederportal ab: ${memberPortalUrl("anlaesse")}`
        : "Falls du doch nicht teilnehmen kannst, melde dich bitte über den Abmelde-Link in deiner Bestätigungsmail ab, damit andere nachrücken können.",
    ],
    details: details(event, seats),
    cta: { label: "Anlass ansehen", url: eventLink(event) },
    footerNote: recipient.isMember ? memberFooter : guestFooter,
  });
}

/** Der Vorstand hat eine Anmeldung abgesagt. */
export function sendRegistrationRemovedMail(opts: { recipient: Recipient; event: MailEvent }): Promise<SendResult> {
  const { recipient, event } = opts;
  return sendVereinMail({
    to: recipient.to,
    subject: `Anmeldung abgemeldet: ${event.title}`,
    heading: "Anmeldung beendet",
    paragraphs: [hello(recipient.name), `Deine Anmeldung für den Anlass «${event.title}» wurde vom Vorstand beendet. Bei Fragen melde dich bitte beim Verein.`],
    details: details(event),
    cta: { label: "Anlass ansehen", url: eventLink(event) },
    footerNote: recipient.isMember ? memberFooter : guestFooter,
  });
}

/** Der ganze Anlass fällt aus. */
export function sendEventCancelledMail(opts: { recipient: Recipient; event: MailEvent; reason: string }): Promise<SendResult> {
  const { recipient, event, reason } = opts;
  const paragraphs = [hello(recipient.name), `Der Anlass «${event.title}» findet leider nicht statt.`];
  if (reason.trim()) paragraphs.push(`Grund: ${reason.trim()}`);
  paragraphs.push("Über einen neuen Termin informieren wir dich separat.");
  return sendVereinMail({
    to: recipient.to,
    subject: `Abgesagt: ${event.title}`,
    heading: "Anlass abgesagt",
    paragraphs,
    details: details(event),
    cta: { label: "Anlass ansehen", url: eventLink(event) },
    footerNote: recipient.isMember ? memberFooter : guestFooter,
  });
}

/** Erinnerung am Tag vor dem Anlass. */
export function sendReminderMail(opts: { recipient: Recipient; event: MailEvent; seats: number }): Promise<SendResult> {
  const { recipient, event, seats } = opts;
  return sendVereinMail({
    to: recipient.to,
    subject: `Erinnerung: ${event.title}`,
    heading: "Erinnerung an den Anlass",
    preheader: formatEventWhen(event.startsAt, event.endsAt),
    paragraphs: [
      hello(recipient.name),
      `Wir erinnern dich an den Anlass «${event.title}», für den du angemeldet bist.`,
      recipient.isMember
        ? `Kannst du nicht teilnehmen, melde dich bitte im Mitgliederportal ab: ${memberPortalUrl("anlaesse")}`
        : "Kannst du nicht teilnehmen, melde dich bitte über den Abmelde-Link in deiner Bestätigungsmail ab.",
    ],
    details: details(event, seats),
    cta: { label: "Anlass ansehen", url: eventLink(event) },
    footerNote: recipient.isMember ? memberFooter : guestFooter,
  });
}

/** Zeit oder Ort eines Anlasses haben sich geändert. */
export function sendEventChangedMail(opts: { recipient: Recipient; event: MailEvent; seats: number }): Promise<SendResult> {
  const { recipient, event, seats } = opts;
  return sendVereinMail({
    to: recipient.to,
    subject: `Geändert: ${event.title}`,
    heading: "Der Anlass wurde geändert",
    preheader: formatEventWhen(event.startsAt, event.endsAt),
    paragraphs: [
      hello(recipient.name),
      `Bei dem Anlass «${event.title}», für den du angemeldet bist, haben sich Angaben geändert. Hier die aktuellen Details:`,
      recipient.isMember
        ? `Kannst du nicht mehr teilnehmen, melde dich bitte im Mitgliederportal ab: ${memberPortalUrl("anlaesse")}`
        : "Kannst du nicht mehr teilnehmen, melde dich bitte über den Abmelde-Link in deiner Bestätigungsmail ab.",
    ],
    details: details(event, seats),
    cta: { label: "Anlass ansehen", url: eventLink(event) },
    footerNote: recipient.isMember ? memberFooter : guestFooter,
  });
}
