// Kalendereintrag per persönlichem Link aus der Einladung (ohne Anmeldung).
import { fail, handle } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { icsResponse } from "@/lib/verein/ics";
import { getMeetingForIcs, getRsvpContext, readRsvpToken } from "@/lib/verein/meetings-data";
import { meetingIcsEvent } from "@/lib/verein/meetings-lib";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  const limit = rateLimit(`meeting-ics:${clientIp(req)}`, 30, 10 * 60_000);
  if (!limit.ok) return fail(429, "RATE_LIMITED", "Zu viele Versuche. Bitte warte einige Minuten.", undefined, { "Retry-After": String(limit.retryAfter) });
  const ref = readRsvpToken(new URL(req.url).searchParams.get("t") ?? "");
  if (!ref) return fail(400, "INVALID_LINK", "Dieser Link ist ungültig. Öffne ihn direkt aus der Einladung.");
  const ctx = await getRsvpContext(ref.meetingId, ref.memberId);
  const m = ctx && (await getMeetingForIcs(ref.meetingId, { assemblyOnly: false }));
  if (!m || m.status === "GEPLANT") return fail(404, "NOT_FOUND", "Sitzung nicht gefunden.");
  return icsResponse(`sitzung-${m.title}`, [meetingIcsEvent(m)], { calendarName: "Sitzungen des Vereins" });
});
