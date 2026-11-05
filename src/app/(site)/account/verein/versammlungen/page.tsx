import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PILL } from "@/components/admin/core/styles";
import { RsvpButtons } from "@/components/verein/meetings/rsvp-buttons";
import { getMessages } from "@/i18n/server";
import { verein } from "@/i18n/verein";
import { versammlungen } from "@/i18n/verein-versammlungen";
import { cn } from "@/lib/utils";
import { TONE_CLASS } from "@/lib/verein/constants";
import { formatDateCh } from "@/lib/verein/dates";
import { requireMemberPage } from "@/lib/verein/guard";
import { listPortalMeetings } from "@/lib/verein/meetings-data";
import { formatMeetingWhen, kindLabel } from "@/lib/verein/meetings-lib";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const m = (await getMessages(verein)).portal;
  return { title: m.meta.meetings, robots: { index: false, follow: false } };
}

/** Versammlungen des Vereins im Portal: kommende Einladungen mit Rückmeldung und genehmigte Protokolle (jede Abfrage filtert mit der ID des Mitglieds). */
export default async function Page() {
  const member = await requireMemberPage("/account/verein/versammlungen");
  const m = await getMessages(versammlungen);
  const active = member.status === "AKTIV";
  const { upcoming, past } = active ? await listPortalMeetings(member.id) : { upcoming: [], past: [] };

  return (
    <section aria-labelledby="meetings-heading" className="space-y-8">
      <div>
        <h2 id="meetings-heading" className="text-xl font-semibold tracking-tight text-white">
          {m.portal.heading}
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">{m.portal.intro}</p>
      </div>

      {!active ? (
        <Card className="px-6 py-8 text-sm text-zinc-300">{m.portal.notActive}</Card>
      ) : (
        <>
          <div>
            <h3 className="mb-3 text-base font-semibold text-white">{m.portal.upcoming}</h3>
            {upcoming.length === 0 ? (
              <Card className="flex flex-col items-center px-6 py-12 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800/80 text-zinc-400 ring-1 ring-inset ring-zinc-700">
                  <CalendarDays className="h-5 w-5" aria-hidden />
                </span>
                <p className="mt-3 max-w-sm text-sm text-zinc-400">{m.portal.upcomingEmpty}</p>
              </Card>
            ) : (
              <ul className="space-y-4">
                {upcoming.map((u) => {
                  const rsvp = u.attendances[0]?.rsvp;
                  const cancelled = u.status === "ABGESAGT";
                  return (
                    <li key={u.id}>
                      <Card className="p-5">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-xs uppercase tracking-wide text-zinc-500">{kindLabel(u.kind)}</p>
                            <h4 className="mt-0.5 text-lg font-semibold text-white">{u.title}</h4>
                            <p className="mt-1 text-sm text-zinc-300">{formatMeetingWhen(u.startsAt, u.endsAt)}</p>
                            {u.location && <p className="text-sm text-zinc-400">{u.location}</p>}
                          </div>
                          {cancelled && <span className={cn(PILL, TONE_CLASS.rose)}>{m.portal.cancelled}</span>}
                        </div>
                        {cancelled ? (
                          <p className="mt-3 text-sm text-zinc-400">{m.portal.cancelledHint}</p>
                        ) : (
                          <div className="mt-4 border-t border-zinc-800 pt-4">
                            <RsvpButtons meetingId={u.id} initial={rsvp === "ZUSAGE" || rsvp === "ABSAGE" ? rsvp : ""} open />
                          </div>
                        )}
                        <p className="mt-4">
                          <Link href={`/account/verein/versammlungen/${encodeURIComponent(u.id)}`} className="text-sm font-medium text-emerald-400 hover:underline">
                            {m.portal.view}
                            <span className="sr-only"> {u.title}</span>
                          </Link>
                        </p>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div>
            <h3 className="mb-3 text-base font-semibold text-white">{m.portal.minutes}</h3>
            {past.length === 0 ? (
              <Card className="flex flex-col items-center px-6 py-12 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800/80 text-zinc-400 ring-1 ring-inset ring-zinc-700">
                  <FileText className="h-5 w-5" aria-hidden />
                </span>
                <p className="mt-3 max-w-sm text-sm text-zinc-400">{m.portal.minutesEmpty}</p>
              </Card>
            ) : (
              <Card className="divide-y divide-zinc-800">
                {past.map((p) => (
                  <Link key={p.id} href={`/account/verein/versammlungen/${encodeURIComponent(p.id)}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 hover:bg-zinc-900/50">
                    <span>
                      <span className="block font-medium text-white">{p.title}</span>
                      <span className="block text-sm text-zinc-400">
                        {kindLabel(p.kind)} · {formatDateCh(p.startsAt)}
                      </span>
                    </span>
                    <span className="text-sm text-zinc-500">{p.minutesApprovedAt ? m.portal.approvedOn(formatDateCh(p.minutesApprovedAt)) : ""}</span>
                  </Link>
                ))}
              </Card>
            )}
          </div>
        </>
      )}
    </section>
  );
}
