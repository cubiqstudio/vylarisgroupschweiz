import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, CalendarPlus, Clock, MapPin, Users } from "lucide-react";
import { DateBadge, EventBadges, seatText } from "@/components/verein/events/event-parts";
import { MemberRegistration } from "@/components/verein/events/member-registration";
import { Card } from "@/components/ui/card";
import { Markdown } from "@/components/ui/markdown";
import { getMessages } from "@/i18n/server";
import { verein } from "@/i18n/verein";
import { vereinAnlaesse } from "@/i18n/verein-anlaesse";
import { formatDateTimeCh } from "@/lib/verein/dates";
import { listEventsForMember, listPastEventsOfMember } from "@/lib/verein/events-data";
import { formatEventWhen, MAX_SEATS_MEMBER, registrationBlock } from "@/lib/verein/events-lib";
import { requireMemberPage } from "@/lib/verein/guard";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const m = (await getMessages(verein)).portal;
  return { title: m.meta.events, robots: { index: false, follow: false } };
}

/** Kommende Anlässe für Mitglieder (auch die nur für Mitglieder) mit Anmeldung und Abmeldung. Nur Daten des angemeldeten Mitglieds. */
export default async function PortalEventsPage() {
  const member = await requireMemberPage("/account/verein/anlaesse");
  const m = await getMessages(vereinAnlaesse);
  const p = m.portal;
  const now = new Date();
  const [events, past] = await Promise.all([listEventsForMember(member.id, now), listPastEventsOfMember(member.id, now)]);
  const active = member.status === "AKTIV";

  return (
    <section aria-labelledby="events-heading" className="space-y-8">
      <div>
        <h2 id="events-heading" className="text-xl font-semibold tracking-tight text-white">
          {p.heading}
        </h2>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-zinc-400">{p.intro}</p>
      </div>

      {!active && <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{p.notActive}</p>}

      {events.length === 0 ? (
        <Card className="flex flex-col items-center px-6 py-14 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-zinc-800/80 text-zinc-400 ring-1 ring-inset ring-zinc-700">
            <CalendarDays className="size-5" aria-hidden />
          </span>
          <h3 className="mt-4 text-lg font-semibold text-white">{p.emptyTitle}</h3>
          <p className="mt-1.5 max-w-sm text-sm text-zinc-400">{p.emptyText}</p>
        </Card>
      ) : (
        <ul className="space-y-4">
          {events.map((e) => {
            const cancelled = e.status === "ABGESAGT";
            const block = registrationBlock(e, now);
            const own = e.own && e.own.status !== "ABGESAGT" ? e.own : null;
            return (
              <li key={e.id} id={`anlass-${e.id}`}>
                <Card className="p-5">
                  <div className="flex items-start gap-4">
                    <DateBadge date={e.startsAt} muted={cancelled} />
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
                        <h3 className={cn("text-lg font-semibold tracking-tight [overflow-wrap:anywhere]", cancelled ? "text-zinc-400 line-through decoration-zinc-600" : "text-white")}>{e.title}</h3>
                        <EventBadges m={m} event={e} seats={e.seats} registered={own ? (own.status as "ANGEMELDET" | "WARTELISTE") : null} />
                      </div>
                      <ul className="space-y-1 text-sm text-zinc-400">
                        <li className="flex items-start gap-2">
                          <Clock className="mt-0.5 size-4 shrink-0 text-zinc-500" aria-hidden />
                          <span>{formatEventWhen(e.startsAt, e.endsAt)}</span>
                        </li>
                        {e.location && (
                          <li className="flex items-start gap-2">
                            <MapPin className="mt-0.5 size-4 shrink-0 text-zinc-500" aria-hidden />
                            <span className="[overflow-wrap:anywhere]">{e.location}</span>
                          </li>
                        )}
                        {!cancelled && (
                          <li className="flex items-start gap-2">
                            <Users className="mt-0.5 size-4 shrink-0 text-zinc-500" aria-hidden />
                            <span>
                              {seatText(m, e, e.seats)}
                              {e.registrationDeadline && ` · ${m.detail.deadline}: ${formatDateTimeCh(e.registrationDeadline)}`}
                            </span>
                          </li>
                        )}
                      </ul>

                      {e.description.trim() && (
                        <details className="group text-sm">
                          <summary className="cursor-pointer text-emerald-400 hover:text-emerald-300">{p.showDetails}</summary>
                          <div className="mt-3">
                            <Markdown>{e.description}</Markdown>
                          </div>
                        </details>
                      )}

                      {cancelled ? (
                        <p role="status" className="text-sm text-rose-300">
                          {m.detail.cancelledText}
                        </p>
                      ) : (
                        <>
                          {block && !own && (
                            <p role="status" className="text-sm text-zinc-400">
                              {m.detail.closed[block]}
                            </p>
                          )}
                          <MemberRegistration
                            eventId={e.id}
                            eventTitle={e.title}
                            own={e.own ? { status: e.own.status as "ANGEMELDET" | "WARTELISTE" | "ABGESAGT", seats: e.own.seats } : null}
                            maxSeats={MAX_SEATS_MEMBER}
                            seatsLeft={e.seats.left}
                            canRegister={active && block === null}
                            canCancel={block === null || block === "DEADLINE"}
                          />
                          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                            <a href={`/api/events/${encodeURIComponent(e.id)}/ics`} className="inline-flex items-center gap-1.5 text-emerald-400 underline underline-offset-4 hover:text-emerald-300">
                              <CalendarPlus className="size-4" aria-hidden />
                              {p.ics}
                              <span className="sr-only"> ({e.title})</span>
                            </a>
                            {e.isPublic && (
                              <Link href={`/anlaesse/${encodeURIComponent(e.id)}`} className="text-zinc-400 underline underline-offset-4 hover:text-white">
                                {p.openPage}
                                <span className="sr-only"> ({e.title})</span>
                              </Link>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {past.length > 0 && (
        <div>
          <h3 className="text-base font-semibold text-white">{p.pastTitle}</h3>
          <ul className="mt-3 divide-y divide-zinc-800 rounded-2xl border border-zinc-800">
            {past.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm">
                <span className="min-w-0">
                  <span className="font-medium text-zinc-200 [overflow-wrap:anywhere]">{r.event.title}</span>
                  <span className="block text-xs text-zinc-500">{formatEventWhen(r.event.startsAt, r.event.endsAt)}</span>
                </span>
                <span className="text-xs text-zinc-400">{r.attendedAt ? p.pastAttended : p.pastRegistered}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
