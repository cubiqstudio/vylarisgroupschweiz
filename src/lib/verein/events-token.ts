// Abmelde-Token der Anlässe. Das Token steht im Klartext nur in der Bestätigungsmail; gespeichert wird ausschliesslich der
// SHA-256-Hash (EventRegistration.cancelTokenHash). Es erlaubt nichts anderes, als genau diese Anmeldung zu beenden.
//
// Daneben das Bestätigungs-Token für Gäste: eine Signatur (HMAC-SHA256) über Anmeldung und Ablaufzeit. Es wird nicht gespeichert,
// enthält keine Personendaten, gilt nur für diese Anmeldung und läuft ab (48 Stunden nach Eingang). Das Geheimnis wird übergeben,
// damit die Funktionen rein und testbar bleiben.
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** Form eines gültigen Tokens: 32 Zufallsbytes als base64url (43 Zeichen). */
export const CANCEL_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function hashCancelToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Neues Token samt Hash. */
export function generateCancelToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashCancelToken(token) };
}

/** Sieht der Wert wie ein Token aus? (Vor jedem Datenbankzugriff prüfen.) */
export function isPlausibleCancelToken(value: unknown): value is string {
  return typeof value === "string" && CANCEL_TOKEN_PATTERN.test(value);
}

/** Zeitkonstanter Vergleich eines Geheimnisses (z. B. für den Cron-Aufruf). */
export function secretsEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

// ---- Bestätigungs-Token (Double-Opt-In für Gäste) --------------------------------------------------------------------------

const ID = /^[A-Za-z0-9_-]{1,40}$/;
const EXPIRY = /^[0-9]{1,13}$/;
const SIGNATURE = /^[A-Za-z0-9_-]{43}$/;

function signConfirm(secret: string, registrationId: string, expiresAtMs: number): string {
  return createHmac("sha256", secret).update(`event-confirm\u0000${registrationId}\u0000${expiresAtMs}`).digest("base64url");
}

/** Token «<Anmeldung>.<Ablauf in Millisekunden>.<Signatur>» (nur Zeichen aus A–Z, a–z, 0–9, _ - und Punkt). */
export function signConfirmToken(secret: string, registrationId: string, expiresAt: Date): string {
  const ms = expiresAt.getTime();
  if (!ID.test(registrationId) || !Number.isSafeInteger(ms) || ms < 0 || ms > 9_999_999_999_999) throw new RangeError("Ungültige Angaben für das Token.");
  return `${registrationId}.${ms}.${signConfirm(secret, registrationId, ms)}`;
}

export type ConfirmTokenCheck =
  | { ok: true; registrationId: string; expiresAt: Date }
  | { ok: false; reason: "INVALID" }
  /** echte Signatur, aber die Frist ist um (die Anmeldung kann inzwischen bestätigt oder gelöscht sein) */
  | { ok: false; reason: "EXPIRED"; registrationId: string };

/**
 * Prüft ein Bestätigungs-Token: Aufbau, Signatur (zeitkonstant), Ablauf. Die Signatur wird zuerst geprüft; ein abgelaufenes,
 * aber echtes Token meldet «EXPIRED», alles andere «INVALID».
 */
export function verifyConfirmToken(secret: string, token: unknown, now: Date = new Date()): ConfirmTokenCheck {
  if (typeof token !== "string" || token.length > 120) return { ok: false, reason: "INVALID" };
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "INVALID" };
  const [registrationId, expiry, sig] = parts as [string, string, string];
  if (!ID.test(registrationId) || !EXPIRY.test(expiry) || !SIGNATURE.test(sig)) return { ok: false, reason: "INVALID" };
  const ms = Number(expiry);
  const expected = Buffer.from(signConfirm(secret, registrationId, ms));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return { ok: false, reason: "INVALID" };
  if (now.getTime() >= ms) return { ok: false, reason: "EXPIRED", registrationId };
  return { ok: true, registrationId, expiresAt: new Date(ms) };
}

/** Sieht der Wert wie ein Bestätigungs-Token aus? (Vor jedem Datenbankzugriff prüfen; die Signatur prüft verifyConfirmToken.) */
export function isPlausibleConfirmToken(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 120) return false;
  const parts = value.split(".");
  return parts.length === 3 && ID.test(parts[0]!) && EXPIRY.test(parts[1]!) && SIGNATURE.test(parts[2]!);
}
