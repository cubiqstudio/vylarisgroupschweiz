import { eventToIcs } from "@/lib/verein/events-lib";
import { getPublicEvent } from "@/lib/verein/events-data";
import { icsResponse } from "@/lib/verein/ics";
import { eventUrl } from "@/lib/verein/links";
import { site } from "@/lib/site";

export const dynamic = "force-dynamic";

const ID = /^[A-Za-z0-9_-]{1,40}$/;

/** Kalendereintrag (.ics) zu einem öffentlichen Anlass. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = ID.test(id) ? await getPublicEvent(id) : null;
  if (!event) return new Response("Nicht gefunden.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  return icsResponse(`Anlass-${event.title}`, [eventToIcs(event, eventUrl(event.id))], { calendarName: event.title, domain: site.domain });
}
