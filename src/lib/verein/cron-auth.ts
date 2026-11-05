// Zugriffsschutz der Cron-Schnittstellen (/api/cron/daily, /api/events/reminders): Bearer-Token aus der Umgebung, zeitkonstanter
// Vergleich, Rate-Limit. Ohne gesetztes Geheimnis (mindestens 24 Zeichen) gibt es die Schnittstelle nicht (404).
import "server-only";
import { ApiError, fail } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { CRON_MIN_SECRET_LENGTH } from "./cron-lib";
import { secretsEqual } from "./events-token";

/** Gültige (genügend lange) Geheimnisse aus den genannten Umgebungsvariablen. */
export function configuredCronSecrets(envNames: readonly string[], env: NodeJS.ProcessEnv = process.env): string[] {
  const out: string[] = [];
  for (const name of envNames) {
    const value = env[name]?.trim();
    if (value && value.length >= CRON_MIN_SECRET_LENGTH) out.push(value);
  }
  return out;
}

/** Bearer-Token aus dem Header «Authorization» (leer, wenn keiner da ist). */
export function bearerOf(req: Request): string {
  const header = req.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

/** Stimmt das Token mit einem der Geheimnisse überein? Alle werden verglichen (kein vorzeitiger Abbruch). */
export function tokenMatches(given: string, secrets: readonly string[]): boolean {
  if (!given) return false;
  let match = false;
  for (const s of secrets) if (secretsEqual(given, s)) match = true;
  return match;
}

const REJECT_LOG_EVERY_MS = 60_000;
const lastRejectLog = new Map<string, number>();

/**
 * Hält fest, dass ein Aufruf abgewiesen wurde (Dauerbeschuss soll im Log auffallen), höchstens einmal pro Minute und Schnittstelle.
 * Das Log enthält weder das Token noch die IP-Adresse noch sonstige Inhalte der Anfrage.
 */
export function noteRejectedCronCall(rateKey: string, reason: "token" | "rate", now: number = Date.now()): boolean {
  const key = `${rateKey}:${reason}`;
  const last = lastRejectLog.get(key);
  if (last !== undefined && now - last < REJECT_LOG_EVERY_MS) return false;
  lastRejectLog.set(key, now);
  console.warn(`[cron] Aufruf von ${rateKey} abgewiesen (${reason === "token" ? "Token fehlt oder falsch" : "zu viele Anfragen"}). Weitere Meldungen dieser Art höchstens einmal pro Minute.`);
  return true;
}

/** Nur für Tests. */
export const resetRejectedCronLog = (): void => lastRejectLog.clear();

/**
 * Prüft einen Cron-Aufruf. Wirft 404 (kein Geheimnis eingerichtet) bzw. 401 (Token fehlt oder falsch); liefert bei zu vielen
 * Anfragen die fertige 429-Antwort, sonst null.
 */
export function checkCronRequest(req: Request, envNames: readonly string[], rateKey: string): Response | null {
  const secrets = configuredCronSecrets(envNames);
  if (secrets.length === 0) throw new ApiError(404, "NOT_FOUND", "Nicht gefunden.");

  const limit = rateLimit(`${rateKey}:${clientIp(req)}`, 30, 15 * 60 * 1000);
  if (!limit.ok) {
    noteRejectedCronCall(rateKey, "rate");
    return fail(429, "RATE_LIMITED", "Zu viele Anfragen.", undefined, { "Retry-After": String(limit.retryAfter), "Cache-Control": "no-store" });
  }

  if (!tokenMatches(bearerOf(req), secrets)) {
    noteRejectedCronCall(rateKey, "token");
    throw new ApiError(401, "UNAUTHORIZED", "Nicht angemeldet.");
  }
  return null;
}
