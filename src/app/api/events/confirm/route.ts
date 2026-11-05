import { assertSameOrigin, fail, handle, ok } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { confirmRegistrationByToken } from "@/lib/verein/events-confirm";
import { confirmTokenSchema } from "@/lib/verein/events-schemas";
import { readJson } from "../../_lib/http";

export const dynamic = "force-dynamic";

/**
 * Bestätigung der E-Mail-Adresse eines Gastes über den Link aus der Mail (Double-Opt-In).
 * Nur diese POST-Anfrage bestätigt; das blosse Öffnen des Links ändert nichts (Mail-Scanner rufen Links vorab ab).
 * Die Antwort nennt nur das Ergebnis, nie Daten Dritter.
 */
export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const limit = rateLimit(`event-confirm:${clientIp(req)}`, 30, 60 * 60 * 1000);
  if (!limit.ok) return fail(429, "RATE_LIMITED", "Zu viele Anfragen. Bitte versuche es später erneut.", undefined, { "Retry-After": String(limit.retryAfter), "Cache-Control": "no-store" });
  const { token } = confirmTokenSchema.parse(await readJson(req));
  const result = await confirmRegistrationByToken(token);
  return ok({ result }, 200, { headers: { "Cache-Control": "no-store" } });
});
