// Gemeinsame Helfer für das öffentliche Konto-System (Registrierung, Bestätigung, Reset, Konto-API).
import "server-only";
import bcrypt from "bcryptjs";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { ApiError, assertSameOrigin, fail } from "@/lib/api";
import { isMailConfigured, sendMail, type SendResult } from "@/lib/mailer";
import { mailCtx, type MailCtx } from "@/lib/mail-ctx";
import { accountExistsMail, resetPasswordMail, verifyEmailMail } from "@/lib/mail-templates";
import { getMailConfig, getRegistrationEnabled } from "@/lib/settings";
import { site } from "@/lib/site";
import { createToken } from "@/lib/tokens";

export const BCRYPT_COST = 12;

export const hashPassword = (password: string) => bcrypt.hash(password, BCRYPT_COST);

/** Öffentlicher Link auf der Seite (`baseUrl`, z. B. ctx.baseUrl); ohne Angabe die konfigurierte Basis-URL (SITE_URL). */
export function siteLink(path: string, params?: Record<string, string>, baseUrl: string = site.url): string {
  const base = baseUrl.replace(/\/+$/, "");
  const qs = params ? `?${new URLSearchParams(params).toString()}` : "";
  return `${base}${path}${qs}`;
}

/** Registrierung ist nur möglich, wenn sie im Admin aktiviert ist UND ein Mailserver eingerichtet wurde. */
export async function isRegistrationAvailable(): Promise<boolean> {
  try {
    return (await getRegistrationEnabled()) && (await isMailConfigured());
  } catch {
    return false;
  }
}

/**
 * Nur sichere interne Zielpfade nach dem Login zulassen (kein Open Redirect).
 * Gibt den Pfad (inkl. Query/Hash) zurück oder null. Pfade unter /admin sind nur mit `allowAdmin` erlaubt.
 */
export function safeNextPath(next: string | null | undefined, opts: { allowAdmin?: boolean } = {}): string | null {
  if (typeof next !== "string") return null;
  const value = next.trim();
  if (value.length === 0 || value.length > 500) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  // Backslashes und Steuerzeichen werden von Browsern zu "/" bzw. entfernt ("/\evil.com", "/\t/evil.com").
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return null;

  let url: URL;
  try {
    url = new URL(value, "http://internal.invalid");
  } catch {
    return null;
  }
  if (url.origin !== "http://internal.invalid") return null;

  let path: string;
  try {
    path = decodeURIComponent(url.pathname).toLowerCase();
  } catch {
    return null;
  }
  if (path === "/api" || path.startsWith("/api/")) return null;
  if (!opts.allowAdmin && (path === "/admin" || path.startsWith("/admin/"))) return null;
  return value;
}

/** Führt eine Aufgabe aus, ohne die HTTP-Antwort zu blockieren (Fehler werden nur protokolliert, nie Inhalte). */
export function runInBackground(task: () => Promise<unknown>): void {
  void task().catch((e: unknown) => {
    console.error("[account] Hintergrundaufgabe fehlgeschlagen:", e instanceof Error ? e.name : "unbekannt");
  });
}

const NO_MAIL: SendResult = { ok: false, error: "Es ist kein Mailserver eingerichtet." };

/** Gespeicherte Sprache eines Kontos (Registrierung), soweit die Zeile sie enthält. */
type Origin = { locale?: string | null };

/** Kontext aus der gespeicherten Sprache der Zeile; ein ausdrücklich übergebener Kontext hat Vorrang. */
const ctxFor = (origin: Origin, ctx?: MailCtx): MailCtx => ctx ?? mailCtx(origin.locale);

/** Erzeugt ein neues Bestätigungs-Token (entwertet ältere) und verschickt die Bestätigungsmail in der Sprache des Kontos. */
export async function sendVerificationMail(user: { id: string; email: string; name: string } & Origin, ctx?: MailCtx): Promise<SendResult> {
  const config = await getMailConfig();
  if (!config) return NO_MAIL;
  const mc = ctxFor(user, ctx);
  const token = await createToken(user.id, "EMAIL_VERIFY");
  const mail = verifyEmailMail({ name: user.name, link: siteLink("/verify-email", { token }, mc.baseUrl) }, mc);
  return sendMail({ to: user.email, ...mail, config });
}

/** Erzeugt ein Reset-Token (1 h gültig) und verschickt die Mail mit dem Link zum Zurücksetzen. */
export async function sendResetMail(user: { id: string; email: string; name: string } & Origin, ctx?: MailCtx): Promise<SendResult> {
  const config = await getMailConfig();
  if (!config) return NO_MAIL;
  const mc = ctxFor(user, ctx);
  const token = await createToken(user.id, "PASSWORD_RESET");
  const mail = resetPasswordMail({ name: user.name, link: siteLink("/reset-password", { token }, mc.baseUrl) }, mc);
  return sendMail({ to: user.email, ...mail, config });
}

/** Info-Mail an ein bestehendes Konto, wenn jemand sich erneut mit dieser Adresse registrieren will. */
export async function sendAccountExistsMail(user: { email: string; name?: string | null } & Origin, ctx?: MailCtx): Promise<SendResult> {
  const config = await getMailConfig();
  if (!config) return NO_MAIL;
  const mc = ctxFor(user, ctx);
  const mail = accountExistsMail(
    { name: user.name, loginUrl: siteLink("/login", undefined, mc.baseUrl), forgotUrl: siteLink("/forgot-password", undefined, mc.baseUrl) },
    mc,
  );
  return sendMail({ to: user.email, ...mail, config });
}

/** Pflicht für alle /api/account/*-Handler (Defense in Depth zusätzlich zur Middleware). */
export async function requireUser(req: Request): Promise<CurrentUser> {
  assertSameOrigin(req);
  const user = await getCurrentUser();
  if (!user) throw new ApiError(401, "UNAUTHORIZED", "Nicht angemeldet.");
  return user;
}

/** Einheitliche 429-Antwort für Rate-Limits. */
export function tooManyRequests(retryAfter: number, message = "Zu viele Anfragen. Bitte versuche es später erneut.") {
  return fail(429, "RATE_LIMITED", message, undefined, { "Retry-After": String(retryAfter), "Cache-Control": "no-store" });
}
