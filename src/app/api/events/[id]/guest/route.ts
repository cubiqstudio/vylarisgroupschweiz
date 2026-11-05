import { ApiError, assertSameOrigin, fail, handle, ok } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { registerForEvent } from "@/lib/verein/events-ops";
import { guestRegistrationSchema } from "@/lib/verein/events-schemas";
import { readJson, type IdContext } from "../../../_lib/http";

export const dynamic = "force-dynamic";

const WINDOW_MS = 60 * 60 * 1000;
const FLOOD_LIMIT = 60;
const IP_LIMIT = 8;
const PER_EMAIL_LIMIT = 3;
const ID = /^[A-Za-z0-9_-]{1,40}$/;

const tooMany = (retryAfter: number) =>
  fail(429, "RATE_LIMITED", "Zu viele Anfragen. Bitte versuche es später erneut.", undefined, { "Retry-After": String(retryAfter), "Cache-Control": "no-store" });

/**
 * Anmeldung eines Gastes (ohne Konto) zu einem öffentlichen Anlass, der Gäste zulässt.
 * Bestätigung und Abmelde-Link gehen per Mail an die angegebene Adresse. Honeypot und Rate-Limits gegen Missbrauch.
 * Die Antwort ist für neue und bereits angemeldete Adressen identisch (keine Auskunft über Dritte).
 */
export const POST = handle(async (req: Request, { params }: IdContext) => {
  assertSameOrigin(req);
  const { id } = await params;
  if (!ID.test(id)) throw new ApiError(404, "NOT_FOUND", "Anlass nicht gefunden.");

  const ip = clientIp(req);
  const flood = rateLimit(`event-any:${ip}`, FLOOD_LIMIT, WINDOW_MS);
  if (!flood.ok) return tooMany(flood.retryAfter);

  const body = await readJson(req);
  if (typeof body !== "object" || body === null || Array.isArray(body)) throw new ApiError(400, "BAD_JSON", "Der Body muss ein JSON-Objekt sein.");
  // Honeypot: Bots füllen das versteckte Feld «website». Wir tun so, als wäre alles gut – ohne zu speichern.
  const trap = (body as Record<string, unknown>).website;
  if (typeof trap === "string" && trap !== "") return ok({ received: true as const }, 201, { headers: { "Cache-Control": "no-store" } });

  const input = guestRegistrationSchema.parse(body);

  const ipLimit = rateLimit(`event-guest:${ip}`, IP_LIMIT, WINDOW_MS);
  if (!ipLimit.ok) return tooMany(ipLimit.retryAfter);
  // Schützt Postfächer Dritter davor, per Formular mit Mails überschüttet zu werden.
  const mailLimit = rateLimit(`event-guest-email:${id}:${input.email}`, PER_EMAIL_LIMIT, WINDOW_MS);
  if (!mailLimit.ok) return tooMany(mailLimit.retryAfter);

  await registerForEvent({ eventId: id, who: { kind: "guest", name: input.name, email: input.email, consent: input.consent }, seats: input.seats, note: input.note });
  // Immer dieselbe Antwort, ob die Adresse neu ist oder schon angemeldet war: Wer das Formular missbraucht, erfährt nichts über Dritte.
  // Der tatsächliche Stand (angemeldet oder Warteliste) steht in der Bestätigungsmail.
  return ok({ received: true as const }, 201, { headers: { "Cache-Control": "no-store" } });
});
