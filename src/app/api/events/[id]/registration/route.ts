import { ApiError, fail, handle, ok } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { cancelOwnRegistration, registerForEvent } from "@/lib/verein/events-ops";
import { memberRegistrationSchema } from "@/lib/verein/events-schemas";
import { requireActiveMember, requireMember } from "@/lib/verein/guard";
import { readJson, type IdContext } from "../../../_lib/http";

export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "no-store" };
const ID = /^[A-Za-z0-9_-]{1,40}$/;
const WINDOW_MS = 60 * 60 * 1000;

const tooMany = (retryAfter: number) => fail(429, "RATE_LIMITED", "Zu viele Anfragen. Bitte versuche es später erneut.", undefined, { "Retry-After": String(retryAfter), ...HEADERS });

/** Aktuelles Mitglied meldet sich selbst an (Mitglied und Sitzung ergeben sich aus dem Konto, nie aus der Anfrage). */
export const POST = handle(async (req: Request, { params }: IdContext) => {
  const { member } = await requireActiveMember(req);
  const { id } = await params;
  if (!ID.test(id)) throw new ApiError(404, "NOT_FOUND", "Anlass nicht gefunden.");
  const limit = rateLimit(`event-member:${member.id}`, 40, WINDOW_MS);
  if (!limit.ok) return tooMany(limit.retryAfter);
  const input = memberRegistrationSchema.parse(await readJson(req));
  const outcome = await registerForEvent({
    eventId: id,
    who: { kind: "member", member: { id: member.id, firstName: member.firstName, lastName: member.lastName, email: member.email } },
    seats: input.seats,
    note: input.note,
  });
  return ok({ status: outcome.status, seats: outcome.seats }, outcome.created ? 201 : 200, { headers: HEADERS });
});

/** Mitglied meldet sich selbst ab (auch ein ehemaliges Mitglied darf eine bestehende Anmeldung zurückziehen). */
export const DELETE = handle(async (req: Request, { params }: IdContext) => {
  const { member } = await requireMember(req);
  const { id } = await params;
  if (!ID.test(id)) throw new ApiError(404, "NOT_FOUND", "Anlass nicht gefunden.");
  const limit = rateLimit(`event-member:${member.id}`, 40, WINDOW_MS);
  if (!limit.ok) return tooMany(limit.retryAfter);
  await cancelOwnRegistration(member.id, id);
  return ok({ cancelled: true }, 200, { headers: HEADERS });
});
