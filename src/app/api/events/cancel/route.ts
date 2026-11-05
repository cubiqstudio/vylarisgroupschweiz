import { assertSameOrigin, fail, handle, ok } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { cancelByToken } from "@/lib/verein/events-ops";
import { cancelTokenSchema } from "@/lib/verein/events-schemas";
import { readJson } from "../../_lib/http";

export const dynamic = "force-dynamic";

/** Abmeldung über den Link aus der Bestätigungsmail. Das Token (256 Bit) gilt nur für diese eine Anmeldung. */
export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const limit = rateLimit(`event-cancel:${clientIp(req)}`, 30, 60 * 60 * 1000);
  if (!limit.ok) return fail(429, "RATE_LIMITED", "Zu viele Anfragen. Bitte versuche es später erneut.", undefined, { "Retry-After": String(limit.retryAfter), "Cache-Control": "no-store" });
  const { token } = cancelTokenSchema.parse(await readJson(req));
  const result = await cancelByToken(token);
  return ok({ result }, 200, { headers: { "Cache-Control": "no-store" } });
});
