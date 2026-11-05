import { ApiError, fail, handle, ok } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { secretsEqual } from "@/lib/verein/events-token";
import { sendEventReminders } from "@/lib/verein/events-ops";

export const dynamic = "force-dynamic";

const MIN_SECRET_LENGTH = 24;

/**
 * Erinnerungsmails für Anlässe, die innerhalb der nächsten 36 Stunden beginnen (jede Anmeldung höchstens einmal).
 * Für einen täglichen Cron-Aufruf gedacht, z. B.:
 *   curl -X POST -H "Authorization: Bearer $EVENTS_CRON_SECRET" https://vylaris.ch/api/events/reminders
 * Ohne die Umgebungsvariable EVENTS_CRON_SECRET (mindestens 24 Zeichen) ist die Schnittstelle abgeschaltet.
 * Von Hand lösen Vorstandsmitglieder die Erinnerung auf der Seite des Anlasses aus.
 */
export const POST = handle(async (req: Request) => {
  const secret = process.env.EVENTS_CRON_SECRET?.trim();
  if (!secret || secret.length < MIN_SECRET_LENGTH) throw new ApiError(404, "NOT_FOUND", "Nicht gefunden.");

  const limit = rateLimit(`event-cron:${clientIp(req)}`, 20, 15 * 60 * 1000);
  if (!limit.ok) return fail(429, "RATE_LIMITED", "Zu viele Anfragen.", undefined, { "Retry-After": String(limit.retryAfter), "Cache-Control": "no-store" });

  const header = req.headers.get("authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!given || !secretsEqual(given, secret)) throw new ApiError(401, "UNAUTHORIZED", "Nicht angemeldet.");

  const summary = await sendEventReminders();
  return ok(summary, 200, { headers: { "Cache-Control": "no-store" } });
});
