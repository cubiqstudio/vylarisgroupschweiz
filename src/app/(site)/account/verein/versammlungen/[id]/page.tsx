import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarPlus, ChevronLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { Markdown } from "@/components/ui/markdown";
import { PILL } from "@/components/admin/core/styles";
import { RsvpButtons } from "@/components/verein/meetings/rsvp-buttons";
import { getMessages } from "@/i18n/server";
import { versammlungen } from "@/i18n/verein-versammlungen";
import { cn } from "@/lib/utils";
import { RESOLUTION_RESULT_LABEL, TONE_CLASS, type ResolutionResult } from "@/lib/verein/constants";
import { formatDateCh } from "@/lib/verein/dates";
import { requireMemberPage } from "@/lib/verein/guard";
import { getPortalMeeting } from "@/lib/verein/meetings-data";
import { formatMeetingWhen, kindLabel, voteSummary } from "@/lib/verein/meetings-lib";
import { idSchema } from "@/lib/verein/validation";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages(versammlungen);
  return { title: m.meta.detail, robots: { index: false, follow: false } };
}

const RESULT_TONE = { ANGENOMMEN: "green", ABGELEHNT: "rose", VERSCHOBEN: "amber" } as const;

/** Eine Versammlung mit Traktanden, Rückmeldung und (nach der Genehmigung) Protokoll und Beschlüssen. Nur für aktive Mitglieder. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const parsed = idSchema.safeParse(rawId);
  const member = await requireMemberPage(`/account/verein/versammlungen/${parsed.success ? parsed.data : ""}`);
  if (!parsed.success || member.status !== "AKTIV") notFound();
  const meeting = await getPortalMeeting(member.id, parsed.data);
  if (!meeting) notFound();
  const m = await getMessages(versammlungen);
  const cancelled = meeting.status === "ABGESAGT";
  const approved = meeting.minutesApprovedAt !== null;
  const rsvp = meeting.attendances[0]?.rsvp;
  const open = meeting.status === "EINGELADEN" && meeting.startsAt.getTime() > Date.now();

  return (
    <article aria-labelledby="meeting-title" className="space-y-6">
      <Link href="/account/verein/versammlungen" className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white">
        <ChevronLeft className="h-4 w-4" aria-hidden />
        {m.portal.back}
      </Link>

      <header>
        <p className="text-xs uppercase tracking-wide text-zinc-500">{kindLabel(meeting.kind)}</p>
        <h2 id="meeting-title" className="mt-0.5 text-2xl font-semibold tracking-tight text-white">
          {meeting.title}
          {cancelled && <span className={cn(PILL, TONE_CLASS.rose, "ml-3 align-middle")}>{m.portal.cancelled}</span>}
        </h2>
        <dl className="mt-3 grid gap-x-8 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-zinc-500">{m.detail.when}</dt>
          <dd className="text-zinc-200">{formatMeetingWhen(meeting.startsAt, meeting.endsAt)}</dd>
          {meeting.location && (
            <>
              <dt className="text-zinc-500">{m.detail.where}</dt>
              <dd className="text-zinc-200">{meeting.location}</dd>
            </>
          )}
        </dl>
        {!cancelled && meeting.status === "EINGELADEN" && (
          <p className="mt-4">
            <a href={`/api/account/verein/meetings/${encodeURIComponent(meeting.id)}/ics`} className={buttonClass("secondary", "md")} download>
              <CalendarPlus className="h-4 w-4" aria-hidden />
              {m.detail.calendar}
            </a>
          </p>
        )}
      </header>

      {cancelled && <Card className="px-5 py-4 text-sm text-zinc-300">{m.portal.cancelledHint}</Card>}

      {!cancelled && meeting.status === "EINGELADEN" && (
        <Card className="p-5">
          <RsvpButtons meetingId={meeting.id} initial={rsvp === "ZUSAGE" || rsvp === "ABSAGE" ? rsvp : ""} open={open} />
        </Card>
      )}

      {meeting.invitationText.trim() && !approved && (
        <section aria-labelledby="inv-text">
          <h3 id="inv-text" className="mb-2 text-base font-semibold text-white">
            {m.detail.invitationText}
          </h3>
          <Card className="whitespace-pre-line px-5 py-4 text-sm text-zinc-300">{meeting.invitationText}</Card>
        </section>
      )}

      {meeting.agenda.length > 0 && (
        <section aria-labelledby="agenda-h">
          <h3 id="agenda-h" className="mb-2 text-base font-semibold text-white">
            {m.detail.agenda}
          </h3>
          <Card className="px-5 py-4">
            <ol className="space-y-3">
              {meeting.agenda.map((a, i) => (
                <li key={a.id}>
                  <p className="font-medium text-zinc-100">
                    {i + 1}. {a.title}
                  </p>
                  {a.description.trim() && <Markdown size="sm" className="mt-1">{a.description}</Markdown>}
                  {a.motion.trim() && (
                    <p className="mt-1 text-sm text-zinc-300">
                      <span className="font-medium">{m.detail.motion}:</span> {a.motion}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </Card>
        </section>
      )}

      {meeting.status === "DURCHGEFUEHRT" &&
        (approved ? (
          <>
            <section aria-labelledby="min-h">
              <h3 id="min-h" className="mb-2 text-base font-semibold text-white">
                {m.detail.minutes}
              </h3>
              <p className="mb-3 text-sm text-zinc-400">{m.detail.approvedBy(formatDateCh(meeting.minutesApprovedAt!), meeting.minutesApprovedBy || "–")}</p>
              <Card className="px-5 py-5">
                <Markdown>{meeting.minutes}</Markdown>
              </Card>
            </section>
            {meeting.resolutions.length > 0 && (
              <section aria-labelledby="res-h">
                <h3 id="res-h" className="mb-2 text-base font-semibold text-white">
                  {m.detail.resolutions}
                </h3>
                <ul className="space-y-3">
                  {meeting.resolutions.map((r) => (
                    <li key={r.id}>
                      <Card className="px-5 py-4">
                        <p className="text-xs uppercase tracking-wide text-zinc-500">{m.detail.resolutionLabel(r.number)}</p>
                        <p className="mt-1 whitespace-pre-line text-zinc-100">{r.text}</p>
                        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-zinc-400">
                          <span className={cn(PILL, TONE_CLASS[RESULT_TONE[r.result as ResolutionResult] ?? "zinc"])}>{RESOLUTION_RESULT_LABEL[r.result as ResolutionResult] ?? r.result}</span>
                          <span>{voteSummary(r) || m.detail.noVotes}</span>
                        </p>
                        {r.recusal.trim() && (
                          <p className="mt-1 text-sm text-zinc-400">
                            {m.detail.recusal}: {r.recusal}
                          </p>
                        )}
                      </Card>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        ) : (
          <Card className="px-5 py-4 text-sm text-zinc-400">{m.detail.noMinutes}</Card>
        ))}
    </article>
  );
}
