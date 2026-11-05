// Mails zu Versammlungen: Einladung, Erinnerung, Absage. Versand über sendVereinMail im Marken-Layout.
// Links entstehen ausschliesslich aus der festen Basis-URL (links.ts). Der Antwort-Link ist persönlich (meetings-token.ts).
import "server-only";
import type { SendResult } from "@/lib/mailer";
import { publicUrl } from "./links";
import { sendVereinMail } from "./mail";
import { formatMeetingWhen, kindLabel, type MailKind } from "./meetings-lib";
import type { VereinSettings } from "./settings-schema";

export type MeetingMailMeeting = {
  kind: string;
  title: string;
  startsAt: Date;
  endsAt: Date | null;
  location: string;
  invitationText: string;
};

/** Persönlicher Link zur Rückmeldung (Seite ohne Anmeldung). */
export const rsvpPageUrl = (token: string): string => publicUrl("/versammlung/rueckmeldung", { t: token });
/** Persönlicher Link zum Kalendereintrag. */
export const rsvpIcsUrl = (token: string): string => publicUrl("/api/meetings/ics", { t: token });

export function sendMeetingMail(opts: {
  mailKind: MailKind;
  meeting: MeetingMailMeeting;
  agendaTitles: readonly string[];
  to: string;
  recipientName: string;
  settings: Pick<VereinSettings, "invitationMailIntro">;
  /** Persönlicher Antwort-Link; fehlt er (Absage), gibt es keine Schaltfläche */
  rsvpUrl?: string;
  /** Grund einer Absage (optional) */
  reason?: string;
}): Promise<SendResult> {
  const { meeting, mailKind } = opts;
  const label = kindLabel(meeting.kind);
  const board = meeting.kind === "VORSTANDSSITZUNG";
  const greeting = `Guten Tag ${opts.recipientName}`;
  const paragraphs: string[] = [greeting];

  if (mailKind === "EINLADUNG") {
    paragraphs.push(opts.settings.invitationMailIntro.trim() || (board ? `Du bist zur Vorstandssitzung eingeladen.` : `Der Vorstand lädt dich zur Versammlung des Vereins ein (${label}).`));
    if (meeting.invitationText.trim()) paragraphs.push(meeting.invitationText.trim());
    if (opts.agendaTitles.length > 0) paragraphs.push(["Traktanden:", ...opts.agendaTitles.map((t, i) => `${i + 1}. ${t}`)].join("\n"));
    paragraphs.push("Bitte melde dich kurz zurück, ob du teilnimmst oder dich entschuldigst.");
  } else if (mailKind === "ERINNERUNG") {
    paragraphs.push(`Wir erinnern dich an die folgende Sitzung (${label}). Du hast uns noch nicht zurückgemeldet, ob du teilnimmst.`);
    if (opts.agendaTitles.length > 0) paragraphs.push(["Traktanden:", ...opts.agendaTitles.map((t, i) => `${i + 1}. ${t}`)].join("\n"));
  } else {
    paragraphs.push(`Die folgende Sitzung (${label}) findet leider nicht statt.`);
    if (opts.reason?.trim()) paragraphs.push(`Grund: ${opts.reason.trim()}`);
    paragraphs.push("Über einen neuen Termin informieren wir dich separat.");
  }

  const subject = mailKind === "EINLADUNG" ? `Einladung: ${meeting.title}` : mailKind === "ERINNERUNG" ? `Erinnerung: ${meeting.title}` : `Absage: ${meeting.title}`;
  const details: Array<[string, string]> = [["Datum und Zeit", formatMeetingWhen(meeting.startsAt, meeting.endsAt)]];
  if (meeting.location.trim()) details.push(["Ort", meeting.location.trim()]);

  return sendVereinMail({
    to: opts.to,
    subject,
    heading: mailKind === "ABSAGE" ? "Sitzung abgesagt" : meeting.title,
    preheader: formatMeetingWhen(meeting.startsAt, meeting.endsAt),
    paragraphs,
    details,
    cta: opts.rsvpUrl && mailKind !== "ABSAGE" ? { label: "Teilnahme melden oder entschuldigen", url: opts.rsvpUrl } : undefined,
    footerNote: "Du erhältst diese Mitteilung als Mitglied des Vereins.",
  });
}
