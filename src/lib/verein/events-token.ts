// Abmelde-Token der Anlässe. Das Token steht im Klartext nur in der Bestätigungsmail; gespeichert wird ausschliesslich der
// SHA-256-Hash (EventRegistration.cancelTokenHash). Es erlaubt nichts anderes, als genau diese Anmeldung zu beenden.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

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
