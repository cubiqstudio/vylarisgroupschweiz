import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, ChevronLeft, Circle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDateCh, formatDateTimeCh, toDateInputValue, toDateTimeLocalValue, todayZurich } from "@/lib/verein/dates";
import { requireModulePage } from "@/lib/verein/guard";
import { getMeetingDetail, invitationOverview } from "@/lib/verein/meetings-data";
import { countPresentVoters, formatMeetingWhen, isAssemblyKind, isMinutesLocked, kindLabel } from "@/lib/verein/meetings-lib";
import { memberName } from "@/lib/verein/members-lib";
import { canAccess } from "@/lib/verein/permissions";
import { idSchema } from "@/lib/verein/validation";
import { PageTitle } from "@/components/admin/core/page-title";
import { Notice } from "@/components/admin/core/notice";
import { AgendaManager } from "@/components/admin/meetings/agenda-manager";
import { AttendancePanel } from "@/components/admin/meetings/attendance-panel";
import { InvitationPanel } from "@/components/admin/meetings/invitation-panel";
import { MeetingForm } from "@/components/admin/meetings/meeting-form";
import { MeetingStatusActions } from "@/components/admin/meetings/meeting-status-actions";
import { MeetingsNav } from "@/components/admin/meetings/meetings-nav";
import { MinutesEditor } from "@/components/admin/meetings/minutes-editor";
import { MeetingStatusPill } from "@/components/admin/meetings/pills";
import { ResolutionsPanel } from "@/components/admin/meetings/resolutions-panel";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sitzung" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const TABS = [
  { key: "uebersicht", label: "Übersicht" },
  { key: "traktanden", label: "Traktanden" },
  { key: "einladung", label: "Einladung" },
  { key: "anwesenheit", label: "Anwesenheit" },
  { key: "beschluesse", label: "Beschlüsse" },
  { key: "protokoll", label: "Protokoll" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default async function AdminMeetingPage({ params, searchParams }: Props) {
  const admin = await requireModulePage("meetings");
  const parsed = idSchema.safeParse((await params).id);
  if (!parsed.success) notFound();
  const m = await getMeetingDetail(parsed.data);
  if (!m) notFound();
  const sp = await searchParams;
  const tabParam = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab;
  const tab: TabKey = TABS.some((t) => t.key === tabParam) ? (tabParam as TabKey) : "uebersicht";
  const includeNonVoting = (Array.isArray(sp.alle) ? sp.alle[0] : sp.alle) === "1";

  const canWrite = canAccess(admin.roles, "meetings", "write");
  const canCreateTask = canWrite && canAccess(admin.roles, "tasks", "write");
  const canViewTasks = canAccess(admin.roles, "tasks", "read");
  const locked = isMinutesLocked(m);
  const board = m.kind === "VORSTANDSSITZUNG";
  const nameOf = (x: { firstName: string; lastName: string; anonymizedAt: Date | null; memberNumber: number }) => memberName(x);

  const attendanceRows = m.attendances.map((a) => ({
    memberId: a.memberId,
    memberNumber: a.member.memberNumber,
    name: nameOf(a.member),
    status: a.status,
    canVote: a.canVote,
    note: a.note,
    rsvp: (a.rsvp === "ZUSAGE" || a.rsvp === "ABSAGE" ? a.rsvp : "") as "" | "ZUSAGE" | "ABSAGE",
  }));
  const presentVoters = countPresentVoters(m.attendances);
  const agendaTitleById = new Map(m.agenda.map((a) => [a.id, a.title]));

  // Die Empfängerliste ist eine Mitgliederliste: nur für Rollen mit Leserecht auf «Mitglieder».
  const canSeeRecipients = canAccess(admin.roles, "members", "read");
  const overview = tab === "einladung" && canSeeRecipients ? await invitationOverview(m, { includeNonVoting }) : null;
  const canSend = (m.status === "GEPLANT" || m.status === "EINGELADEN") && m.startsAt.getTime() > Date.now();

  const counts: Partial<Record<TabKey, number>> = { traktanden: m.agenda.length, anwesenheit: m.attendances.length, beschluesse: m.resolutions.length };
  const tabHref = (key: TabKey) => `/admin/meetings/${m.id}${key === "uebersicht" ? "" : `?tab=${key}`}`;

  const steps: Array<{ done: boolean; label: string; tab: TabKey }> = [
    { done: m.agenda.length > 0, label: "Traktanden erfassen", tab: "traktanden" },
    { done: m.invitationCount > 0 || m.invitationSentAt !== null, label: "Einladung versenden", tab: "einladung" },
    { done: m.attendances.some((a) => a.status === "ANWESEND"), label: "Anwesenheit erfassen", tab: "anwesenheit" },
    { done: m.resolutions.length > 0, label: "Beschlüsse festhalten", tab: "beschluesse" },
    { done: locked, label: "Protokoll genehmigen", tab: "protokoll" },
  ];

  const draft = {
    meeting: {
      kind: m.kind,
      title: m.title,
      startsAt: m.startsAt.toISOString(),
      endsAt: m.endsAt?.toISOString() ?? null,
      location: m.location,
      quorumMin: m.quorumMin,
      leaderName: m.leader ? nameOf(m.leader) : null,
      recorderName: m.recorder ? nameOf(m.recorder) : null,
    },
    agenda: m.agenda.map((a) => ({ id: a.id, position: a.position, title: a.title, description: a.description, motion: a.motion })),
    resolutions: m.resolutions.map((r) => ({ agendaItemId: r.agendaItemId, number: r.number, text: r.text, votesYes: r.votesYes, votesNo: r.votesNo, abstentions: r.abstentions, result: r.result, recusal: r.recusal })),
    attendance: m.attendances.map((a) => ({ name: nameOf(a.member), status: a.status, canVote: a.canVote })),
  };

  return (
    <div>
      <Link href="/admin/meetings" className="mb-3 inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white">
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Alle Sitzungen
      </Link>
      <PageTitle
        title={m.title}
        description={
          <>
            {kindLabel(m.kind)} · {formatMeetingWhen(m.startsAt, m.endsAt)}
            {m.location && <> · {m.location}</>}
          </>
        }
      >
        <MeetingStatusPill status={m.status} />
      </PageTitle>
      <MeetingsNav />

      <nav aria-label="Abschnitte der Sitzung" className="-mx-1 mb-6 overflow-x-auto px-1 pb-1">
        <ul className="flex min-w-max gap-1.5">
          {TABS.map((t) => {
            const active = tab === t.key;
            const count = counts[t.key];
            return (
              <li key={t.key}>
                <Link
                  href={tabHref(t.key)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium ring-1 ring-inset transition-colors",
                    active ? "bg-zinc-900 text-white ring-zinc-700" : "bg-zinc-900/50 text-zinc-400 ring-zinc-800 hover:bg-zinc-900 hover:text-zinc-100",
                  )}
                >
                  {t.label}
                  {count !== undefined && count > 0 && <span className="tabular-nums text-xs text-zinc-500">{count}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {tab === "uebersicht" && (
        <div className="space-y-6">
          <MeetingStatusActions meeting={{ id: m.id, title: m.title, status: m.status, invitationCount: m.invitationCount, minutesApproved: locked }} canWrite={canWrite} />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <MeetingForm
              canWrite={canWrite}
              kindLocked={m.invitationCount > 0 || m.invitationSentAt !== null || locked}
              initial={{
                id: m.id,
                kind: m.kind,
                title: m.title,
                startsAt: toDateTimeLocalValue(m.startsAt),
                endsAt: m.endsAt ? toDateTimeLocalValue(m.endsAt) : "",
                location: m.location,
                leader: m.leader ? { id: m.leader.id, memberNumber: m.leader.memberNumber, name: nameOf(m.leader), city: "" } : null,
                recorder: m.recorder ? { id: m.recorder.id, memberNumber: m.recorder.memberNumber, name: nameOf(m.recorder), city: "" } : null,
                quorumMin: m.quorumMin === null ? "" : String(m.quorumMin),
                invitationText: m.invitationText,
              }}
            />
            <aside aria-label="Fortschritt" className="space-y-4">
              <Card className="p-4">
                <h2 className="mb-3 text-sm font-medium text-zinc-300">Ablauf</h2>
                <ol className="space-y-2">
                  {steps.map((s) => (
                    <li key={s.label}>
                      <Link href={tabHref(s.tab)} className="flex items-center gap-2.5 text-sm text-zinc-300 hover:text-white">
                        {s.done ? <Check className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden /> : <Circle className="h-4 w-4 shrink-0 text-zinc-600" aria-hidden />}
                        <span className={s.done ? "text-zinc-400 line-through decoration-zinc-600" : undefined}>{s.label}</span>
                        <span className="sr-only">{s.done ? " (erledigt)" : " (offen)"}</span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </Card>
              <Card className="space-y-1.5 p-4 text-sm text-zinc-400">
                {m.invitationSentAt && <p>Eingeladen am {formatDateCh(m.invitationSentAt)} ({m.invitationCount} {m.invitationCount === 1 ? "Person" : "Personen"})</p>}
                {m.minutesApprovedAt && <p>Protokoll genehmigt am {formatDateCh(m.minutesApprovedAt)}</p>}
                <p>Angelegt am {formatDateTimeCh(m.createdAt)}</p>
                {!isAssemblyKind(m.kind) && <p>Vorstandssitzungen sind für Mitglieder im Portal nicht sichtbar.</p>}
              </Card>
            </aside>
          </div>
        </div>
      )}

      {tab === "traktanden" && (
        <AgendaManager
          meetingId={m.id}
          canWrite={canWrite}
          locked={locked}
          items={m.agenda.map((a) => ({ id: a.id, title: a.title, description: a.description, motion: a.motion, resolutionCount: m.resolutions.filter((r) => r.agendaItemId === a.id).length }))}
        />
      )}

      {tab === "einladung" && overview && (
        <InvitationPanel
          meetingId={m.id}
          board={board}
          canWrite={canWrite}
          canSend={canSend}
          timing={{ state: overview.timing.state, text: overview.timing.text }}
          blockedByMissingSetting={overview.blockedByMissingSetting}
          includeNonVoting={includeNonVoting}
          recipients={overview.recipients.map((r) => ({ memberId: r.memberId, name: r.name, channel: r.channel, rsvp: r.rsvp, invited: overview.alreadyInvited.includes(r.memberId) }))}
          batches={overview.batches.map((b) => ({ ...b, sentAt: b.sentAt.toISOString(), sentAtLabel: formatDateTimeCh(b.sentAt) }))}
          invitationSentAtLabel={m.invitationSentAt ? formatDateCh(m.invitationSentAt) : null}
          firstSentOnTime={overview.firstSentOnTime}
        />
      )}

      {tab === "einladung" && !canSeeRecipients && (
        <Notice variant="info">Die Empfängerliste und das Versandprotokoll sehen nur Rollen mit Zugriff auf die Mitglieder.</Notice>
      )}

      {tab === "anwesenheit" && <AttendancePanel meetingId={m.id} rows={attendanceRows} quorumMin={m.quorumMin} canWrite={canWrite} locked={locked} />}

      {tab === "beschluesse" && (
        <ResolutionsPanel
          meetingId={m.id}
          canWrite={canWrite}
          canCreateTask={canCreateTask}
          canViewTasks={canViewTasks}
          locked={locked}
          presentVoters={presentVoters}
          agenda={m.agenda.map((a) => ({ id: a.id, title: a.title }))}
          items={m.resolutions.map((r) => ({
            id: r.id,
            number: r.number,
            text: r.text,
            agendaItemId: r.agendaItemId,
            agendaTitle: r.agendaItemId ? (agendaTitleById.get(r.agendaItemId) ?? "") : "",
            votesYes: r.votesYes,
            votesNo: r.votesNo,
            abstentions: r.abstentions,
            majority: r.majority,
            result: r.result,
            recusal: r.recusal,
            tasks: r.tasks,
          }))}
        />
      )}

      {tab === "protokoll" && (
        <>
          {!isAssemblyKind(m.kind) && (
            <div className="mb-4">
              <Notice variant="info">Protokolle von Vorstandssitzungen sind intern und erscheinen nicht im Mitgliederportal.</Notice>
            </div>
          )}
          <MinutesEditor
            meetingId={m.id}
            status={m.status}
            minutes={m.minutes}
            canWrite={canWrite}
            approved={m.minutesApprovedAt ? { on: formatDateCh(m.minutesApprovedAt), by: m.minutesApprovedBy || "–", note: m.minutesApprovedNote } : null}
            draft={draft}
            printHref={`/admin/meetings/${m.id}/print`}
            today={toDateInputValue(todayZurich())}
          />
        </>
      )}
    </div>
  );
}
