import { ApiError, handle } from "@/lib/api";
import { db } from "@/lib/db";
import { eventToIcs } from "@/lib/verein/events-lib";
import { getCurrentMember } from "@/lib/verein/guard";
import { icsResponse } from "@/lib/verein/ics";
import { eventUrl } from "@/lib/verein/links";
import { site } from "@/lib/site";
import { EVENT_VIEW_SELECT } from "@/lib/verein/events-data";
import type { IdContext } from "../../../_lib/http";

export const dynamic = "force-dynamic";

const ID = /^[A-Za-z0-9_-]{1,40}$/;

/**
 * Kalendereintrag (.ics) zu einem Anlass. Öffentliche Anlässe sind für alle abrufbar, Anlässe nur für Mitglieder
 * nur mit der Sitzung eines aktuellen Mitglieds (sonst 404, damit nichts über sie verraten wird).
 */
export const GET = handle(async (_req: Request, { params }: IdContext) => {
  const { id } = await params;
  if (!ID.test(id)) throw new ApiError(404, "NOT_FOUND", "Anlass nicht gefunden.");
  const event = await db.event.findFirst({ where: { id, status: { in: ["VEROEFFENTLICHT", "ABGESAGT"] } }, select: EVENT_VIEW_SELECT });
  if (!event) throw new ApiError(404, "NOT_FOUND", "Anlass nicht gefunden.");
  if (!event.isPublic) {
    const member = await getCurrentMember();
    if (!member || member.status !== "AKTIV") throw new ApiError(404, "NOT_FOUND", "Anlass nicht gefunden.");
  }
  return icsResponse(`Anlass-${event.title}`, [eventToIcs(event, eventUrl(event.id))], { calendarName: event.title, domain: site.domain });
});
