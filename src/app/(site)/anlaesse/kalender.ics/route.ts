import { buildIcs } from "@/lib/verein/ics";
import { eventToIcs } from "@/lib/verein/events-lib";
import { listForCalendarFeed } from "@/lib/verein/events-data";
import { eventUrl } from "@/lib/verein/links";
import { site } from "@/lib/site";

export const dynamic = "force-dynamic";

/** Kalender-Feed (iCalendar) aller öffentlichen Anlässe zum Abonnieren: kommende und die der letzten 30 Tage. Enthält nur öffentliche Angaben. */
export async function GET() {
  const events = await listForCalendarFeed();
  const body = buildIcs(events.map((e) => eventToIcs(e, eventUrl(e.id))), { calendarName: `Anlässe ${site.shortName}`, domain: site.domain });
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="anlaesse.ics"',
      "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
