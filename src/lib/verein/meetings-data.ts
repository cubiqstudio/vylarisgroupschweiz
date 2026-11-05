// Datenzugriff des Moduls Versammlungen (nur auf dem Server): Sitzungen, Traktanden, Anwesenheit, Beschlüsse, Protokoll, Einladung,
// Beschlussregister und Portal. Jede Änderung schreibt in derselben Transaktion einen Eintrag ins Änderungsprotokoll (AuditLog).
// Portal-Abfragen filtern immer mit der ID des angemeldeten Mitglieds (keine IDOR) und liefern nur freigegebene Inhalte.
import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api";
import type { CurrentAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { authSecretString } from "@/lib/session";
import { auditActor, logAudit, type AuditActor } from "./audit";
import { MEETING_KINDS, MEETING_STATUSES, RESOLUTION_RESULTS } from "./constants";
import { formatDateCh, startOfDayZurich, todayZurich, toDateOnly, yearOf, zurichToDate } from "./dates";
import { sendMeetingMail } from "./meetings-mail";
import {
  ASSEMBLY_KINDS,
  amendmentNote,
  changedMinutesBoundFields,
  invitationTiming,
  isMinutesLocked,
  kindLabel,
  moveId,
  nextResolutionNumber,
  PORTAL_MEETING_STATUSES,
  wasSentOnTime,
  type InvitationTiming,
  type MailKind,
  type RegisterRow,
  type Rsvp,
} from "./meetings-lib";
import type {
  AttendanceActionInput,
  InvitationSendInput,
  MeetingActionInput,
  MeetingCreateInput,
  MeetingPatchInput,
  MeetingWhen,
  ResolutionInput,
  TaskFromResolutionInput,
} from "./meetings-schemas";
import { MEETING_WHEN } from "./meetings-schemas";
import { minutesSnapshot } from "./minutes-revision";
import { signRsvpToken, verifyRsvpToken } from "./meetings-token";
import { rsvpPageUrl } from "./meetings-mail";
import { memberName } from "./members-lib";
import { firstParam, MAX_PAGE_SIZE, searchWhere } from "./pagination";
import { getVereinSettings } from "./settings";
import { missingForInvitations } from "./settings-schema";
import { emailSchema } from "./validation";

type Tx = Prisma.TransactionClient;
type ParamSource = URLSearchParams | Record<string, string | string[] | undefined>;

const actorOf = (admin: CurrentAdmin): AuditActor => auditActor(admin);

const conflict = (code: string, message: string): never => {
  throw new ApiError(409, code, message);
};
const notFound = (what = "Sitzung"): never => {
  throw new ApiError(404, "NOT_FOUND", `${what} nicht gefunden.`);
};

export const LOCKED_MESSAGE = "Das Protokoll ist genehmigt und gesperrt. Hebe die Genehmigung mit einer Begründung auf, um Anwesenheit, Traktanden oder Beschlüsse zu ändern.";

// ---- Liste ----------------------------------------------------------------------------------------------------------------

export type MeetingFilters = { q: string; kind: string; status: string; when: "" | MeetingWhen };

export function parseMeetingFilters(source: ParamSource): MeetingFilters {
  const kind = firstParam(source, "kind");
  const status = firstParam(source, "status");
  const when = firstParam(source, "when");
  return {
    q: firstParam(source, "q").trim().slice(0, 100),
    kind: (MEETING_KINDS as readonly string[]).includes(kind) ? kind : "",
    status: (MEETING_STATUSES as readonly string[]).includes(status) ? status : "",
    when: (MEETING_WHEN as readonly string[]).includes(when) ? (when as MeetingWhen) : "",
  };
}

export function meetingWhere(f: MeetingFilters, now: Date = new Date()): Prisma.MeetingWhereInput {
  const and: Prisma.MeetingWhereInput[] = [];
  if (f.q) and.push(searchWhere(f.q, ["title", "location"]));
  if (f.kind) and.push({ kind: f.kind });
  if (f.status) and.push({ status: f.status });
  if (f.when === "kommend") and.push({ startsAt: { gte: startOfDayZurich(now) } });
  if (f.when === "vergangen") and.push({ startsAt: { lt: startOfDayZurich(now) } });
  return and.length ? { AND: and } : {};
}

export const meetingListSelect = {
  id: true,
  kind: true,
  title: true,
  startsAt: true,
  endsAt: true,
  location: true,
  status: true,
  invitationSentAt: true,
  invitationCount: true,
  minutesApprovedAt: true,
  _count: { select: { agenda: true, resolutions: true, attendances: true } },
} satisfies Prisma.MeetingSelect;
export type MeetingListRow = Prisma.MeetingGetPayload<{ select: typeof meetingListSelect }>;

export async function listMeetings(filters: MeetingFilters, skip: number, take: number): Promise<{ rows: MeetingListRow[]; total: number }> {
  const where = meetingWhere(filters);
  const [rows, total] = await Promise.all([
    db.meeting.findMany({ where, orderBy: [{ startsAt: filters.when === "kommend" ? "asc" : "desc" }], skip, take: Math.min(take, MAX_PAGE_SIZE), select: meetingListSelect }),
    db.meeting.count({ where }),
  ]);
  return { rows, total };
}

export async function meetingCounts(now: Date = new Date()) {
  const day = startOfDayZurich(now);
  const [all, upcoming] = await Promise.all([db.meeting.count(), db.meeting.count({ where: { startsAt: { gte: day } } })]);
  return { all, upcoming, past: all - upcoming };
}

/** Nächste Sitzung (für die Übersicht): Art, Titel, Beginn. null, wenn keine geplant ist. */
export function nextMeeting(now: Date = new Date()) {
  return db.meeting.findFirst({
    where: { startsAt: { gte: now }, status: { in: ["GEPLANT", "EINGELADEN"] } },
    orderBy: { startsAt: "asc" },
    select: { id: true, kind: true, title: true, startsAt: true, status: true },
  });
}

/** Sitzungen ohne genehmigtes Protokoll, die schon stattgefunden haben (für die Übersicht und Hinweise). */
export function countMinutesPending(now: Date = new Date()): Promise<number> {
  return db.meeting.count({ where: { startsAt: { lt: now }, status: { in: ["GEPLANT", "EINGELADEN", "DURCHGEFUEHRT"] }, minutesApprovedAt: null } });
}

// ---- Detail ---------------------------------------------------------------------------------------------------------------

export async function getMeetingDetail(id: string) {
  const m = await db.meeting.findUnique({
    where: { id },
    include: {
      agenda: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] },
      resolutions: { orderBy: [{ number: "asc" }], include: { tasks: { select: { id: true, title: true, status: true } } } },
      attendances: {
        include: { member: { select: { id: true, memberNumber: true, firstName: true, lastName: true, anonymizedAt: true, status: true } } },
      },
      leader: { select: { id: true, memberNumber: true, firstName: true, lastName: true, anonymizedAt: true } },
      recorder: { select: { id: true, memberNumber: true, firstName: true, lastName: true, anonymizedAt: true } },
    },
  });
  if (!m) return null;
  const attendances = [...m.attendances].sort((a, b) => a.member.lastName.localeCompare(b.member.lastName, "de-CH") || a.member.firstName.localeCompare(b.member.firstName, "de-CH"));
  return { ...m, attendances };
}
export type MeetingDetail = NonNullable<Awaited<ReturnType<typeof getMeetingDetail>>>;

async function requireMeeting(tx: Tx, id: string) {
  const m = await tx.meeting.findUnique({ where: { id } });
  return m ?? notFound();
}

async function assertMembersExist(tx: Tx, ids: Array<string | null | undefined>): Promise<void> {
  const wanted = [...new Set(ids.filter((v): v is string => Boolean(v)))];
  if (wanted.length === 0) return;
  const found = await tx.member.count({ where: { id: { in: wanted }, anonymizedAt: null } });
  if (found !== wanted.length) throw new ApiError(422, "VALIDATION_ERROR", "Ungültige Eingabe.", { leaderId: "Das gewählte Mitglied wurde nicht gefunden." });
}

const auditMeeting = (m: { kind: string; title: string; startsAt: Date; endsAt: Date | null; location: string; status: string; quorumMin: number | null; leaderId: string | null; recorderId: string | null }) => ({
  kind: m.kind,
  title: m.title,
  startsAt: m.startsAt,
  endsAt: m.endsAt,
  location: m.location,
  status: m.status,
  quorumMin: m.quorumMin,
  leaderId: m.leaderId,
  recorderId: m.recorderId,
});

// ---- Anlegen / ändern / löschen ---------------------------------------------------------------------------------------------

export async function createMeeting(admin: CurrentAdmin, input: MeetingCreateInput) {
  return db.$transaction(async (tx) => {
    await assertMembersExist(tx, [input.leaderId, input.recorderId]);
    const m = await tx.meeting.create({
      data: {
        kind: input.kind,
        title: input.title,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        location: input.location,
        leaderId: input.leaderId,
        recorderId: input.recorderId,
        quorumMin: input.quorumMin,
        invitationText: input.invitationText,
      },
    });
    await logAudit(tx, { actor: actorOf(admin), action: "meeting.create", objectType: "Meeting", objectId: m.id, summary: `${kindLabel(m.kind)} «${m.title}» am ${formatDateCh(m.startsAt)} angelegt`, after: auditMeeting(m) });
    return m;
  });
}

export async function updateMeeting(admin: CurrentAdmin, id: string, patch: MeetingPatchInput) {
  return db.$transaction(async (tx) => {
    const before = await requireMeeting(tx, id);
    if (patch.leaderId !== undefined || patch.recorderId !== undefined) await assertMembersExist(tx, [patch.leaderId, patch.recorderId]);
    const startsAt = patch.startsAt ?? before.startsAt;
    const endsAt = patch.endsAt !== undefined ? patch.endsAt : before.endsAt;
    if (endsAt && endsAt.getTime() <= startsAt.getTime()) throw new ApiError(422, "VALIDATION_ERROR", "Ungültige Eingabe.", { endsAt: "Das Ende muss nach dem Beginn liegen." });
    if (patch.kind && patch.kind !== before.kind && (before.invitationCount > 0 || before.invitationSentAt || before.minutesApprovedAt)) {
      conflict("CONFLICT", "Die Art der Sitzung lässt sich nach dem Einladungsversand oder der Genehmigung des Protokolls nicht mehr ändern.");
    }
    if (isMinutesLocked(before)) {
      const touched = changedMinutesBoundFields(before, patch);
      if (touched.length > 0) {
        conflict("MINUTES_LOCKED", "Das Protokoll ist genehmigt. Titel, Datum, Leitung, Protokollführung, Quorum und Art lassen sich erst ändern, wenn die Genehmigung mit Begründung aufgehoben wurde.");
      }
    }
    const after = await tx.meeting.update({ where: { id }, data: patch });
    const rescheduled = before.startsAt.getTime() !== after.startsAt.getTime() || before.location !== after.location;
    await logAudit(tx, {
      actor: actorOf(admin),
      action: "meeting.update",
      objectType: "Meeting",
      objectId: id,
      summary: `Sitzung «${after.title}» geändert`,
      before: auditMeeting(before),
      after: auditMeeting(after),
    });
    return { meeting: after, changedSchedule: rescheduled && before.invitationCount > 0 };
  });
}

export async function deleteMeeting(admin: CurrentAdmin, id: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const m = await requireMeeting(tx, id);
    if (m.minutesApprovedAt) conflict("CONFLICT", "Eine Sitzung mit genehmigtem Protokoll lässt sich nicht löschen.");
    if (m.invitationCount > 0 || m.invitationSentAt || m.status === "EINGELADEN" || m.status === "DURCHGEFUEHRT") {
      conflict("CONFLICT", "Zu dieser Sitzung wurde eingeladen oder sie hat stattgefunden. Sage sie stattdessen ab, damit die Unterlagen erhalten bleiben.");
    }
    await tx.meeting.delete({ where: { id } });
    await logAudit(tx, { actor: actorOf(admin), action: "meeting.delete", objectType: "Meeting", objectId: id, summary: `Sitzung «${m.title}» gelöscht`, before: auditMeeting(m) });
  });
}

// ---- Status ---------------------------------------------------------------------------------------------------------------

export type ActionResult = { status: string; mails?: { sent: number; failed: number } };

export async function runMeetingAction(admin: CurrentAdmin, id: string, input: MeetingActionInput): Promise<ActionResult> {
  const settings = input.action === "cancel" && input.notify ? await getVereinSettings() : null;
  const result = await db.$transaction(async (tx) => {
    const m = await requireMeeting(tx, id);
    let status = m.status;
    const data: Prisma.MeetingUpdateInput = {};
    let action = "meeting.status";
    let summary = "";
    switch (input.action) {
      case "complete":
        if (m.status !== "GEPLANT" && m.status !== "EINGELADEN") conflict("CONFLICT", "Nur geplante oder eingeladene Sitzungen lassen sich als durchgeführt markieren.");
        status = "DURCHGEFUEHRT";
        summary = `Sitzung «${m.title}» als durchgeführt markiert`;
        break;
      case "cancel":
        if (m.status !== "GEPLANT" && m.status !== "EINGELADEN") conflict("CONFLICT", "Nur geplante oder eingeladene Sitzungen lassen sich absagen.");
        status = "ABGESAGT";
        summary = `Sitzung «${m.title}» abgesagt${input.reason ? `: ${input.reason}` : ""}`;
        break;
      case "reopen":
        if (m.status !== "ABGESAGT" && m.status !== "DURCHGEFUEHRT") conflict("CONFLICT", "Diese Sitzung ist bereits offen.");
        if (m.minutesApprovedAt) conflict("CONFLICT", "Das Protokoll ist genehmigt. Hebe zuerst die Genehmigung auf.");
        status = m.invitationCount > 0 || m.invitationSentAt ? "EINGELADEN" : "GEPLANT";
        summary = `Sitzung «${m.title}» wieder geöffnet`;
        break;
      case "mark-invited": {
        if (m.status !== "GEPLANT") conflict("CONFLICT", "Nur geplante Sitzungen lassen sich als eingeladen markieren.");
        const sentOn = input.sentOn ?? todayZurich();
        if (sentOn.getTime() > todayZurich().getTime()) throw new ApiError(422, "VALIDATION_ERROR", "Ungültige Eingabe.", { sentOn: "Das Datum darf nicht in der Zukunft liegen." });
        status = "EINGELADEN";
        data.invitationSentAt = m.invitationSentAt ?? sentOn;
        action = "meeting.invite";
        summary = `Sitzung «${m.title}» als eingeladen markiert (Einladung auf anderem Weg am ${formatDateCh(sentOn)})`;
        break;
      }
    }
    await tx.meeting.update({ where: { id }, data: { ...data, status } });
    await logAudit(tx, { actor: actorOf(admin), action, objectType: "Meeting", objectId: id, summary, before: { status: m.status }, after: { status } });
    return { status, meeting: m };
  });

  if (input.action === "cancel" && input.notify && settings) {
    const mails = await notifyCancellation(admin, result.meeting, input.reason);
    return { status: result.status, mails };
  }
  return { status: result.status };
}

// ---- Traktanden -----------------------------------------------------------------------------------------------------------

async function assertUnlocked(tx: Tx, id: string) {
  const m = await requireMeeting(tx, id);
  if (isMinutesLocked(m)) conflict("MINUTES_LOCKED", LOCKED_MESSAGE);
  return m;
}

export async function createAgendaItem(admin: CurrentAdmin, meetingId: string, input: { title: string; description: string; motion: string }) {
  return db.$transaction(async (tx) => {
    const m = await assertUnlocked(tx, meetingId);
    const last = await tx.agendaItem.aggregate({ where: { meetingId }, _max: { position: true } });
    const item = await tx.agendaItem.create({ data: { meetingId, position: (last._max.position ?? 0) + 1, ...input } });
    await logAudit(tx, { actor: actorOf(admin), action: "agenda.create", objectType: "AgendaItem", objectId: item.id, summary: `Traktandum «${item.title}» zu «${m.title}» hinzugefügt` });
    return item;
  });
}

export async function updateAgendaItem(
  admin: CurrentAdmin,
  meetingId: string,
  itemId: string,
  patch: { title?: string; description?: string; motion?: string; direction?: "up" | "down" },
) {
  return db.$transaction(async (tx) => {
    await assertUnlocked(tx, meetingId);
    const items = await tx.agendaItem.findMany({ where: { meetingId }, orderBy: [{ position: "asc" }, { createdAt: "asc" }], select: { id: true, title: true } });
    const current = items.find((i) => i.id === itemId);
    if (!current) notFound("Traktandum");
    const { direction, ...fields } = patch;
    if (Object.keys(fields).length > 0) await tx.agendaItem.update({ where: { id: itemId }, data: fields });
    if (direction) {
      const order = moveId(items.map((i) => i.id), itemId, direction);
      for (const [index, id] of order.entries()) await tx.agendaItem.update({ where: { id }, data: { position: index + 1 } });
    }
    await logAudit(tx, { actor: actorOf(admin), action: "agenda.update", objectType: "AgendaItem", objectId: itemId, summary: direction ? `Traktandum «${current!.title}» verschoben` : `Traktandum «${current!.title}» geändert` });
  });
}

export async function deleteAgendaItem(admin: CurrentAdmin, meetingId: string, itemId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    await assertUnlocked(tx, meetingId);
    const item = await tx.agendaItem.findFirst({ where: { id: itemId, meetingId } });
    if (!item) notFound("Traktandum");
    await tx.agendaItem.delete({ where: { id: itemId } });
    const rest = await tx.agendaItem.findMany({ where: { meetingId }, orderBy: [{ position: "asc" }, { createdAt: "asc" }], select: { id: true } });
    for (const [index, r] of rest.entries()) await tx.agendaItem.update({ where: { id: r.id }, data: { position: index + 1 } });
    await logAudit(tx, { actor: actorOf(admin), action: "agenda.delete", objectType: "AgendaItem", objectId: itemId, summary: `Traktandum «${item!.title}» gelöscht` });
  });
}

// ---- Anwesenheit ----------------------------------------------------------------------------------------------------------

/** Aktive Ämter am Stichtag (Vorstand): jedes Amt ausser Revisionsstelle. */
const activeBoardOfficeWhere = (day: Date): Prisma.OfficeWhereInput => ({
  kind: { not: "REVISOR" },
  validFrom: { lte: day },
  OR: [{ validUntil: null }, { validUntil: { gte: day } }],
});

/** Wer zu einer Sitzung dieser Art gehört (Vorstandssitzung: aktive Amtsträger; sonst aktive Mitglieder). */
function participantWhere(kind: string, opts: { includeNonVoting: boolean }): Prisma.MemberWhereInput {
  const base: Prisma.MemberWhereInput = { status: "AKTIV", anonymizedAt: null };
  if (kind === "VORSTANDSSITZUNG") return { ...base, offices: { some: activeBoardOfficeWhere(todayZurich()) } };
  if (opts.includeNonVoting) return base;
  return { ...base, OR: [{ membershipTypeId: null }, { membershipType: { votingRight: true } }] };
}

const votingRightOf = (m: { membershipType: { votingRight: boolean } | null }): boolean => m.membershipType?.votingRight ?? true;

export async function attendanceAction(admin: CurrentAdmin, meetingId: string, input: AttendanceActionInput): Promise<{ added: number }> {
  return db.$transaction(async (tx) => {
    const meeting = await assertUnlocked(tx, meetingId);
    let summary = "";
    let added = 0;
    if (input.action === "init") {
      const members = await tx.member.findMany({
        where: participantWhere(meeting.kind, { includeNonVoting: true }),
        select: { id: true, membershipType: { select: { votingRight: true } } },
      });
      const existing = new Set((await tx.attendance.findMany({ where: { meetingId }, select: { memberId: true } })).map((a) => a.memberId));
      const fresh = members.filter((m) => !existing.has(m.id));
      for (const m of fresh) {
        await tx.attendance.create({ data: { meetingId, memberId: m.id, status: "ABWESEND", canVote: meeting.kind === "VORSTANDSSITZUNG" ? true : votingRightOf(m) } });
      }
      added = fresh.length;
      summary = `Anwesenheitsliste zu «${meeting.title}» erstellt (${added} ${added === 1 ? "Person" : "Personen"} ergänzt)`;
    } else if (input.action === "add") {
      const member = await tx.member.findFirst({ where: { id: input.memberId, anonymizedAt: null }, select: { id: true, membershipType: { select: { votingRight: true } } } });
      if (!member) notFound("Mitglied");
      const exists = await tx.attendance.findUnique({ where: { meetingId_memberId: { meetingId, memberId: input.memberId } } });
      if (exists) conflict("CONFLICT", "Diese Person steht bereits auf der Liste.");
      await tx.attendance.create({ data: { meetingId, memberId: input.memberId, status: "ABWESEND", canVote: meeting.kind === "VORSTANDSSITZUNG" ? true : votingRightOf(member!) } });
      added = 1;
      summary = `Person zur Anwesenheitsliste von «${meeting.title}» hinzugefügt`;
    } else if (input.action === "remove") {
      const res = await tx.attendance.deleteMany({ where: { meetingId, memberId: input.memberId } });
      if (res.count === 0) notFound("Eintrag");
      summary = `Person von der Anwesenheitsliste von «${meeting.title}» entfernt`;
    } else {
      const existing = await tx.attendance.findMany({ where: { meetingId }, select: { memberId: true } });
      const known = new Set(existing.map((e) => e.memberId));
      for (const row of input.rows) {
        if (!known.has(row.memberId)) throw new ApiError(422, "VALIDATION_ERROR", "Ungültige Eingabe.", { rows: "Eine Person steht nicht auf der Liste. Lade die Seite neu." });
      }
      for (const row of input.rows) {
        await tx.attendance.update({
          where: { meetingId_memberId: { meetingId, memberId: row.memberId } },
          data: { status: row.status, canVote: row.canVote, note: row.note },
        });
      }
      const present = input.rows.filter((r) => r.status === "ANWESEND").length;
      summary = `Anwesenheit zu «${meeting.title}» gespeichert (${present} anwesend von ${input.rows.length} erfassten Personen)`;
    }
    await logAudit(tx, { actor: actorOf(admin), action: "meeting.attendance", objectType: "Meeting", objectId: meetingId, summary });
    return { added };
  });
}

// ---- Beschlüsse -----------------------------------------------------------------------------------------------------------

async function assertAgendaItem(tx: Tx, meetingId: string, agendaItemId: string | null | undefined): Promise<void> {
  if (!agendaItemId) return;
  const ok = await tx.agendaItem.count({ where: { id: agendaItemId, meetingId } });
  if (ok === 0) throw new ApiError(422, "VALIDATION_ERROR", "Ungültige Eingabe.", { agendaItemId: "Das Traktandum gehört nicht zu dieser Sitzung." });
}

export async function createResolution(admin: CurrentAdmin, meetingId: string, input: ResolutionInput) {
  // Die Nummer ergibt sich aus dem bisherigen Höchstwert; (Sitzung, Nummer) ist eindeutig. Bei gleichzeitiger Erfassung unterliegt
  // eine Anfrage dem Unique-Index (P2002) und wird mit der nächsten freien Nummer einmal wiederholt.
  for (let attempt = 0; ; attempt += 1) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 25 * attempt));
    try {
      return await db.$transaction(async (tx) => {
        const m = await assertUnlocked(tx, meetingId);
        await assertAgendaItem(tx, meetingId, input.agendaItemId);
        const numbers = (await tx.resolution.findMany({ where: { meetingId }, select: { number: true } })).map((r) => r.number);
        const r = await tx.resolution.create({ data: { meetingId, number: nextResolutionNumber(numbers), ...input } });
        await logAudit(tx, { actor: actorOf(admin), action: "resolution.create", objectType: "Resolution", objectId: r.id, summary: `Beschluss ${r.number} zu «${m.title}» erfasst (${r.result})`, after: { text: r.text, result: r.result, votesYes: r.votesYes, votesNo: r.votesNo, abstentions: r.abstentions } });
        return r;
      });
    } catch (e) {
      // P2002: Nummer schon vergeben; P2034/P1008: gleichzeitige Transaktion (Schreibkonflikt bzw. gesperrte SQLite-Datei)
      if (attempt < 6 && e instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034", "P1008"].includes(e.code)) continue;
      throw e;
    }
  }
}

export async function updateResolution(admin: CurrentAdmin, meetingId: string, resolutionId: string, patch: Partial<ResolutionInput>) {
  return db.$transaction(async (tx) => {
    const m = await assertUnlocked(tx, meetingId);
    const before = await tx.resolution.findFirst({ where: { id: resolutionId, meetingId } });
    if (!before) notFound("Beschluss");
    if (patch.agendaItemId !== undefined) await assertAgendaItem(tx, meetingId, patch.agendaItemId);
    const after = await tx.resolution.update({ where: { id: resolutionId }, data: patch });
    await logAudit(tx, {
      actor: actorOf(admin),
      action: "resolution.update",
      objectType: "Resolution",
      objectId: resolutionId,
      summary: `Beschluss ${after.number} zu «${m.title}» geändert`,
      before: { text: before!.text, result: before!.result, votesYes: before!.votesYes, votesNo: before!.votesNo, abstentions: before!.abstentions },
      after: { text: after.text, result: after.result, votesYes: after.votesYes, votesNo: after.votesNo, abstentions: after.abstentions },
    });
    return after;
  });
}

export async function deleteResolution(admin: CurrentAdmin, meetingId: string, resolutionId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const m = await assertUnlocked(tx, meetingId);
    const r = await tx.resolution.findFirst({ where: { id: resolutionId, meetingId } });
    if (!r) notFound("Beschluss");
    await tx.resolution.delete({ where: { id: resolutionId } });
    const rest = await tx.resolution.findMany({ where: { meetingId }, orderBy: { number: "asc" }, select: { id: true } });
    for (const [index, x] of rest.entries()) await tx.resolution.update({ where: { id: x.id }, data: { number: index + 1 } });
    await logAudit(tx, { actor: actorOf(admin), action: "resolution.delete", objectType: "Resolution", objectId: resolutionId, summary: `Beschluss ${r!.number} zu «${m.title}» gelöscht`, before: { text: r!.text, result: r!.result } });
  });
}

/** Aufgabe aus einem Beschluss: legt eine BoardTask an, verknüpft mit Sitzung und Beschluss (die Aufgaben-Oberfläche gehört dem Modul Aufgaben). */
export async function createTaskFromResolution(admin: CurrentAdmin, meetingId: string, resolutionId: string, input: TaskFromResolutionInput) {
  return db.$transaction(async (tx) => {
    const m = await requireMeeting(tx, meetingId);
    const r = await tx.resolution.findFirst({ where: { id: resolutionId, meetingId } });
    if (!r) notFound("Beschluss");
    if (input.assigneeMemberId) {
      const ok = await tx.member.count({ where: { id: input.assigneeMemberId, anonymizedAt: null } });
      if (ok === 0) throw new ApiError(422, "VALIDATION_ERROR", "Ungültige Eingabe.", { assigneeMemberId: "Das gewählte Mitglied wurde nicht gefunden." });
    }
    const task = await tx.boardTask.create({
      data: {
        title: input.title,
        description: input.description || `Aus Beschluss ${r!.number} der Sitzung «${m.title}» vom ${formatDateCh(m.startsAt)}:\n${r!.text}`,
        assigneeMemberId: input.assigneeMemberId,
        dueDate: input.dueDate,
        priority: input.priority,
        meetingId,
        resolutionId,
        createdByName: admin.name,
      },
    });
    await logAudit(tx, { actor: actorOf(admin), action: "task.create", objectType: "BoardTask", objectId: task.id, summary: `Aufgabe «${task.title}» aus Beschluss ${r!.number} («${m.title}») angelegt` });
    return task;
  });
}

// ---- Protokoll ------------------------------------------------------------------------------------------------------------

export async function saveMinutes(admin: CurrentAdmin, id: string, minutes: string, amendReason: string): Promise<{ locked: boolean; changed: boolean }> {
  return db.$transaction(async (tx) => {
    const m = await requireMeeting(tx, id);
    const locked = isMinutesLocked(m);
    if (m.minutes === minutes) return { locked, changed: false };
    if (locked) {
      if (amendReason.trim().length < 5) throw new ApiError(422, "VALIDATION_ERROR", "Ungültige Eingabe.", { amendReason: "Das Protokoll ist genehmigt. Bitte begründe die Änderung (mindestens 5 Zeichen)." });
      // Der genehmigte Text bleibt im vollen Wortlaut erhalten (das Änderungsprotokoll kürzt lange Texte).
      const old = minutesSnapshot(m.minutes);
      await tx.minutesRevision.create({ data: { meetingId: id, ...old, wasApproved: true, reason: amendReason.trim(), actorName: admin.name } });
      await tx.meeting.update({ where: { id }, data: { minutes, minutesApprovedNote: amendmentNote(m.minutesApprovedNote, todayZurich(), amendReason) } });
      await logAudit(tx, {
        actor: actorOf(admin),
        action: "meeting.minutes.amend",
        objectType: "Meeting",
        objectId: id,
        summary: `Genehmigtes Protokoll «${m.title}» nachträglich geändert: ${amendReason.trim()}`,
        before: { minutesSha256: old.sha256, minutesLength: m.minutes.length },
        after: { minutesSha256: minutesSnapshot(minutes).sha256, minutesLength: minutes.length },
      });
    } else {
      await tx.meeting.update({ where: { id }, data: { minutes } });
    }
    return { locked, changed: true };
  });
}

export async function approveMinutes(admin: CurrentAdmin, id: string, input: { approvedOn: Date; approvedBy: string; note: string }): Promise<void> {
  await db.$transaction(async (tx) => {
    const m = await requireMeeting(tx, id);
    if (m.minutesApprovedAt) conflict("CONFLICT", "Das Protokoll ist bereits genehmigt.");
    if (m.status !== "DURCHGEFUEHRT") conflict("CONFLICT", "Markiere die Sitzung zuerst als durchgeführt. Erst dann lässt sich das Protokoll genehmigen.");
    if (!m.minutes.trim()) conflict("CONFLICT", "Das Protokoll ist leer.");
    const today = todayZurich();
    if (input.approvedOn.getTime() > today.getTime()) throw new ApiError(422, "VALIDATION_ERROR", "Ungültige Eingabe.", { approvedOn: "Das Datum darf nicht in der Zukunft liegen." });
    if (input.approvedOn.getTime() < toDateOnly(m.startsAt).getTime()) throw new ApiError(422, "VALIDATION_ERROR", "Ungültige Eingabe.", { approvedOn: "Die Genehmigung kann nicht vor der Sitzung liegen." });
    const approved = minutesSnapshot(m.minutes);
    await tx.minutesRevision.create({ data: { meetingId: id, ...approved, wasApproved: true, reason: "Genehmigung", actorName: admin.name } });
    await tx.meeting.update({ where: { id }, data: { minutesApprovedAt: input.approvedOn, minutesApprovedBy: input.approvedBy, minutesApprovedNote: input.note } });
    await logAudit(tx, {
      actor: actorOf(admin),
      action: "meeting.minutes.approve",
      objectType: "Meeting",
      objectId: id,
      summary: `Protokoll «${m.title}» genehmigt (${formatDateCh(input.approvedOn)}, ${input.approvedBy})`,
      after: { minutesApprovedAt: input.approvedOn, minutesApprovedBy: input.approvedBy, minutesSha256: approved.sha256 },
    });
  });
}

export async function unapproveMinutes(admin: CurrentAdmin, id: string, reason: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const m = await requireMeeting(tx, id);
    if (!m.minutesApprovedAt) conflict("CONFLICT", "Das Protokoll ist nicht genehmigt.");
    await tx.meeting.update({
      where: { id },
      data: { minutesApprovedAt: null, minutesApprovedBy: "", minutesApprovedNote: amendmentNote(m.minutesApprovedNote, todayZurich(), `Genehmigung aufgehoben (${reason})`) },
    });
    await logAudit(tx, {
      actor: actorOf(admin),
      action: "meeting.minutes.unapprove",
      objectType: "Meeting",
      objectId: id,
      summary: `Genehmigung des Protokolls «${m.title}» aufgehoben: ${reason.trim()}`,
      before: { minutesApprovedAt: m.minutesApprovedAt, minutesApprovedBy: m.minutesApprovedBy },
    });
  });
}

// ---- Einladung ------------------------------------------------------------------------------------------------------------

const rsvpSecret = () => createHash("sha256").update(`vgs-meeting-rsvp-v1:${authSecretString()}`).digest("hex");
export const rsvpTokenFor = (meetingId: string, memberId: string): string => signRsvpToken(rsvpSecret(), meetingId, memberId);
/** Liest einen Antwort-Link: Sitzung und Mitglied oder null (ungültig). */
export const readRsvpToken = (token: string): { meetingId: string; memberId: string } | null => verifyRsvpToken(rsvpSecret(), token);

export type Recipient = {
  memberId: string;
  name: string;
  email: string;
  channel: "EMAIL" | "POST" | "KEINE_ADRESSE" | "UNGUELTIG";
  canVote: boolean;
  rsvp: "" | Rsvp;
};

/** Empfänger einer Einladung: Versammlung = aktive Stimmberechtigte (optional alle aktiven), Vorstandssitzung = aktive Amtsträger. */
export async function invitationRecipients(meeting: { id: string; kind: string }, opts: { includeNonVoting?: boolean } = {}): Promise<Recipient[]> {
  const members = await db.member.findMany({
    where: participantWhere(meeting.kind, { includeNonVoting: Boolean(opts.includeNonVoting) }),
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 2000,
    select: {
      id: true,
      memberNumber: true,
      firstName: true,
      lastName: true,
      email: true,
      communicationPref: true,
      anonymizedAt: true,
      membershipType: { select: { votingRight: true } },
      attendances: { where: { meetingId: meeting.id }, select: { rsvp: true } },
    },
  });
  return members.map((m) => {
    const email = m.email.trim();
    const channel: Recipient["channel"] = m.communicationPref === "POST" ? "POST" : !email ? "KEINE_ADRESSE" : emailSchema.safeParse(email).success ? "EMAIL" : "UNGUELTIG";
    const rsvp = m.attendances[0]?.rsvp;
    return {
      memberId: m.id,
      name: memberName(m),
      email,
      channel,
      canVote: votingRightOf(m),
      rsvp: rsvp === "ZUSAGE" || rsvp === "ABSAGE" ? rsvp : "",
    };
  });
}

export type MailBatch = { batchId: string; kind: string; sentAt: Date; sentByName: string; total: number; ok: number; failed: number; late: boolean; errors: Array<{ name: string; error: string }> };

export async function listMailBatches(meetingId: string): Promise<MailBatch[]> {
  const rows = await db.meetingMail.findMany({ where: { meetingId }, orderBy: { sentAt: "desc" }, take: 2000 });
  const map = new Map<string, MailBatch>();
  for (const r of rows) {
    const b = map.get(r.batchId) ?? { batchId: r.batchId, kind: r.kind, sentAt: r.sentAt, sentByName: r.sentByName, total: 0, ok: 0, failed: 0, late: false, errors: [] };
    b.total += 1;
    if (r.ok) b.ok += 1;
    else {
      b.failed += 1;
      b.errors.push({ name: r.recipientName, error: r.error });
    }
    if (r.late) b.late = true;
    if (r.sentAt < b.sentAt) b.sentAt = r.sentAt;
    map.set(r.batchId, b);
  }
  return [...map.values()].sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());
}

export type InvitationOverview = {
  timing: InvitationTiming;
  /** Nur bei Versammlungen nötig: Einladungsfrist fehlt in den Einstellungen */
  blockedByMissingSetting: boolean;
  invitationDays: number | null;
  recipients: Recipient[];
  batches: MailBatch[];
  /** Personen, die diese Art Mail schon erhalten haben */
  alreadyInvited: string[];
  /** erster Versand rechtzeitig? null: nicht beurteilbar */
  firstSentOnTime: boolean | null;
};

export async function invitationOverview(meeting: { id: string; kind: string; startsAt: Date; invitationSentAt: Date | null }, opts: { includeNonVoting?: boolean } = {}): Promise<InvitationOverview> {
  const settings = await getVereinSettings();
  const [recipients, batches, sent] = await Promise.all([
    invitationRecipients(meeting, opts),
    listMailBatches(meeting.id),
    db.meetingMail.findMany({ where: { meetingId: meeting.id, kind: "EINLADUNG", ok: true }, select: { memberId: true } }),
  ]);
  const board = meeting.kind === "VORSTANDSSITZUNG";
  const minDays = board ? null : settings.invitationDays;
  return {
    timing: invitationTiming({ start: meeting.startsAt, minDays }),
    blockedByMissingSetting: !board && missingForInvitations(settings).length > 0,
    invitationDays: settings.invitationDays,
    recipients,
    batches,
    alreadyInvited: [...new Set(sent.map((s) => s.memberId))],
    firstSentOnTime: meeting.invitationSentAt ? wasSentOnTime(meeting.invitationSentAt, meeting.startsAt, minDays) : null,
  };
}

const MAX_RECIPIENTS_PER_SEND = 200;

export type SendReport = { batchId: string; sent: number; failed: number; skipped: number; remaining: number; testOnly: boolean; late: boolean };

export async function sendInvitations(admin: CurrentAdmin, meetingId: string, input: InvitationSendInput): Promise<SendReport> {
  const meeting = await getMeetingDetail(meetingId);
  if (!meeting) notFound();
  const m = meeting!;
  if (m.status === "ABGESAGT" || m.status === "DURCHGEFUEHRT") conflict("CONFLICT", "Für abgesagte oder durchgeführte Sitzungen lassen sich keine Einladungen versenden.");
  if (m.startsAt.getTime() <= Date.now()) conflict("CONFLICT", "Die Sitzung hat bereits begonnen.");

  const settings = await getVereinSettings();
  const board = m.kind === "VORSTANDSSITZUNG";
  const mailKind: MailKind = input.kind;
  const minDays = board ? null : settings.invitationDays;

  if (mailKind === "EINLADUNG" && !board && missingForInvitations(settings).length > 0) {
    conflict("SETTINGS_MISSING", "Die Einladungsfrist gemäss Statuten fehlt in den Vereinseinstellungen. Trage sie ein, damit die Frist geprüft werden kann.");
  }
  const timing = invitationTiming({ start: m.startsAt, minDays });
  const late = mailKind === "EINLADUNG" && timing.state === "late";
  if (late && !input.acknowledgeLate && !input.testOnly) {
    conflict("INVITATION_LATE", `${timing.text} Bestätige, dass du die Einladung trotzdem versenden willst.`);
  }

  const agendaTitles = m.agenda.map((a) => a.title);
  const mailMeeting = { kind: m.kind, title: m.title, startsAt: m.startsAt, endsAt: m.endsAt, location: m.location, invitationText: m.invitationText };

  if (input.testOnly) {
    const res = await sendMeetingMail({ mailKind, meeting: mailMeeting, agendaTitles, to: admin.email, recipientName: admin.name, settings });
    if (!res.ok) throw new ApiError(502, "MAIL_FAILED", `Die Testmail konnte nicht versendet werden: ${res.error}`);
    return { batchId: "", sent: 1, failed: 0, skipped: 0, remaining: 0, testOnly: true, late };
  }

  const all = await invitationRecipients(m, { includeNonVoting: input.includeNonVoting });
  const already = new Set(
    (await db.meetingMail.findMany({ where: { meetingId, kind: mailKind, ok: true }, select: { memberId: true } })).map((r) => r.memberId),
  );
  let targets = all.filter((r) => r.channel === "EMAIL");
  if (mailKind === "ERINNERUNG") targets = targets.filter((r) => r.rsvp === "");
  if (input.mode === "MISSING") targets = targets.filter((r) => !already.has(r.memberId));
  const skipped = all.length - targets.length;
  if (targets.length === 0) conflict("NO_RECIPIENTS", "Es gibt keine Empfänger für diesen Versand.");
  // Pro Versand höchstens so viele Mails; der Rest geht mit «An noch nicht Eingeladene» bzw. einer weiteren Erinnerung hinaus.
  const remaining = Math.max(0, targets.length - MAX_RECIPIENTS_PER_SEND);
  targets = targets.slice(0, MAX_RECIPIENTS_PER_SEND);

  const batchId = randomUUID();
  const log: Prisma.MeetingMailCreateManyInput[] = [];
  let sent = 0;
  for (const r of targets) {
    const res = await sendMeetingMail({
      mailKind,
      meeting: mailMeeting,
      agendaTitles,
      to: r.email,
      recipientName: r.name,
      settings,
      rsvpUrl: rsvpPageUrl(rsvpTokenFor(m.id, r.memberId)),
    });
    if (res.ok) sent += 1;
    log.push({ meetingId, batchId, kind: mailKind, memberId: r.memberId, recipientName: r.name, email: r.email, ok: res.ok, error: res.ok ? "" : res.error.slice(0, 300), late, sentByName: admin.name });
  }
  const failed = targets.length - sent;

  await db.$transaction(async (tx) => {
    await tx.meetingMail.createMany({ data: log });
    if (mailKind === "EINLADUNG" && sent > 0) {
      const distinct = await tx.meetingMail.findMany({ where: { meetingId, kind: "EINLADUNG", ok: true }, select: { memberId: true }, distinct: ["memberId"] });
      await tx.meeting.update({
        where: { id: meetingId },
        data: { invitationCount: distinct.length, invitationSentAt: m.invitationSentAt ?? new Date(), ...(m.status === "GEPLANT" ? { status: "EINGELADEN" } : {}) },
      });
    }
    await logAudit(tx, {
      actor: actorOf(admin),
      action: mailKind === "EINLADUNG" ? "meeting.invite" : "meeting.remind",
      objectType: "Meeting",
      objectId: meetingId,
      summary: `${mailKind === "EINLADUNG" ? "Einladung" : "Erinnerung"} zu «${m.title}» versendet: ${sent} zugestellt, ${failed} fehlgeschlagen${late ? ", Einladungsfrist unterschritten" : ""}`,
      after: { versendet: sent, fehlgeschlagen: failed, uebersprungen: skipped, fristUnterschritten: late },
    });
  });
  return { batchId, sent, failed, skipped, remaining, testOnly: false, late };
}

async function notifyCancellation(admin: CurrentAdmin, m: { id: string; kind: string; title: string; startsAt: Date; endsAt: Date | null; location: string; invitationText: string }, reason: string) {
  const settings = await getVereinSettings();
  const invited = await db.meetingMail.findMany({ where: { meetingId: m.id, kind: "EINLADUNG", ok: true }, distinct: ["memberId"], select: { memberId: true, recipientName: true, email: true } });
  const batchId = randomUUID();
  const log: Prisma.MeetingMailCreateManyInput[] = [];
  let sent = 0;
  for (const r of invited) {
    if (!emailSchema.safeParse(r.email).success) continue;
    const res = await sendMeetingMail({ mailKind: "ABSAGE", meeting: m, agendaTitles: [], to: r.email, recipientName: r.recipientName, settings, reason });
    if (res.ok) sent += 1;
    log.push({ meetingId: m.id, batchId, kind: "ABSAGE", memberId: r.memberId, recipientName: r.recipientName, email: r.email, ok: res.ok, error: res.ok ? "" : res.error.slice(0, 300), sentByName: admin.name });
  }
  if (log.length > 0) await db.meetingMail.createMany({ data: log });
  return { sent, failed: log.length - sent };
}

// ---- Rückmeldung (Portal und Link) ----------------------------------------------------------------------------------------

export type RsvpState = { rsvp: "" | Rsvp; rsvpAt: Date | null };

/**
 * Speichert die Rückmeldung eines Mitglieds. Gilt nur für eingeladene, noch nicht begonnene Sitzungen und nur für Personen, die zur
 * Sitzung gehören (Versammlung: aktive Mitglieder; Vorstandssitzung: aktive Amtsträger). `memberId` stammt aus der Sitzung bzw. dem
 * signierten Link, nie aus freien Eingaben.
 */
export async function saveRsvp(memberId: string, meetingId: string, input: { status: Rsvp; note: string }): Promise<RsvpState> {
  const meeting = await db.meeting.findUnique({ where: { id: meetingId }, select: { id: true, kind: true, status: true, startsAt: true } });
  if (!meeting || meeting.status !== "EINGELADEN" || meeting.startsAt.getTime() <= Date.now()) {
    throw new ApiError(409, "NOT_OPEN", "Für diese Sitzung ist keine Rückmeldung (mehr) möglich.");
  }
  const member = await db.member.findFirst({
    where: { id: memberId, ...participantWhere(meeting.kind, { includeNonVoting: true }) },
    select: { id: true, membershipType: { select: { votingRight: true } } },
  });
  if (!member) throw new ApiError(403, "FORBIDDEN", "Du gehörst nicht zu dieser Sitzung.");
  const now = new Date();
  const existing = await db.attendance.findUnique({ where: { meetingId_memberId: { meetingId, memberId } } });
  if (existing) {
    const keepStatus = existing.status === "ANWESEND" && input.status === "ZUSAGE";
    const status = keepStatus ? existing.status : input.status === "ABSAGE" ? "ENTSCHULDIGT" : existing.status === "ENTSCHULDIGT" ? "ABWESEND" : existing.status;
    await db.attendance.update({ where: { id: existing.id }, data: { rsvp: input.status, rsvpAt: now, status, ...(input.note ? { note: input.note } : {}) } });
  } else {
    await db.attendance.create({
      data: { meetingId, memberId, rsvp: input.status, rsvpAt: now, status: input.status === "ABSAGE" ? "ENTSCHULDIGT" : "ABWESEND", canVote: meeting.kind === "VORSTANDSSITZUNG" ? true : votingRightOf(member), note: input.note },
    });
  }
  return { rsvp: input.status, rsvpAt: now };
}

/** Kontext für die Antwortseite per Link (ohne Anmeldung): Sitzung, Vorname und bisherige Antwort. null, wenn der Link nicht mehr passt. */
export async function getRsvpContext(meetingId: string, memberId: string) {
  const meeting = await db.meeting.findUnique({
    where: { id: meetingId },
    select: {
      id: true, kind: true, title: true, startsAt: true, endsAt: true, location: true, status: true, invitationText: true,
      agenda: { orderBy: { position: "asc" }, select: { id: true, title: true } },
    },
  });
  if (!meeting) return null;
  const member = await db.member.findFirst({ where: { id: memberId, ...participantWhere(meeting.kind, { includeNonVoting: true }) }, select: { id: true, firstName: true } });
  if (!member) return null;
  const att = await db.attendance.findUnique({ where: { meetingId_memberId: { meetingId, memberId } }, select: { rsvp: true, rsvpAt: true } });
  const open = meeting.status === "EINGELADEN" && meeting.startsAt.getTime() > Date.now();
  return { meeting, firstName: member.firstName, rsvp: (att?.rsvp === "ZUSAGE" || att?.rsvp === "ABSAGE" ? att.rsvp : "") as "" | Rsvp, open };
}

// ---- Beschlussregister ----------------------------------------------------------------------------------------------------

export type RegisterFilters = { q: string; result: string; kind: string; year: string };

export function parseRegisterFilters(source: ParamSource): RegisterFilters {
  const result = firstParam(source, "result");
  const kind = firstParam(source, "kind");
  const year = firstParam(source, "year");
  return {
    q: firstParam(source, "q").trim().slice(0, 100),
    result: (RESOLUTION_RESULTS as readonly string[]).includes(result) ? result : "",
    kind: (MEETING_KINDS as readonly string[]).includes(kind) ? kind : "",
    year: /^\d{4}$/.test(year) ? year : "",
  };
}

export function registerWhere(f: RegisterFilters): Prisma.ResolutionWhereInput {
  const and: Prisma.ResolutionWhereInput[] = [];
  if (f.q) {
    const words = f.q.split(/\s+/).filter(Boolean).slice(0, 5);
    for (const w of words) {
      and.push({ OR: [{ text: { contains: w } }, { recusal: { contains: w } }, { meeting: { title: { contains: w } } }, { agendaItem: { title: { contains: w } } }] });
    }
  }
  if (f.result) and.push({ result: f.result });
  const meeting: Prisma.MeetingWhereInput = {};
  if (f.kind) meeting.kind = f.kind;
  if (f.year) meeting.startsAt = { gte: zurichToDate(Number(f.year), 1, 1), lt: zurichToDate(Number(f.year) + 1, 1, 1) };
  if (Object.keys(meeting).length) and.push({ meeting });
  return and.length ? { AND: and } : {};
}

const registerSelect = {
  id: true,
  number: true,
  text: true,
  votesYes: true,
  votesNo: true,
  abstentions: true,
  majority: true,
  result: true,
  recusal: true,
  meeting: { select: { id: true, kind: true, title: true, startsAt: true } },
  agendaItem: { select: { title: true } },
  _count: { select: { tasks: true } },
} satisfies Prisma.ResolutionSelect;
export type RegisterEntry = Prisma.ResolutionGetPayload<{ select: typeof registerSelect }>;

export async function listRegister(filters: RegisterFilters, skip: number, take: number): Promise<{ rows: RegisterEntry[]; total: number }> {
  const where = registerWhere(filters);
  const [rows, total] = await Promise.all([
    db.resolution.findMany({ where, orderBy: [{ meeting: { startsAt: "desc" } }, { number: "asc" }], skip, take: Math.min(take, MAX_PAGE_SIZE), select: registerSelect }),
    db.resolution.count({ where }),
  ]);
  return { rows, total };
}

export async function registerForExport(filters: RegisterFilters): Promise<RegisterRow[]> {
  const rows = await db.resolution.findMany({ where: registerWhere(filters), orderBy: [{ meeting: { startsAt: "desc" } }, { number: "asc" }], take: 20_000, select: registerSelect });
  return rows.map((r) => ({
    meetingStart: r.meeting.startsAt,
    meetingTitle: r.meeting.title,
    meetingKind: r.meeting.kind,
    number: r.number,
    agendaTitle: r.agendaItem?.title ?? "",
    text: r.text,
    votesYes: r.votesYes,
    votesNo: r.votesNo,
    abstentions: r.abstentions,
    majority: r.majority,
    result: r.result,
    recusal: r.recusal,
  }));
}

export async function registerYears(): Promise<number[]> {
  const rows = await db.meeting.findMany({ where: { resolutions: { some: {} } }, select: { startsAt: true } });
  return [...new Set(rows.map((r) => yearOf(r.startsAt)))].sort((a, b) => b - a);
}

// ---- Portal ---------------------------------------------------------------------------------------------------------------

const portalListSelect = {
  id: true,
  kind: true,
  title: true,
  startsAt: true,
  endsAt: true,
  location: true,
  status: true,
  minutesApprovedAt: true,
} satisfies Prisma.MeetingSelect;

/** Kommende Einladungen (mit eigener Rückmeldung) und Versammlungen mit genehmigtem Protokoll. Nur Versammlungen der Mitglieder, nie Vorstandssitzungen. */
export async function listPortalMeetings(memberId: string) {
  const day = startOfDayZurich(new Date());
  const [upcoming, past] = await Promise.all([
    db.meeting.findMany({
      where: { kind: { in: [...ASSEMBLY_KINDS] }, startsAt: { gte: day }, OR: [{ status: "EINGELADEN" }, { status: "ABGESAGT", invitationSentAt: { not: null } }] },
      orderBy: { startsAt: "asc" },
      take: 20,
      select: { ...portalListSelect, attendances: { where: { memberId }, select: { rsvp: true, rsvpAt: true } } },
    }),
    db.meeting.findMany({
      where: { kind: { in: [...ASSEMBLY_KINDS] }, status: "DURCHGEFUEHRT", minutesApprovedAt: { not: null } },
      orderBy: { startsAt: "desc" },
      take: 50,
      select: portalListSelect,
    }),
  ]);
  return { upcoming, past };
}

/** Eine Versammlung für das Portal. Protokoll und Beschlüsse nur, wenn das Protokoll genehmigt ist. */
export async function getPortalMeeting(memberId: string, id: string) {
  const m = await db.meeting.findFirst({
    where: { id, kind: { in: [...ASSEMBLY_KINDS] }, OR: [{ status: { in: [...PORTAL_MEETING_STATUSES] } }, { status: "ABGESAGT", invitationSentAt: { not: null } }] },
    select: {
      ...portalListSelect,
      invitationText: true,
      minutes: true,
      minutesApprovedBy: true,
      updatedAt: true,
      agenda: { orderBy: { position: "asc" }, select: { id: true, title: true, description: true, motion: true } },
      resolutions: { orderBy: { number: "asc" }, select: { id: true, number: true, text: true, votesYes: true, votesNo: true, abstentions: true, result: true, recusal: true, agendaItemId: true } },
      attendances: { where: { memberId }, select: { rsvp: true, rsvpAt: true } },
    },
  });
  if (!m) return null;
  const approved = m.minutesApprovedAt !== null;
  return { ...m, minutes: approved ? m.minutes : "", resolutions: approved ? m.resolutions : [], minutesApprovedBy: approved ? m.minutesApprovedBy : "" };
}
export type PortalMeeting = NonNullable<Awaited<ReturnType<typeof getPortalMeeting>>>;

/** Kalendereintrag: nur Versammlungen, zu denen eingeladen wurde. */
export async function getMeetingForIcs(id: string, opts: { assemblyOnly: boolean }) {
  const where: Prisma.MeetingWhereInput = opts.assemblyOnly
    ? { id, kind: { in: [...ASSEMBLY_KINDS] }, OR: [{ status: "EINGELADEN" }, { status: "ABGESAGT", invitationSentAt: { not: null } }] }
    : { id, status: { in: ["GEPLANT", "EINGELADEN", "ABGESAGT"] } };
  return db.meeting.findFirst({
    where,
    select: { id: true, kind: true, title: true, startsAt: true, endsAt: true, location: true, status: true, updatedAt: true, agenda: { orderBy: { position: "asc" }, select: { title: true } } },
  });
}
