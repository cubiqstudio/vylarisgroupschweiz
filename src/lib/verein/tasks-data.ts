// Datenzugriff des Moduls Aufgaben (Vorstand), nur auf dem Server: Liste/Board, Anlegen, Ändern, Löschen, Kommentare, Erinnerung per Mail.
// Anlegen, Statuswechsel und Löschen schreiben in derselben Transaktion einen Eintrag ins Änderungsprotokoll.
import "server-only";
import type { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api";
import type { CurrentAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { auditActor, diffForAudit, logAudit } from "./audit";
import { TASK_STATUS_LABEL, type TaskStatus } from "./constants";
import { todayZurich } from "./dates";
import { firstParam, searchWhere } from "./pagination";
import { canRemind, decodeAssignee, doneAtFor, encodeAssignee, normalizeStatus } from "./tasks-lib";
import { sendTaskReminder } from "./tasks-mail";
import type { TaskCreateInput, TaskFilters, TaskPatchInput } from "./tasks-schemas";
import { getVereinSettings } from "./settings";

type Tx = Prisma.TransactionClient;
type ParamSource = URLSearchParams | Record<string, string | string[] | undefined>;

const notFound = (what = "Aufgabe"): never => {
  throw new ApiError(404, "NOT_FOUND", `${what} nicht gefunden.`);
};
const invalid = (field: string, message: string): never => {
  throw new ApiError(422, "VALIDATION_ERROR", "Ungültige Eingabe.", { [field]: message });
};

const taskSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  dueDate: true,
  doneAt: true,
  lastReminderAt: true,
  createdAt: true,
  createdByName: true,
  assigneeAdminId: true,
  assigneeMemberId: true,
  assigneeAdmin: { select: { id: true, name: true } },
  assigneeMember: { select: { id: true, firstName: true, lastName: true, anonymizedAt: true } },
  meetingId: true,
  meeting: { select: { id: true, title: true, startsAt: true } },
  resolutionId: true,
  resolution: { select: { id: true, number: true, text: true, meetingId: true } },
  _count: { select: { comments: true } },
} satisfies Prisma.BoardTaskSelect;

export type TaskRow = Prisma.BoardTaskGetPayload<{ select: typeof taskSelect }>;

/** Anzeigename der verantwortlichen Person («» = niemand). */
export function assigneeName(t: Pick<TaskRow, "assigneeAdmin" | "assigneeMember">): string {
  if (t.assigneeAdmin) return t.assigneeAdmin.name;
  if (t.assigneeMember) return t.assigneeMember.anonymizedAt ? "Ehemaliges Mitglied" : `${t.assigneeMember.firstName} ${t.assigneeMember.lastName}`.trim();
  return "";
}

/** Filter der Aufgabenseite aus den Query-Parametern. */
export function parseTaskFilters(source: ParamSource): TaskFilters {
  const priority = firstParam(source, "priority");
  return {
    q: firstParam(source, "q").trim().slice(0, 100),
    mine: firstParam(source, "mine") === "1",
    priority: priority === "NIEDRIG" || priority === "NORMAL" || priority === "HOCH" ? priority : "",
    assignee: decodeAssignee(firstParam(source, "assignee")) ? firstParam(source, "assignee").trim() : "",
    hideDone: firstParam(source, "hideDone") === "1",
  };
}

const DONE_LIMIT = 30;
const OPEN_LIMIT = 500;

function filterWhere(f: TaskFilters, me: { adminId: string; memberId: string | null }): Prisma.BoardTaskWhereInput {
  const and: Prisma.BoardTaskWhereInput[] = [];
  if (f.q) and.push(searchWhere(f.q, ["title", "description"]));
  if (f.priority) and.push({ priority: f.priority });
  if (f.mine) and.push({ OR: [{ assigneeAdminId: me.adminId }, ...(me.memberId ? [{ assigneeMemberId: me.memberId }] : [])] });
  const a = decodeAssignee(f.assignee);
  if (a) and.push(a.kind === "admin" ? { assigneeAdminId: a.id } : { assigneeMemberId: a.id });
  return and.length ? { AND: and } : {};
}

/** Aufgaben für das Board: alle offenen und in Arbeit, dazu die zuletzt erledigten (begrenzt). */
export async function listTasks(f: TaskFilters, me: { adminId: string; memberId: string | null }) {
  const where = filterWhere(f, me);
  const [open, done, doneTotal] = await Promise.all([
    db.boardTask.findMany({ where: { ...where, status: { not: "ERLEDIGT" } }, take: OPEN_LIMIT, select: taskSelect }),
    f.hideDone ? Promise.resolve([] as TaskRow[]) : db.boardTask.findMany({ where: { ...where, status: "ERLEDIGT" }, orderBy: [{ doneAt: "desc" }, { updatedAt: "desc" }], take: DONE_LIMIT, select: taskSelect }),
    db.boardTask.count({ where: { ...where, status: "ERLEDIGT" } }),
  ]);
  return { tasks: [...open, ...done], doneTotal, doneShown: done.length };
}

export async function taskCounts() {
  const now = todayZurich();
  const [open, inWork, overdue] = await Promise.all([
    db.boardTask.count({ where: { status: "OFFEN" } }),
    db.boardTask.count({ where: { status: "IN_ARBEIT" } }),
    db.boardTask.count({ where: { status: { not: "ERLEDIGT" }, dueDate: { lt: now } } }),
  ]);
  return { open, inWork, overdue };
}

export type AssigneeOption = { value: string; label: string; group: "Verwaltung" | "Vorstand" };
export type MeetingOption = { id: string; title: string; startsAt: Date };
export type ResolutionOption = { id: string; meetingId: string; number: number; text: string };

/** Auswahllisten für das Formular: Verantwortliche (Admin-Konten und Mitglieder mit laufendem Amt), Sitzungen und Beschlüsse. */
export async function listTaskOptions(): Promise<{ assignees: AssigneeOption[]; meetings: MeetingOption[]; resolutions: ResolutionOption[] }> {
  const today = todayZurich();
  const [admins, offices, meetings] = await Promise.all([
    db.adminUser.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, memberId: true } }),
    db.office.findMany({
      where: { validFrom: { lte: today }, OR: [{ validUntil: null }, { validUntil: { gte: today } }], member: { anonymizedAt: null } },
      select: { member: { select: { id: true, firstName: true, lastName: true } } },
    }),
    db.meeting.findMany({ orderBy: { startsAt: "desc" }, take: 40, select: { id: true, title: true, startsAt: true } }),
  ]);
  const adminMemberIds = new Set(admins.map((a) => a.memberId).filter((v): v is string => Boolean(v)));
  const seen = new Set<string>();
  const assignees: AssigneeOption[] = admins.map((a) => ({ value: encodeAssignee(a.id, null), label: a.name, group: "Verwaltung" as const }));
  for (const o of offices) {
    if (adminMemberIds.has(o.member.id) || seen.has(o.member.id)) continue;
    seen.add(o.member.id);
    assignees.push({ value: encodeAssignee(null, o.member.id), label: `${o.member.firstName} ${o.member.lastName}`.trim(), group: "Vorstand" });
  }
  const resolutions = meetings.length
    ? await db.resolution.findMany({
        where: { meetingId: { in: meetings.map((m) => m.id) } },
        orderBy: [{ createdAt: "desc" }],
        take: 200,
        select: { id: true, meetingId: true, number: true, text: true },
      })
    : [];
  return { assignees, meetings, resolutions: resolutions.map((r) => ({ ...r, text: r.text.slice(0, 120) })) };
}

/** Eine Aufgabe mit allen Kommentaren (neueste zuletzt). */
export async function getTask(id: string) {
  return db.boardTask.findUnique({
    where: { id },
    select: { ...taskSelect, comments: { orderBy: { createdAt: "asc" }, select: { id: true, body: true, authorName: true, createdAt: true } } },
  });
}

// ---- Prüfungen ----------------------------------------------------------------------------------------------------

type Refs = { assigneeAdminId?: string | null; assigneeMemberId?: string | null; meetingId?: string | null; resolutionId?: string | null };

/** Prüft Verantwortliche, Sitzung und Beschluss; ein Beschluss bestimmt die Sitzung mit (muss zur gewählten Sitzung passen). */
async function resolveRefs(tx: Tx, r: Refs): Promise<{ meetingId: string | null; resolutionId: string | null }> {
  if (r.assigneeAdminId && (await tx.adminUser.count({ where: { id: r.assigneeAdminId } })) === 0) invalid("assignee", "Die gewählte Person wurde nicht gefunden.");
  if (r.assigneeMemberId && (await tx.member.count({ where: { id: r.assigneeMemberId, anonymizedAt: null } })) === 0) invalid("assignee", "Die gewählte Person wurde nicht gefunden.");
  let meetingId = r.meetingId ?? null;
  const resolutionId = r.resolutionId ?? null;
  if (resolutionId) {
    const res = await tx.resolution.findUnique({ where: { id: resolutionId }, select: { meetingId: true } });
    if (!res) invalid("resolutionId", "Der gewählte Beschluss wurde nicht gefunden.");
    if (meetingId && res && res.meetingId !== meetingId) invalid("resolutionId", "Der Beschluss gehört zu einer anderen Sitzung.");
    meetingId = res?.meetingId ?? meetingId;
  }
  if (meetingId && (await tx.meeting.count({ where: { id: meetingId } })) === 0) invalid("meetingId", "Die gewählte Sitzung wurde nicht gefunden.");
  return { meetingId, resolutionId };
}

// ---- Änderungen ---------------------------------------------------------------------------------------------------

export async function createTask(admin: CurrentAdmin, input: TaskCreateInput) {
  return db.$transaction(async (tx) => {
    const refs = await resolveRefs(tx, { ...input.assignee, meetingId: input.meetingId, resolutionId: input.resolutionId });
    const task = await tx.boardTask.create({
      data: {
        title: input.title,
        description: input.description,
        assigneeAdminId: input.assignee.assigneeAdminId,
        assigneeMemberId: input.assignee.assigneeMemberId,
        dueDate: input.dueDate,
        status: input.status,
        priority: input.priority,
        doneAt: input.status === "ERLEDIGT" ? new Date() : null,
        meetingId: refs.meetingId,
        resolutionId: refs.resolutionId,
        createdByName: admin.name,
      },
      select: { id: true, title: true },
    });
    await logAudit(tx, { actor: auditActor(admin), action: "task.create", objectType: "BoardTask", objectId: task.id, summary: `Aufgabe «${task.title}» angelegt` });
    return task;
  });
}

export async function updateTask(admin: CurrentAdmin, id: string, patch: TaskPatchInput) {
  return db.$transaction(async (tx) => {
    const before = await tx.boardTask.findUnique({
      where: { id },
      select: { title: true, description: true, status: true, priority: true, dueDate: true, doneAt: true, assigneeAdminId: true, assigneeMemberId: true, meetingId: true, resolutionId: true },
    });
    if (!before) return notFound();
    const { assignee, ...rest } = patch;
    const data: Prisma.BoardTaskUncheckedUpdateInput = { ...rest };
    if (assignee) {
      data.assigneeAdminId = assignee.assigneeAdminId;
      data.assigneeMemberId = assignee.assigneeMemberId;
    }
    // Verweise nur prüfen, wenn sie sich ändern; ein Beschluss ohne gewählte Sitzung setzt die Sitzung mit.
    if (assignee || patch.meetingId !== undefined || patch.resolutionId !== undefined) {
      const refs = await resolveRefs(tx, {
        assigneeAdminId: assignee ? assignee.assigneeAdminId : null,
        assigneeMemberId: assignee ? assignee.assigneeMemberId : null,
        meetingId: patch.meetingId !== undefined ? patch.meetingId : before.meetingId,
        resolutionId: patch.resolutionId !== undefined ? patch.resolutionId : before.resolutionId,
      });
      data.meetingId = refs.meetingId;
      data.resolutionId = refs.resolutionId;
    }
    let statusChanged = false;
    if (patch.status !== undefined) {
      statusChanged = normalizeStatus(before.status) !== patch.status;
      data.doneAt = doneAtFor(patch.status, before.status, before.doneAt);
    }
    const after = await tx.boardTask.update({
      where: { id },
      data,
      select: { title: true, description: true, status: true, priority: true, dueDate: true, doneAt: true, assigneeAdminId: true, assigneeMemberId: true, meetingId: true, resolutionId: true },
    });
    const diff = diffForAudit(before, after);
    if (Object.keys(diff.after).length > 0 || Object.keys(diff.before).length > 0) {
      await logAudit(tx, {
        actor: auditActor(admin),
        action: statusChanged ? "task.status" : "task.update",
        objectType: "BoardTask",
        objectId: id,
        summary: statusChanged ? `Aufgabe «${after.title}»: ${TASK_STATUS_LABEL[normalizeStatus(before.status)]} → ${TASK_STATUS_LABEL[normalizeStatus(after.status)]}` : `Aufgabe «${after.title}» geändert`,
        ...diff,
      });
    }
    return { id, status: after.status as TaskStatus };
  });
}

export async function deleteTask(admin: CurrentAdmin, id: string) {
  return db.$transaction(async (tx) => {
    const t = await tx.boardTask.findUnique({ where: { id }, select: { id: true, title: true, status: true } });
    if (!t) return notFound();
    await tx.boardTask.delete({ where: { id } });
    await logAudit(tx, { actor: auditActor(admin), action: "task.delete", objectType: "BoardTask", objectId: id, summary: `Aufgabe «${t.title}» gelöscht`, before: { titel: t.title, status: t.status } });
    return { id };
  });
}

export async function addTaskComment(admin: CurrentAdmin, taskId: string, body: string) {
  if ((await db.boardTask.count({ where: { id: taskId } })) === 0) return notFound();
  return db.taskComment.create({
    data: { taskId, body, authorName: admin.name, authorAdminId: admin.id },
    select: { id: true, body: true, authorName: true, createdAt: true },
  });
}

// ---- Erinnerung per Mail -------------------------------------------------------------------------------------------

export type RemindResult = { ok: true; to: string } | { ok: false; error: string };

const remindSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  dueDate: true,
  lastReminderAt: true,
  assigneeAdmin: { select: { name: true, email: true } },
  assigneeMember: { select: { firstName: true, lastName: true, email: true, anonymizedAt: true } },
  meeting: { select: { title: true } },
} satisfies Prisma.BoardTaskSelect;

async function remindOne(admin: CurrentAdmin, id: string, note: string, senderName: string): Promise<RemindResult> {
  const t = await db.boardTask.findUnique({ where: { id }, select: remindSelect });
  if (!t) return { ok: false, error: "Aufgabe nicht gefunden." };
  const can = canRemind(t);
  if (!can.ok) return { ok: false, error: can.reason };
  const recipient = t.assigneeAdmin
    ? { name: t.assigneeAdmin.name, email: t.assigneeAdmin.email, board: true }
    : t.assigneeMember && !t.assigneeMember.anonymizedAt
      ? { name: `${t.assigneeMember.firstName} ${t.assigneeMember.lastName}`.trim(), email: t.assigneeMember.email, board: false }
      : null;
  if (!recipient) return { ok: false, error: "Es ist keine verantwortliche Person mit E-Mail-Adresse zugeteilt." };
  const sent = await sendTaskReminder({
    to: recipient.email,
    recipientName: recipient.name,
    linkToBoard: recipient.board,
    senderName,
    note,
    task: { title: t.title, description: t.description, status: t.status, priority: t.priority, dueDate: t.dueDate, meetingTitle: t.meeting?.title ?? null },
  });
  if (!sent.sent) return { ok: false, error: sent.error };
  await db.$transaction(async (tx) => {
    await tx.boardTask.update({ where: { id }, data: { lastReminderAt: new Date() } });
    await logAudit(tx, { actor: auditActor(admin), action: "task.remind", objectType: "BoardTask", objectId: id, summary: `Erinnerung zur Aufgabe «${t.title}» an ${recipient.name} gesendet` });
  });
  return { ok: true, to: recipient.name };
}

/** Erinnerung an die verantwortliche Person einer Aufgabe. Nicht für erledigte Aufgaben, nicht öfter als einmal pro Sperrfrist. */
export async function remindTask(admin: CurrentAdmin, id: string, note: string): Promise<RemindResult> {
  const s = await getVereinSettings();
  return remindOne(admin, id, note, s.senderName || admin.name);
}

/** Erinnert an alle überfälligen Aufgaben mit Verantwortlichen (höchstens 50 pro Aufruf). */
export async function remindOverdueTasks(admin: CurrentAdmin): Promise<{ sent: number; failed: number; skipped: number; errors: string[] }> {
  const s = await getVereinSettings();
  const rows = await db.boardTask.findMany({
    where: { status: { not: "ERLEDIGT" }, dueDate: { lt: todayZurich() }, OR: [{ assigneeAdminId: { not: null } }, { assigneeMemberId: { not: null } }] },
    orderBy: { dueDate: "asc" },
    take: 50,
    select: { id: true },
  });
  const out = { sent: 0, failed: 0, skipped: 0, errors: [] as string[] };
  for (const r of rows) {
    const res = await remindOne(admin, r.id, "", s.senderName || admin.name);
    if (res.ok) out.sent += 1;
    else if (/vor kurzem|bereits erledigt/.test(res.error)) out.skipped += 1;
    else {
      out.failed += 1;
      if (out.errors.length < 3 && !out.errors.includes(res.error)) out.errors.push(res.error);
    }
  }
  return out;
}
