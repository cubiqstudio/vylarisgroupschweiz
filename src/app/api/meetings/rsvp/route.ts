// Rückmeldung per persönlichem Link aus der Einladung (ohne Anmeldung). Der Link ist signiert (meetings-token.ts) und gilt nur für
// eine Person und eine Sitzung; mehr als die Rückmeldung ist damit nicht möglich.
import { assertSameOrigin, fail, handle } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { readRsvpToken, saveRsvp } from "@/lib/verein/meetings-data";
import { rsvpTokenSchema } from "@/lib/verein/meetings-schemas";
import { adminOk, readJson } from "../../_lib/http";

export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const limit = rateLimit(`meeting-rsvp:${clientIp(req)}`, 20, 10 * 60_000);
  if (!limit.ok) return fail(429, "RATE_LIMITED", "Zu viele Versuche. Bitte warte einige Minuten.", undefined, { "Retry-After": String(limit.retryAfter) });
  const input = rsvpTokenSchema.parse(await readJson(req));
  const ref = readRsvpToken(input.token);
  if (!ref) return fail(400, "INVALID_LINK", "Dieser Link ist ungültig. Öffne ihn direkt aus der Einladung.");
  const state = await saveRsvp(ref.memberId, ref.meetingId, { status: input.status, note: input.note });
  return adminOk({ rsvp: state.rsvp });
});
