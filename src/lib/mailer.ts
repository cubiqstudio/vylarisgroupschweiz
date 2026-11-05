import "server-only";
import nodemailer from "nodemailer";
import { getMailConfig, type MailConfig } from "@/lib/settings";

export type SendResult = { ok: true } | { ok: false; error: string };

export async function isMailConfigured(): Promise<boolean> {
  try {
    return (await getMailConfig()) !== null;
  } catch {
    return false;
  }
}

function transportFor(cfg: MailConfig) {
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.security === "SSL", // SMTPS (meist Port 465)
    requireTLS: cfg.security === "STARTTLS", // STARTTLS erzwingen (meist Port 587)
    ignoreTLS: cfg.security === "NONE",
    auth: cfg.user ? { user: cfg.user, pass: cfg.password } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    tls: { minVersion: "TLSv1.2" },
  });
}

/** Übersetzt technische Fehler in verständliche Hinweise – ohne Zugangsdaten preiszugeben. */
function explain(e: unknown): string {
  const err = e as { code?: string; responseCode?: number; message?: string };
  switch (err.code) {
    case "EAUTH": return "Anmeldung am Mailserver fehlgeschlagen (Benutzername/Passwort prüfen).";
    case "ECONNECTION":
    case "ECONNREFUSED": return "Verbindung zum Mailserver abgelehnt (Host/Port prüfen).";
    case "ETIMEDOUT":
    case "ESOCKET": return "Zeitüberschreitung bzw. Verbindungsfehler (Host, Port und Verschlüsselung prüfen).";
    case "ENOTFOUND":
    case "EDNS": return "Mailserver-Adresse nicht gefunden (Host prüfen).";
    case "EENVELOPE": return "Absender- oder Empfängeradresse wurde abgelehnt.";
    default: return `Versand fehlgeschlagen${err.responseCode ? ` (SMTP ${err.responseCode})` : ""}.`;
  }
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** z. B. List-Unsubscribe / List-Unsubscribe-Post für Newsletter */
  headers?: Record<string, string>;
  replyTo?: string;
  config?: MailConfig;
}): Promise<SendResult> {
  const cfg = opts.config ?? (await getMailConfig());
  if (!cfg) return { ok: false, error: "Es ist kein Mailserver eingerichtet." };
  try {
    await transportFor(cfg).sendMail({
      from: cfg.fromName ? { name: cfg.fromName, address: cfg.fromEmail } : cfg.fromEmail,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
      headers: opts.headers,
      replyTo: opts.replyTo,
    });
    return { ok: true };
  } catch (e) {
    console.error("[mail] Versand fehlgeschlagen:", (e as { code?: string }).code ?? "unbekannt");
    return { ok: false, error: explain(e) };
  }
}
