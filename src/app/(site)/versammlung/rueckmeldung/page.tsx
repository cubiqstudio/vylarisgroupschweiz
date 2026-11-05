import type { Metadata } from "next";
import { headers } from "next/headers";
import { CalendarPlus } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/section";
import { RsvpButtons } from "@/components/verein/meetings/rsvp-buttons";
import { getMessages } from "@/i18n/server";
import { versammlungen } from "@/i18n/verein-versammlungen";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { getRsvpContext, readRsvpToken } from "@/lib/verein/meetings-data";
import { formatMeetingWhen, kindLabel } from "@/lib/verein/meetings-lib";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages(versammlungen);
  return { title: m.meta.rsvp, robots: { index: false, follow: false, nocache: true }, referrer: "no-referrer" };
}

/**
 * Rückmeldung zu einer Sitzung über den persönlichen Link aus der Einladung (ohne Konto). Das Token ist signiert und gilt für eine Person und
 * eine Sitzung. Die Seite wird nicht indexiert; ungültige Links ergeben immer dieselbe Meldung. Zugriffe pro IP sind begrenzt.
 */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const m = await getMessages(versammlungen);
  const sp = await searchParams;
  const raw = Array.isArray(sp.t) ? sp.t[0] : sp.t;
  const h = await headers();
  const limit = rateLimit(`meeting-rsvp-page:${clientIp(new Request("http://local", { headers: h }))}`, 60, 10 * 60_000);
  const ref = limit.ok && raw ? readRsvpToken(raw) : null;
  const ctx = ref ? await getRsvpContext(ref.meetingId, ref.memberId) : null;

  if (!ref || !ctx || ctx.meeting.status === "GEPLANT") {
    return (
      <Container className="py-10 sm:py-14">
        <Card className="mx-auto max-w-xl px-6 py-10 text-center">
          <h1 className="text-xl font-semibold text-white">{m.link.invalidTitle}</h1>
          <p className="mt-2 text-sm text-zinc-400">{m.link.invalidText}</p>
        </Card>
      </Container>
    );
  }

  const meeting = ctx.meeting;
  const cancelled = meeting.status === "ABGESAGT";
  return (
    <Container className="py-10 sm:py-14">
      <div className="mx-auto max-w-xl space-y-5">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">{m.link.heading}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">{meeting.title}</h1>
          <p className="mt-2 text-sm text-zinc-300">{m.link.greeting(ctx.firstName)}</p>
        </div>
        <Card className="space-y-2 p-5 text-sm">
          <p className="text-zinc-500">{kindLabel(meeting.kind)}</p>
          <p className="text-zinc-100">{formatMeetingWhen(meeting.startsAt, meeting.endsAt)}</p>
          {meeting.location && <p className="text-zinc-300">{meeting.location}</p>}
        </Card>
        {meeting.agenda.length > 0 && !cancelled && (
          <Card className="p-5">
            <h2 className="mb-2 text-sm font-medium text-zinc-300">{m.detail.agenda}</h2>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-zinc-300">
              {meeting.agenda.map((a) => (
                <li key={a.id}>{a.title}</li>
              ))}
            </ol>
          </Card>
        )}
        {cancelled ? (
          <Card className="p-5">
            <h2 className="font-medium text-white">{m.link.cancelledTitle}</h2>
            <p className="mt-1 text-sm text-zinc-400">{m.link.cancelledText}</p>
          </Card>
        ) : (
          <Card className="p-5">
            <RsvpButtons meetingId={meeting.id} token={raw} initial={ctx.rsvp} open={ctx.open} />
            {!ctx.open && <p className="mt-2 text-sm text-zinc-500">{m.link.pastText}</p>}
          </Card>
        )}
        {!cancelled && ctx.open && (
          <p>
            <a href={`/api/meetings/ics?t=${encodeURIComponent(raw ?? "")}`} className={buttonClass("secondary", "md")} download>
              <CalendarPlus className="h-4 w-4" aria-hidden />
              {m.detail.calendar}
            </a>
          </p>
        )}
        <p className="text-xs text-zinc-500">{m.link.portalHint}</p>
      </div>
    </Container>
  );
}
