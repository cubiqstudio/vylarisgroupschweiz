import { ApiError, assertSameOrigin, fail, handle, ok } from "@/lib/api";
import { runInBackground } from "@/lib/account";
import { db } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { createApplication } from "@/lib/verein/members-data";
import { sendApplicationNotice, sendApplicationReceived } from "@/lib/verein/members-mail";
import { applicationSchema } from "@/lib/verein/members-schemas";
import { getVereinSettings } from "@/lib/verein/settings";
import { readJson } from "../../_lib/http";

export const dynamic = "force-dynamic";

const LIMIT = 5;
const FLOOD_LIMIT = 40;
const PER_EMAIL_LIMIT = 3;
const WINDOW_MS = 60 * 60 * 1000;

const tooMany = (retryAfter: number) =>
  fail(429, "RATE_LIMITED", "Zu viele Anfragen. Bitte versuche es später erneut.", undefined, { "Retry-After": String(retryAfter), "Cache-Control": "no-store" });
const received = () => ok({ status: "received" as const }, 201, { headers: { "Cache-Control": "no-store" } });

/**
 * Öffentlicher Beitrittsantrag. Antwortet immer gleich («eingegangen»), auch wenn unter der Adresse schon ein Antrag oder ein
 * Mitglied besteht – so verrät das Formular nichts über vorhandene Personen.
 */
export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);

  const ip = clientIp(req);
  const flood = rateLimit(`apply-any:${ip}`, FLOOD_LIMIT, WINDOW_MS);
  if (!flood.ok) return tooMany(flood.retryAfter);

  const body = await readJson(req);
  if (typeof body !== "object" || body === null || Array.isArray(body)) throw new ApiError(400, "BAD_JSON", "Der Body muss ein JSON-Objekt sein.");

  // Honeypot: Bots füllen das versteckte Feld «website». Wir tun so, als wäre alles gut – ohne zu speichern.
  const trap = (body as Record<string, unknown>).website;
  if (typeof trap === "string" && trap !== "") return received();

  const settings = await getVereinSettings();
  if (!settings.applyEnabled) throw new ApiError(403, "APPLICATIONS_CLOSED", "Der Verein nimmt Beitrittsanträge derzeit nicht online entgegen.");

  const input = applicationSchema.parse(body);

  const ipLimit = rateLimit(`apply:${ip}`, LIMIT, WINDOW_MS);
  if (!ipLimit.ok) return tooMany(ipLimit.retryAfter);
  // Schützt Postfächer Dritter davor, per Formular mit Mails überschüttet zu werden.
  const mailLimit = rateLimit(`apply-email:${input.email}`, PER_EMAIL_LIMIT, WINDOW_MS);
  if (!mailLimit.ok) return tooMany(mailLimit.retryAfter);

  // Nur frei wählbare, aktive Mitgliedschaftsarten; gibt es welche, ist die Wahl Pflicht.
  const types = await db.membershipType.findMany({ where: { active: true, selectable: true }, select: { id: true } });
  if (input.membershipTypeId && !types.some((t) => t.id === input.membershipTypeId)) {
    throw new ApiError(422, "VALIDATION_ERROR", "Ungültige Eingabe.", { membershipTypeId: "Bitte eine Mitgliedschaftsart aus der Liste wählen." });
  }
  if (!input.membershipTypeId && types.length > 0) {
    throw new ApiError(422, "VALIDATION_ERROR", "Ungültige Eingabe.", { membershipTypeId: "Bitte eine Mitgliedschaftsart wählen." });
  }

  const created = await createApplication(input);
  if (created) {
    const { member, typeName } = created;
    runInBackground(() => Promise.allSettled([sendApplicationReceived(member, typeName), sendApplicationNotice(member, typeName)]));
  }
  return received();
});
