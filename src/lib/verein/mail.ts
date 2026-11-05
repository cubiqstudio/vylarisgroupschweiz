// Gemeinsamer Versand von Vereinsmails (Rechnung, Mahnung, Einladung, Bestätigungen) im Marken-Layout der Website.
// Links müssen mit den Helfern aus ./links.ts gebaut werden (feste Basis-URL, nie aus dem Host-Header). Nutzertexte werden escaped.
import "server-only";
import { mailCtx } from "@/lib/mail-ctx";
import { mailDetails, normalizeText, oneLine, paragraphsToHtml, renderMailLayout, textFooter, truncate } from "@/lib/mail-layout";
import { sendMail, type SendResult } from "@/lib/mailer";
import { getVereinSettings } from "./settings";

export type VereinMail = {
  to: string;
  subject: string;
  heading: string;
  preheader?: string;
  /** Absätze in Klartext (Leerzeilen im Text trennen weitere Absätze); werden escaped */
  paragraphs: string[];
  /** Zeilen «Label: Wert» */
  details?: Array<[label: string, value: string]>;
  cta?: { label: string; url: string };
  /** Hinweis in der Fusszeile («Warum erhältst du diese Mail?») */
  footerNote?: string;
  /** Signatur aus den Vereinseinstellungen anhängen (Standard: ja) */
  signature?: boolean;
};

/** Baut Text und HTML der Mail ohne zu senden (für Vorschau und Tests). */
export async function buildVereinMail(mail: VereinMail): Promise<{ subject: string; text: string; html: string; replyTo?: string }> {
  const settings = await getVereinSettings();
  const ctx = mailCtx();
  const subject = truncate(oneLine(mail.subject), 140);
  const signature = mail.signature === false ? "" : normalizeText([settings.senderName, settings.senderSignature].filter(Boolean).join("\n"));
  const body = mail.paragraphs.map((p) => normalizeText(p)).filter(Boolean);
  const html = renderMailLayout({
    ctx,
    preheader: mail.preheader,
    heading: mail.heading,
    bodyHtml:
      body.map((p) => paragraphsToHtml(p)).join("\n") +
      (mail.details?.length ? mailDetails(mail.details) : "") +
      (signature ? paragraphsToHtml(signature, { muted: true, small: true }) : ""),
    cta: mail.cta,
    footerNote: mail.footerNote,
  });
  const text = [
    ...body.flatMap((p) => [p, ""]),
    ...(mail.details ?? []).filter(([, v]) => v.trim() !== "").map(([l, v]) => `${oneLine(l)}: ${oneLine(v)}`),
    ...(mail.details?.length ? [""] : []),
    ...(mail.cta ? [`${mail.cta.label}:`, mail.cta.url, ""] : []),
    ...(signature ? [signature, ""] : []),
    textFooter({ brand: ctx.site.name, note: mail.footerNote }, ctx),
  ].join("\n");
  return { subject, text, html, replyTo: settings.replyToEmail || undefined };
}

/** Baut und versendet eine Vereinsmail. Ergebnis wie sendMail: {ok:true} oder {ok:false, error}. */
export async function sendVereinMail(mail: VereinMail): Promise<SendResult> {
  const built = await buildVereinMail(mail);
  return sendMail({ to: mail.to, subject: built.subject, text: built.text, html: built.html, replyTo: built.replyTo });
}
