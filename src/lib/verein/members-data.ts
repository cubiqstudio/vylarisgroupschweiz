// Datenzugriff des Moduls Mitglieder (nur auf dem Server): Listen, Detail, Anlegen, Statuswechsel, Austritt, Ämter, Mitgliedsarten,
// Portal und Auskunft. Jede Änderung schreibt in derselben Transaktion einen Eintrag ins Änderungsprotokoll (AuditLog).
// Mitgliedernummern werden atomar in der Transaktion vergeben, die das Mitglied anlegt (ids.ts).
import "server-only";
import { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api";
import type { CurrentAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { auditActor, auditActorMember, logAudit, SYSTEM_ACTOR, type AuditActor } from "./audit";
import { MEMBER_STATUSES } from "./constants";
import { formatDateCh, todayZurich, toDateOnly } from "./dates";
import { nextMemberNumber } from "./ids";
import {
  ACTION_FROM_STATUSES,
  ANONYMIZABLE_STATUSES,
  ANONYMIZED_LAST_NAME,
  anonymizedFields,
  buildDisclosure,
  canAutoLink,
  isExitDue,
  memberAuditDiff,
  officeTitle,
  planExit,
  scrubPersonalAuditJson,
  singleSeatWarning,
  type Disclosure,
  type ExitPlan,
} from "./members-lib";
import type {
  ApplicationInput,
  MemberActionInput,
  MemberCreateInput,
  MemberPatchInput,
  MemberSort,
  PortalProfilePatch,
} from "./members-schemas";
import { MEMBER_SORTS } from "./members-schemas";
import { formatChf } from "./money";
import { firstParam, MAX_PAGE_SIZE, searchWhere } from "./pagination";
import { exitRuleOf, fiscalStartOf, getVereinSettings } from "./settings";
import { hasBoardRole } from "./permissions";

type Tx = Prisma.TransactionClient;
type ParamSource = URLSearchParams | Record<string, string | string[] | undefined>;

// ---- Liste ----------------------------------------------------------------------------------------------------------------

/** Filterwerte zusätzlich zu den Status: «EHEMALIG» (ausgetreten, ausgeschlossen, verstorben) und «AUSTRITT» (Austritt vorgemerkt). */
export const MEMBER_STATUS_FILTERS = [...MEMBER_STATUSES, "EHEMALIG", "AUSTRITT"] as const;

export type MemberFilters = { q: string; status: string; typeId: string; sort: MemberSort; dir: "asc" | "desc" };

export function parseMemberFilters(source: ParamSource): MemberFilters {
  const status = firstParam(source, "status");
  const sort = firstParam(source, "sort");
  const dir = firstParam(source, "dir");
  return {
    q: firstParam(source, "q").trim().slice(0, 100),
    status: (MEMBER_STATUS_FILTERS as readonly string[]).includes(status) ? status : "",
    typeId: firstParam(source, "type").slice(0, 40).replace(/[^A-Za-z0-9_-]/g, ""),
    sort: (MEMBER_SORTS as readonly string[]).includes(sort) ? (sort as MemberSort) : "name",
    dir: dir === "desc" ? "desc" : "asc",
  };
}

export function memberWhere(f: Pick<MemberFilters, "q" | "status" | "typeId">): Prisma.MemberWhereInput {
  const and: Prisma.MemberWhereInput[] = [];
  if (f.q) {
    const text = searchWhere(f.q, ["firstName", "lastName", "email", "city"]);
    const number = /^\d{1,9}$/.test(f.q.replace(/^nr\.?\s*/i, "")) ? Number(f.q.replace(/^nr\.?\s*/i, "")) : null;
    and.push(number !== null ? { OR: [{ memberNumber: number }, { AND: text.AND }] } : { AND: text.AND });
  }
  if (f.status === "EHEMALIG") and.push({ status: { in: ["AUSGETRETEN", "AUSGESCHLOSSEN", "VERSTORBEN"] } });
  else if (f.status === "AUSTRITT") and.push({ status: "AKTIV", exitNoticeAt: { not: null } });
  else if (f.status) and.push({ status: f.status });
  if (f.typeId) and.push({ membershipTypeId: f.typeId });
  return and.length ? { AND: and } : {};
}

export function memberOrderBy(sort: MemberSort, dir: "asc" | "desc"): Prisma.MemberOrderByWithRelationInput[] {
  switch (sort) {
    case "nr":
      return [{ memberNumber: dir }];
    case "status":
      return [{ status: dir }, { lastName: "asc" }, { firstName: "asc" }];
    case "eintritt":
      return [{ joinedAt: dir }, { memberNumber: "asc" }];
    case "ort":
      return [{ city: dir }, { lastName: "asc" }];
    case "art":
      return [{ membershipType: { name: dir } }, { lastName: "asc" }];
    default:
      return [{ lastName: dir }, { firstName: dir }, { memberNumber: "asc" }];
  }
}

export const memberListSelect = {
  id: true,
  memberNumber: true,
  salutation: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  street: true,
  houseNumber: true,
  zip: true,
  city: true,
  country: true,
  status: true,
  applicationAt: true,
  joinedAt: true,
  exitNoticeAt: true,
  leftAt: true,
  communicationPref: true,
  anonymizedAt: true,
  userId: true,
  membershipType: { select: { id: true, name: true } },
} satisfies Prisma.MemberSelect;
export type MemberListRow = Prisma.MemberGetPayload<{ select: typeof memberListSelect }>;

export async function listMembers(filters: MemberFilters, skip: number, take: number): Promise<{ rows: MemberListRow[]; total: number }> {
  const where = memberWhere(filters);
  const [rows, total] = await Promise.all([
    db.member.findMany({ where, orderBy: memberOrderBy(filters.sort, filters.dir), skip, take: Math.min(take, MAX_PAGE_SIZE), select: memberListSelect }),
    db.member.count({ where }),
  ]);
  return { rows, total };
}

/** Alle Treffer für den Export (ohne Seitenbegrenzung, aber höchstens 20 000 Zeilen). */
export async function listMembersForExport(filters: MemberFilters): Promise<MemberListRow[]> {
  return db.member.findMany({ where: memberWhere(filters), orderBy: memberOrderBy(filters.sort, filters.dir), take: 20_000, select: memberListSelect });
}

export async function memberCounts() {
  const [byStatus, exitNotices, dueExits] = await Promise.all([
    db.member.groupBy({ by: ["status"], _count: { _all: true } }),
    db.member.count({ where: { status: "AKTIV", exitNoticeAt: { not: null } } }),
    db.member.count({ where: { status: "AKTIV", leftAt: { lt: todayZurich() } } }),
  ]);
  const counts: Record<string, number> = Object.fromEntries(MEMBER_STATUSES.map((s) => [s, 0]));
  for (const r of byStatus) counts[r.status] = r._count._all;
  return { counts, exitNotices, dueExits };
}

/** Anzahl offener Anträge (für Kennzeichen in der Navigation und der Übersicht). */
export const openApplicationsCount = (): Promise<number> => db.member.count({ where: { status: "ANTRAG" } });

/** Mitgliedschaftsarten für Auswahllisten. */
export function listMembershipTypes(opts: { onlyActive?: boolean } = {}) {
  return db.membershipType.findMany({
    where: opts.onlyActive ? { active: true } : {},
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, description: true, annualFeeRappen: true, votingRight: true, eligibleForBoard: true, selectable: true, active: true, sortOrder: true, _count: { select: { members: true } } },
  });
}

// ---- Detail ---------------------------------------------------------------------------------------------------------------

export async function getMemberDetail(id: string) {
  const member = await db.member.findUnique({
    where: { id },
    include: {
      membershipType: { select: { id: true, name: true, annualFeeRappen: true, votingRight: true, eligibleForBoard: true } },
      offices: { orderBy: [{ validFrom: "desc" }] },
      user: { select: { id: true, email: true, name: true, emailVerifiedAt: true, disabled: true } },
      adminAccount: { select: { id: true, email: true, name: true, role: true } },
    },
  });
  return member;
}
export type MemberDetail = NonNullable<Awaited<ReturnType<typeof getMemberDetail>>>;

/** Offene Forderungen (Rechnungen im Status «Offen»): verhindern das Entfernen der Personendaten. */
export async function openClaims(memberId: string, client: Pick<Tx, "invoice"> = db): Promise<{ count: number; openRappen: number }> {
  const r = await client.invoice.aggregate({ where: { memberId, status: "OFFEN" }, _count: { _all: true }, _sum: { totalRappen: true, paidRappen: true } });
  return { count: r._count._all, openRappen: (r._sum.totalRappen ?? 0) - (r._sum.paidRappen ?? 0) };
}

/** Protokolleinträge zu einem Mitglied (neueste zuerst). */
export function memberHistory(memberId: string, take = 40) {
  return db.auditLog.findMany({
    where: { objectType: "Member", objectId: memberId },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, createdAt: true, actorName: true, actorType: true, action: true, summary: true },
  });
}

// ---- Anlegen --------------------------------------------------------------------------------------------------------------

type NewMember = {
  fields: Omit<MemberCreateInput, "status" | "joinedAt" | "boardNotes"> & { boardNotes?: string };
  status: "ANTRAG" | "AKTIV";
  joinedAt?: Date | null;
  consentAt?: Date | null;
  /** Adresse aus dem öffentlichen Antrag, nicht bestätigt (keine automatische Verknüpfung mit einem Konto) */
  emailUnconfirmed?: boolean;
};

async function assertAssignableType(tx: Tx, typeId: string | null | undefined, opts: { allowInactiveId?: string | null } = {}) {
  if (!typeId) return;
  const t = await tx.membershipType.findUnique({ where: { id: typeId }, select: { id: true, active: true } });
  if (!t) throw new ApiError(422, "VALIDATION_ERROR", "Ungültige Eingabe.", { membershipTypeId: "Diese Mitgliedschaftsart gibt es nicht." });
  if (!t.active && t.id !== opts.allowInactiveId) {
    throw new ApiError(422, "VALIDATION_ERROR", "Ungültige Eingabe.", { membershipTypeId: "Diese Mitgliedschaftsart ist nicht mehr aktiv." });
  }
}

async function createMemberTx(tx: Tx, input: NewMember, actor: AuditActor, action: string, summary: (nr: number) => string) {
  await assertAssignableType(tx, input.fields.membershipTypeId);
  const memberNumber = await nextMemberNumber(tx);
  const f = input.fields;
  const joinedAt = input.status === "AKTIV" ? toDateOnly(input.joinedAt ?? todayZurich()) : null;
  const member = await tx.member.create({
    data: {
      memberNumber,
      salutation: f.salutation,
      firstName: f.firstName,
      lastName: f.lastName,
      birthDate: f.birthDate ?? null,
      street: f.street,
      houseNumber: f.houseNumber,
      zip: f.zip,
      city: f.city,
      country: f.country,
      email: f.email,
      phone: f.phone,
      communicationPref: f.communicationPref,
      membershipTypeId: f.membershipTypeId ?? null,
      boardNotes: f.boardNotes ?? "",
      status: input.status,
      joinedAt,
      consentAt: input.consentAt ?? null,
      emailUnconfirmed: input.emailUnconfirmed ?? false,
    },
  });
  await logAudit(tx, {
    actor,
    action,
    objectType: "Member",
    objectId: member.id,
    summary: summary(memberNumber),
    after: { memberNumber, status: member.status, membershipTypeId: member.membershipTypeId, joinedAt },
  });
  return member;
}

/** Verwaltung: Mitglied manuell erfassen (aktiv oder als Antrag). Verknüpft ein bestätigtes Website-Konto mit gleicher E-Mail-Adresse. */
export async function createMemberByAdmin(admin: CurrentAdmin, input: MemberCreateInput) {
  if (input.boardNotes && !hasBoardRole(admin.roles)) throw new ApiError(403, "FORBIDDEN", "Vorstandsnotizen dürfen nur Rollen mit diesem Recht erfassen.");
  return db.$transaction(async (tx) => {
    const { status, joinedAt, ...fields } = input;
    const member = await createMemberTx(tx, { fields, status, joinedAt }, auditActor(admin), "member.create", (nr) => `Mitglied ${nr} erfasst`);
    const linked = status === "AKTIV" ? await tryAutoLink(tx, member, auditActor(admin)) : false;
    return { member, linked };
  });
}

/** Öffentlicher Beitrittsantrag. Gibt null zurück, wenn unter dieser E-Mail-Adresse bereits ein Antrag oder ein Mitglied besteht (ohne das zu verraten). */
export async function createApplication(input: ApplicationInput, now: Date = new Date()) {
  const existing = await db.member.findFirst({ where: { email: input.email, status: { in: ["ANTRAG", "AKTIV"] } }, select: { id: true } });
  if (existing) return null;
  const note = input.message ? `Bemerkung im Antrag: ${input.message}` : "";
  return db.$transaction(async (tx) => {
    const member = await createMemberTx(
      tx,
      {
        fields: {
          salutation: input.salutation,
          firstName: input.firstName,
          lastName: input.lastName,
          birthDate: null,
          street: input.street,
          houseNumber: input.houseNumber,
          zip: input.zip,
          city: input.city,
          country: input.country,
          email: input.email,
          phone: input.phone,
          communicationPref: input.communicationPref,
          membershipTypeId: input.membershipTypeId ?? null,
          boardNotes: note,
        },
        status: "ANTRAG",
        consentAt: now,
        emailUnconfirmed: true,
      },
      { ...SYSTEM_ACTOR, name: "Beitrittsformular" },
      "member.apply",
      (nr) => `Beitrittsantrag ${nr} eingegangen`,
    );
    const type = member.membershipTypeId ? await tx.membershipType.findUnique({ where: { id: member.membershipTypeId }, select: { name: true } }) : null;
    return { member, typeName: type?.name ?? "" };
  });
}

// ---- Ändern ---------------------------------------------------------------------------------------------------------------

export async function updateMember(admin: CurrentAdmin, id: string, patch: MemberPatchInput) {
  if (patch.boardNotes !== undefined && !hasBoardRole(admin.roles)) throw new ApiError(403, "FORBIDDEN", "Vorstandsnotizen dürfen nur Rollen mit diesem Recht ändern.");
  return db.$transaction(async (tx) => {
    const before = await tx.member.findUnique({ where: { id } });
    if (!before) throw new ApiError(404, "NOT_FOUND", "Mitglied nicht gefunden.");
    if (before.anonymizedAt) throw new ApiError(409, "CONFLICT", "Die Personendaten dieses Mitglieds wurden entfernt und lassen sich nicht mehr ändern.");
    if (patch.membershipTypeId !== undefined && patch.membershipTypeId !== before.membershipTypeId) {
      await assertAssignableType(tx, patch.membershipTypeId, { allowInactiveId: before.membershipTypeId });
    }
    const data: Prisma.MemberUncheckedUpdateInput = {};
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined) (data as Record<string, unknown>)[key] = value;
    }
    // Ändert die Verwaltung die Adresse, steht sie dafür ein (kein ungeprüfter Wert aus dem Antrag mehr).
    if (patch.email !== undefined && patch.email !== before.email) data.emailUnconfirmed = false;
    const after = await tx.member.update({ where: { id }, data });
    const diff = memberAuditDiff(before, after);
    if (Object.keys(diff.after).length === 0) return { member: after, linked: false };
    await logAudit(tx, {
      actor: auditActor(admin),
      action: "member.update",
      objectType: "Member",
      objectId: id,
      summary: `Mitglied ${after.memberNumber} geändert (${Object.keys(diff.after).join(", ")})`,
      ...diff,
    });
    const linked = before.email !== after.email && after.status === "AKTIV" ? await tryAutoLink(tx, after, auditActor(admin)) : false;
    return { member: after, linked };
  });
}

// ---- Verknüpfung mit dem Website-Konto ------------------------------------------------------------------------------------------

/**
 * Verknüpft das Mitglied mit dem Website-Konto, das dieselbe, bestätigte E-Mail-Adresse hat (canAutoLink). Gibt zurück, ob verknüpft wurde.
 * Mehrdeutigkeit (mehrere Mitglieder mit derselben Adresse) führt nie zu einer Verknüpfung.
 */
async function tryAutoLink(tx: Tx, member: { id: string; memberNumber: number; email: string; userId: string | null; status: string; emailUnconfirmed: boolean }, actor: AuditActor): Promise<boolean> {
  if (member.userId || !member.email) return false;
  const user = await tx.user.findUnique({ where: { email: member.email.trim().toLowerCase() }, select: { id: true, email: true, emailVerifiedAt: true, emailVerifiedViaMail: true, disabled: true } });
  if (!user || !canAutoLink(user, member)) return false;
  const [taken, sameMail] = await Promise.all([
    tx.member.findUnique({ where: { userId: user.id }, select: { id: true } }),
    tx.member.count({ where: { email: member.email, status: "AKTIV", userId: null } }),
  ]);
  if (taken || sameMail > 1) return false;
  const res = await tx.member.updateMany({ where: { id: member.id, userId: null }, data: { userId: user.id } });
  if (res.count === 0) return false;
  await logAudit(tx, {
    actor,
    action: "member.link",
    objectType: "Member",
    objectId: member.id,
    summary: `Mitglied ${member.memberNumber} mit Website-Konto verknüpft (bestätigte E-Mail-Adresse)`,
  });
  return true;
}

/**
 * Für die Anmeldung und die E-Mail-Bestätigung: Verknüpft das Website-Konto mit dem Mitglied gleicher, bestätigter E-Mail-Adresse.
 * Gibt true zurück, wenn jetzt eine Verknüpfung besteht (neu oder schon vorher).
 */
export async function linkAccountByVerifiedEmail(userId: string): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const existing = await tx.member.findUnique({ where: { userId }, select: { id: true } });
    if (existing) return true;
    const user = await tx.user.findUnique({ where: { id: userId }, select: { email: true, emailVerifiedAt: true, emailVerifiedViaMail: true, disabled: true } });
    if (!user?.emailVerifiedAt || !user.emailVerifiedViaMail || user.disabled) return false;
    const candidates = await tx.member.findMany({
      where: { email: user.email.trim().toLowerCase(), status: "AKTIV", userId: null },
      select: { id: true, memberNumber: true, email: true, userId: true, status: true, emailUnconfirmed: true },
      take: 2,
    });
    const only = candidates.length === 1 ? candidates[0]! : null;
    return only ? tryAutoLink(tx, only, SYSTEM_ACTOR) : false;
  });
}

// ---- Aktionen (Aufnahme, Austritt, Ausschluss …) ----------------------------------------------------------------------------------

export type ActionOutcome = {
  member: { id: string; memberNumber: number; firstName: string; lastName: string; email: string; status: string; communicationPref: string; typeName: string };
  action: MemberActionInput["action"];
  plan?: ExitPlan;
  linked?: boolean;
  warning?: string;
  /** Mail, die nach der Änderung zu versenden ist */
  notify?: "accepted" | "rejected" | "exit";
};

const conflict = () => new ApiError(409, "CONFLICT", "Das Mitglied hat inzwischen einen anderen Status. Bitte die Seite neu laden.");

/** Führt eine Aktion auf einem Mitglied aus. Prüft den Ausgangsstatus in der Transaktion (kein Überschreiben paralleler Änderungen). */
export async function runMemberAction(admin: CurrentAdmin, id: string, input: MemberActionInput): Promise<ActionOutcome> {
  const settings = await getVereinSettings();
  const actor = auditActor(admin);
  const today = todayZurich();

  return db.$transaction(async (tx) => {
    const m = await tx.member.findUnique({ where: { id } });
    if (!m) throw new ApiError(404, "NOT_FOUND", "Mitglied nicht gefunden.");
    if (m.anonymizedAt) throw new ApiError(409, "CONFLICT", "Die Personendaten dieses Mitglieds wurden entfernt.");

    const done = async (
      action: string,
      summary: string,
      data: Prisma.MemberUncheckedUpdateManyInput,
      where: Prisma.MemberWhereInput,
      extra: { before?: Record<string, unknown>; after?: Record<string, unknown> } = {},
    ) => {
      const res = await tx.member.updateMany({ where: { id, ...where }, data });
      if (res.count === 0) throw conflict();
      const after = await tx.member.findUniqueOrThrow({ where: { id } });
      const diff = memberAuditDiff(m, after);
      await logAudit(tx, { actor, action, objectType: "Member", objectId: id, summary, before: extra.before ?? diff.before, after: extra.after ?? diff.after });
      return after;
    };
    const outcome = async (
      after: { id: string; memberNumber: number; firstName: string; lastName: string; email: string; status: string; communicationPref: string; membershipTypeId: string | null },
      extra: Partial<ActionOutcome> = {},
    ): Promise<ActionOutcome> => {
      const type = after.membershipTypeId ? await tx.membershipType.findUnique({ where: { id: after.membershipTypeId }, select: { name: true } }) : null;
      return {
        member: {
          id: after.id,
          memberNumber: after.memberNumber,
          firstName: after.firstName,
          lastName: after.lastName,
          email: after.email,
          status: after.status,
          communicationPref: after.communicationPref,
          typeName: type?.name ?? "",
        },
        action: input.action,
        ...extra,
      };
    };

    switch (input.action) {
      case "accept": {
        const typeId = input.membershipTypeId ?? m.membershipTypeId;
        await assertAssignableType(tx, typeId, { allowInactiveId: m.membershipTypeId });
        if (!typeId && (await tx.membershipType.count({ where: { active: true } })) > 0) {
          throw new ApiError(422, "VALIDATION_ERROR", "Ungültige Eingabe.", { membershipTypeId: "Bitte eine Mitgliedschaftsart wählen." });
        }
        const joinedAt = toDateOnly(input.joinedAt ?? today);
        const after = await done(
          "member.accept",
          `Mitglied ${m.memberNumber} aufgenommen`,
          { status: "AKTIV", joinedAt, membershipTypeId: typeId, exitNoticeAt: null, leftAt: null, exitReason: "" },
          { status: { in: [...ACTION_FROM_STATUSES.accept] } },
        );
        const linked = await tryAutoLink(tx, after, actor);
        return await outcome(after, { linked, notify: input.sendMail ? "accepted" : undefined });
      }
      case "reject": {
        const after = await done(
          "member.reject",
          `Antrag ${m.memberNumber} abgelehnt`,
          { status: "ABGELEHNT", exitReason: input.reason },
          { status: { in: [...ACTION_FROM_STATUSES.reject] } },
        );
        return await outcome(after, { notify: input.sendMail ? "rejected" : undefined });
      }
      case "reinstate": {
        const after = await done(
          "member.reinstate",
          `Mitglied ${m.memberNumber} wieder aufgenommen`,
          { status: "AKTIV", joinedAt: input.joinedAt ? toDateOnly(input.joinedAt) : (m.joinedAt ?? today), exitNoticeAt: null, leftAt: null, exitReason: "" },
          { status: { in: [...ACTION_FROM_STATUSES.reinstate] } },
        );
        return await outcome(after, { linked: await tryAutoLink(tx, after, actor) });
      }
      case "exit": {
        if (m.exitNoticeAt) throw new ApiError(409, "CONFLICT", "Für dieses Mitglied ist bereits ein Austritt vorgemerkt. Nimm ihn zuerst zurück, um einen neuen zu erfassen.");
        const plan = planExit({ noticeAt: input.noticeAt ?? today, requested: input.leftAt, rule: exitRuleOf(settings), fiscal: fiscalStartOf(settings) });
        if (plan.effective.getTime() < plan.noticeAt.getTime()) {
          throw new ApiError(422, "VALIDATION_ERROR", "Ungültige Eingabe.", { leftAt: "Der Austritt kann nicht vor dem Eingang der Austrittserklärung liegen." });
        }
        if (plan.earlierThanRule && !input.allowEarlier) {
          throw new ApiError(422, "VALIDATION_ERROR", "Ungültige Eingabe.", {
            leftAt: `Frühestmöglicher Termin nach den Einstellungen: ${formatDateCh(plan.earliest)}. Ein früherer Termin braucht deine ausdrückliche Bestätigung (z. B. abweichende Statuten).`,
          });
        }
        const after = await done(
          "member.exit",
          `Austritt von Mitglied ${m.memberNumber} vorgemerkt per ${formatDateCh(plan.effective)}`,
          { exitNoticeAt: plan.noticeAt, leftAt: plan.effective, exitReason: input.reason },
          { status: "AKTIV", exitNoticeAt: null },
        );
        return await outcome(after, { plan, notify: input.sendMail ? "exit" : undefined });
      }
      case "exit-withdraw": {
        const after = await done(
          "member.exit.withdraw",
          `Austritt von Mitglied ${m.memberNumber} zurückgenommen`,
          { exitNoticeAt: null, leftAt: null, exitReason: "" },
          { status: "AKTIV", exitNoticeAt: { not: null } },
        );
        return await outcome(after);
      }
      case "exit-complete": {
        if (!isExitDue(m, today)) {
          throw new ApiError(409, "CONFLICT", m.leftAt ? `Der Austritt wird erst nach dem ${formatDateCh(m.leftAt)} wirksam.` : "Es ist kein Austritt vorgemerkt.");
        }
        const after = await done("member.exit.complete", `Mitglied ${m.memberNumber} ausgetreten`, { status: "AUSGETRETEN" }, { status: "AKTIV", exitNoticeAt: { not: null }, leftAt: { lt: today } });
        return await outcome(after);
      }
      case "expel": {
        const leftAt = toDateOnly(input.effectiveAt ?? today);
        const after = await done(
          "member.expel",
          `Mitglied ${m.memberNumber} ausgeschlossen`,
          { status: "AUSGESCHLOSSEN", leftAt, exitReason: input.reason },
          { status: { in: [...ACTION_FROM_STATUSES.expel] } },
        );
        return await outcome(after);
      }
      case "deceased": {
        const after = await done(
          "member.deceased",
          `Mitglied ${m.memberNumber} als verstorben erfasst`,
          { status: "VERSTORBEN", leftAt: toDateOnly(input.date ?? today) },
          { status: { in: [...ACTION_FROM_STATUSES.deceased] } },
        );
        return await outcome(after);
      }
      case "anonymize": {
        if (!ANONYMIZABLE_STATUSES.includes(m.status)) {
          throw new ApiError(409, "CONFLICT", "Personendaten lassen sich nur von ehemaligen Mitgliedern und abgelehnten Anträgen entfernen. Erfasse zuerst den Austritt.");
        }
        if (input.confirmNumber !== m.memberNumber) {
          throw new ApiError(422, "VALIDATION_ERROR", "Ungültige Eingabe.", { confirmNumber: "Die Mitgliedernummer stimmt nicht überein." });
        }
        const claims = await openClaims(id, tx);
        if (claims.count > 0) {
          throw new ApiError(409, "OPEN_CLAIMS", `Es gibt ${claims.count} offene ${claims.count === 1 ? "Rechnung" : "Rechnungen"} (CHF ${formatChf(claims.openRappen)}). Die Personendaten lassen sich erst entfernen, wenn keine Forderung mehr offen ist.`);
        }
        const res = await tx.member.updateMany({ where: { id, anonymizedAt: null, status: m.status }, data: anonymizedFields(new Date()) });
        if (res.count === 0) throw conflict();
        await tx.office.updateMany({ where: { memberId: id }, data: { note: "" } });
        await tx.attendance.updateMany({ where: { memberId: id }, data: { note: "" } });
        await tx.adminUser.updateMany({ where: { memberId: id }, data: { memberId: null } });
        // Weitere Personendaten: Versandprotokoll der Einladungen, Freitext der Anlass-Anmeldungen, Namen in früheren Protokolleinträgen.
        await tx.meetingMail.updateMany({ where: { memberId: id }, data: { recipientName: ANONYMIZED_LAST_NAME, email: "" } });
        const registrations = await tx.eventRegistration.findMany({ where: { memberId: id }, select: { id: true } });
        await tx.eventRegistration.updateMany({ where: { memberId: id }, data: { note: "" } });
        const oldEntries = await tx.auditLog.findMany({
          where: { OR: [{ objectType: "Member", objectId: id }, ...(registrations.length ? [{ objectType: "EventRegistration", objectId: { in: registrations.map((r) => r.id) } }] : [])] },
          select: { id: true, objectType: true, before: true, after: true },
        });
        for (const entry of oldEntries) {
          await tx.auditLog.update({
            where: { id: entry.id },
            data: { before: scrubPersonalAuditJson(entry.before), after: scrubPersonalAuditJson(entry.after), ...(entry.objectType === "EventRegistration" ? { summary: "Anmeldung eines früheren Mitglieds" } : {}) },
          });
        }
        // Das Website-Konto (E-Mail-Adresse, Name) gehört der Person: auf Wunsch löschen, sonst nur die Verknüpfung lösen (siehe oben, userId: null).
        let accountDeleted = false;
        if (input.deleteAccount && m.userId) {
          await tx.user.deleteMany({ where: { id: m.userId } });
          accountDeleted = true;
        }
        await logAudit(tx, {
          actor,
          action: "member.anonymize",
          objectType: "Member",
          objectId: id,
          summary: `Personendaten von Mitglied ${m.memberNumber} entfernt${m.userId ? (accountDeleted ? " (Website-Konto gelöscht)" : " (Website-Konto bleibt bestehen)") : ""}`,
          before: { status: m.status, anonymizedAt: null },
          after: { status: m.status, anonymizedAt: new Date() },
        });
        return await outcome(await tx.member.findUniqueOrThrow({ where: { id } }));
      }
      case "link-user": {
        if (m.userId) throw new ApiError(409, "CONFLICT", "Dieses Mitglied ist bereits mit einem Website-Konto verknüpft.");
        const user = await tx.user.findUnique({ where: { email: input.email }, select: { id: true, emailVerifiedAt: true } });
        if (!user) throw new ApiError(422, "VALIDATION_ERROR", "Ungültige Eingabe.", { email: "Zu dieser E-Mail-Adresse gibt es kein Website-Konto." });
        if (!user.emailVerifiedAt) throw new ApiError(422, "VALIDATION_ERROR", "Ungültige Eingabe.", { email: "Die E-Mail-Adresse dieses Kontos ist noch nicht bestätigt." });
        if (await tx.member.findUnique({ where: { userId: user.id }, select: { id: true } })) {
          throw new ApiError(409, "CONFLICT", "Dieses Website-Konto gehört bereits zu einem anderen Mitglied.");
        }
        const after = await done("member.link", `Mitglied ${m.memberNumber} mit Website-Konto verknüpft`, { userId: user.id }, { userId: null }, { before: { userId: null }, after: { userId: "[Konto verknüpft]" } });
        return await outcome(after);
      }
      case "reissue-card": {
        if (m.status !== "AKTIV") throw new ApiError(409, "CONFLICT", "Einen Ausweis gibt es nur für aktive Mitglieder.");
        const after = await done(
          "member.card.reissue",
          `Ausweis von Mitglied ${m.memberNumber} neu ausgestellt (frühere QR-Codes sind ungültig)`,
          { cardVersion: { increment: 1 } },
          { status: "AKTIV" },
          { before: { cardVersion: m.cardVersion }, after: { cardVersion: m.cardVersion + 1 } },
        );
        return await outcome(after);
      }
      case "unlink-user": {
        if (!m.userId) throw new ApiError(409, "CONFLICT", "Dieses Mitglied hat kein verknüpftes Website-Konto.");
        const after = await done("member.unlink", `Verknüpfung von Mitglied ${m.memberNumber} mit dem Website-Konto gelöst`, { userId: null }, { userId: { not: null } }, { before: { userId: "[Konto verknüpft]" }, after: { userId: null } });
        return await outcome(after);
      }
    }
  });
}

/** Vollzieht alle fälligen Austritte (letzter Tag der Mitgliedschaft liegt hinter uns). Gibt die betroffenen Mitglieder zurück. */
export async function completeDueExits(admin: CurrentAdmin): Promise<Array<{ id: string; memberNumber: number }>> {
  const today = todayZurich();
  const due = await db.member.findMany({ where: { status: "AKTIV", exitNoticeAt: { not: null }, leftAt: { lt: today } }, select: { id: true, memberNumber: true } });
  const done: Array<{ id: string; memberNumber: number }> = [];
  for (const m of due) {
    await db.$transaction(async (tx) => {
      const res = await tx.member.updateMany({ where: { id: m.id, status: "AKTIV", leftAt: { lt: today } }, data: { status: "AUSGETRETEN" } });
      if (res.count === 0) return;
      await logAudit(tx, {
        actor: auditActor(admin),
        action: "member.exit.complete",
        objectType: "Member",
        objectId: m.id,
        summary: `Mitglied ${m.memberNumber} ausgetreten`,
        before: { status: "AKTIV" },
        after: { status: "AUSGETRETEN" },
      });
      done.push(m);
    });
  }
  return done;
}

// ---- Mitgliedschaftsarten ----------------------------------------------------------------------------------------------------

type TypeData = { name: string; description: string; annualFee: number; votingRight: boolean; eligibleForBoard: boolean; selectable: boolean; active: boolean; sortOrder: number };

function typeRecord(t: { name: string; description: string; annualFeeRappen: number; votingRight: boolean; eligibleForBoard: boolean; selectable: boolean; active: boolean; sortOrder: number }) {
  return { ...t, annualFeeChf: formatChf(t.annualFeeRappen) };
}

export async function createMembershipType(admin: CurrentAdmin, input: TypeData) {
  return db.$transaction(async (tx) => {
    const { annualFee, ...rest } = input;
    const created = await tx.membershipType.create({ data: { ...rest, annualFeeRappen: annualFee } });
    await logAudit(tx, { actor: auditActor(admin), action: "membertype.create", objectType: "MembershipType", objectId: created.id, summary: `Mitgliedschaftsart «${created.name}» angelegt`, after: typeRecord(created) });
    return created;
  });
}

export async function updateMembershipType(admin: CurrentAdmin, id: string, patch: Partial<TypeData>) {
  return db.$transaction(async (tx) => {
    const before = await tx.membershipType.findUnique({ where: { id } });
    if (!before) throw new ApiError(404, "NOT_FOUND", "Mitgliedschaftsart nicht gefunden.");
    const { annualFee, ...rest } = patch;
    const data: Prisma.MembershipTypeUpdateInput = { ...rest, ...(annualFee !== undefined ? { annualFeeRappen: annualFee } : {}) };
    const after = await tx.membershipType.update({ where: { id }, data });
    const b = typeRecord(before) as Record<string, unknown>;
    const a = typeRecord(after) as Record<string, unknown>;
    const changed = Object.keys(a).filter((k) => b[k] !== a[k]);
    if (changed.length) {
      await logAudit(tx, {
        actor: auditActor(admin),
        action: "membertype.update",
        objectType: "MembershipType",
        objectId: id,
        summary: `Mitgliedschaftsart «${after.name}» geändert (${changed.join(", ")})`,
        before: Object.fromEntries(changed.map((k) => [k, b[k]])),
        after: Object.fromEntries(changed.map((k) => [k, a[k]])),
      });
    }
    return after;
  });
}

/** Löschen nur, wenn die Art nirgends gebraucht wird; sonst deaktivieren. */
export async function deleteMembershipType(admin: CurrentAdmin, id: string) {
  return db.$transaction(async (tx) => {
    const t = await tx.membershipType.findUnique({ where: { id }, include: { _count: { select: { members: true, rates: true, campaigns: true } } } });
    if (!t) throw new ApiError(404, "NOT_FOUND", "Mitgliedschaftsart nicht gefunden.");
    if (t._count.members > 0 || t._count.rates > 0 || t._count.campaigns > 0) {
      throw new ApiError(409, "IN_USE", "Diese Mitgliedschaftsart wird verwendet (Mitglieder, Beitragsjahre oder Newsletter). Deaktiviere sie stattdessen.");
    }
    await tx.membershipType.delete({ where: { id } });
    await logAudit(tx, { actor: auditActor(admin), action: "membertype.delete", objectType: "MembershipType", objectId: id, summary: `Mitgliedschaftsart «${t.name}» gelöscht`, before: typeRecord(t) });
  });
}

// ---- Ämter ------------------------------------------------------------------------------------------------------------------

type OfficeInput = { kind: string; title: string; validFrom: Date; validUntil: Date | null; note: string };

async function seatWarning(tx: Tx, candidate: { id?: string; kind: string; validFrom: Date; validUntil: Date | null }): Promise<string | undefined> {
  const same = await tx.office.findMany({ where: { kind: candidate.kind }, select: { id: true, kind: true, validFrom: true, validUntil: true } });
  return singleSeatWarning(candidate, same) ?? undefined;
}

export async function createOffice(admin: CurrentAdmin, input: OfficeInput & { memberId: string }) {
  return db.$transaction(async (tx) => {
    const member = await tx.member.findUnique({ where: { id: input.memberId }, select: { id: true, memberNumber: true, status: true, anonymizedAt: true } });
    if (!member) throw new ApiError(404, "NOT_FOUND", "Mitglied nicht gefunden.");
    if (member.anonymizedAt || !["AKTIV"].includes(member.status)) {
      throw new ApiError(422, "VALIDATION_ERROR", "Ungültige Eingabe.", { memberId: "Ein Amt kann nur an aktuelle Mitglieder vergeben werden." });
    }
    const warning = await seatWarning(tx, input);
    const office = await tx.office.create({ data: { ...input } });
    await logAudit(tx, {
      actor: auditActor(admin),
      action: "office.create",
      objectType: "Member",
      objectId: member.id,
      summary: `Amt «${officeTitle(office)}» für Mitglied ${member.memberNumber} erfasst`,
      after: { kind: office.kind, title: office.title, validFrom: office.validFrom, validUntil: office.validUntil },
    });
    return { office, warning };
  });
}

export async function updateOffice(admin: CurrentAdmin, id: string, patch: Partial<OfficeInput>) {
  return db.$transaction(async (tx) => {
    const before = await tx.office.findUnique({ where: { id }, include: { member: { select: { memberNumber: true } } } });
    if (!before) throw new ApiError(404, "NOT_FOUND", "Amt nicht gefunden.");
    const merged = { ...before, ...patch };
    if (merged.kind === "SONSTIGES" && !merged.title.trim()) throw new ApiError(422, "VALIDATION_ERROR", "Ungültige Eingabe.", { title: "Bitte die Bezeichnung des Amtes angeben." });
    if (merged.validUntil && merged.validUntil.getTime() < merged.validFrom.getTime()) {
      throw new ApiError(422, "VALIDATION_ERROR", "Ungültige Eingabe.", { validUntil: "Das Enddatum liegt vor dem Beginn." });
    }
    const warning = await seatWarning(tx, { id, kind: merged.kind, validFrom: merged.validFrom, validUntil: merged.validUntil ?? null });
    const { member: _member, ...beforeOffice } = before;
    void _member;
    const office = await tx.office.update({ where: { id }, data: patch });
    await logAudit(tx, {
      actor: auditActor(admin),
      action: "office.update",
      objectType: "Member",
      objectId: before.memberId,
      summary: `Amt «${officeTitle(office)}» von Mitglied ${before.member.memberNumber} geändert`,
      before: { kind: beforeOffice.kind, title: beforeOffice.title, validFrom: beforeOffice.validFrom, validUntil: beforeOffice.validUntil },
      after: { kind: office.kind, title: office.title, validFrom: office.validFrom, validUntil: office.validUntil },
    });
    return { office, warning };
  });
}

export async function deleteOffice(admin: CurrentAdmin, id: string) {
  await db.$transaction(async (tx) => {
    const o = await tx.office.findUnique({ where: { id }, include: { member: { select: { memberNumber: true } } } });
    if (!o) throw new ApiError(404, "NOT_FOUND", "Amt nicht gefunden.");
    await tx.office.delete({ where: { id } });
    await logAudit(tx, {
      actor: auditActor(admin),
      action: "office.delete",
      objectType: "Member",
      objectId: o.memberId,
      summary: `Amt «${officeTitle(o)}» von Mitglied ${o.member.memberNumber} gelöscht`,
      before: { kind: o.kind, title: o.title, validFrom: o.validFrom, validUntil: o.validUntil },
    });
  });
}

/** Alle Ämter mit Person für die Übersicht (Name nur, solange die Person nicht anonymisiert ist). */
export function listOffices() {
  return db.office.findMany({
    orderBy: [{ validFrom: "desc" }],
    include: { member: { select: { id: true, memberNumber: true, firstName: true, lastName: true, anonymizedAt: true, status: true } } },
  });
}

/** Aktive Mitglieder für Auswahlfelder (Suche nach Name oder Nummer). */
export async function searchActiveMembers(q: string, take = 10) {
  const where = memberWhere({ q, status: "AKTIV", typeId: "" });
  return db.member.findMany({
    where,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take,
    select: { id: true, memberNumber: true, firstName: true, lastName: true, city: true },
  });
}

// ---- Portal (eigene Daten) -------------------------------------------------------------------------------------------------------

/** Eigene Mitgliedsdaten für das Portal; filtert ausschliesslich nach der ID des angemeldeten Mitglieds. */
export async function getPortalMember(memberId: string) {
  return db.member.findUnique({
    where: { id: memberId },
    select: {
      id: true,
      memberNumber: true,
      salutation: true,
      firstName: true,
      lastName: true,
      street: true,
      houseNumber: true,
      zip: true,
      city: true,
      country: true,
      email: true,
      phone: true,
      communicationPref: true,
      status: true,
      applicationAt: true,
      joinedAt: true,
      exitNoticeAt: true,
      leftAt: true,
      anonymizedAt: true,
      cardVersion: true,
      membershipType: { select: { name: true, votingRight: true, annualFeeRappen: true } },
      offices: { orderBy: { validFrom: "desc" }, select: { id: true, kind: true, title: true, validFrom: true, validUntil: true } },
    },
  });
}

const PORTAL_EDITABLE = ["AKTIV", "ANTRAG"];

export async function updateOwnProfile(member: { id: string; firstName: string; lastName: string; memberNumber: number }, patch: PortalProfilePatch) {
  return db.$transaction(async (tx) => {
    const before = await tx.member.findUnique({ where: { id: member.id } });
    if (!before) throw new ApiError(404, "NOT_FOUND", "Mitglied nicht gefunden.");
    if (before.anonymizedAt || !PORTAL_EDITABLE.includes(before.status)) throw new ApiError(403, "FORBIDDEN", "Deine Angaben lassen sich nicht mehr ändern.");
    const data: Prisma.MemberUncheckedUpdateInput = {};
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined) (data as Record<string, unknown>)[key] = value;
    }
    const after = await tx.member.update({ where: { id: member.id }, data });
    const diff = memberAuditDiff(before, after);
    if (Object.keys(diff.after).length > 0) {
      await logAudit(tx, { actor: auditActorMember(member), action: "member.update", objectType: "Member", objectId: member.id, summary: `Mitglied ${after.memberNumber} hat seine Angaben im Portal geändert (${Object.keys(diff.after).join(", ")})`, ...diff });
    }
    return after;
  });
}

/** Austrittserklärung im Portal: hält den Eingang fest und berechnet den Termin nach den Einstellungen (Statuten gehen vor). */
export async function declareOwnExit(member: { id: string; firstName: string; lastName: string; memberNumber: number }, reason: string) {
  const settings = await getVereinSettings();
  const today = todayZurich();
  const plan = planExit({ noticeAt: today, rule: exitRuleOf(settings), fiscal: fiscalStartOf(settings) });
  const after = await db.$transaction(async (tx) => {
    const res = await tx.member.updateMany({ where: { id: member.id, status: "AKTIV", exitNoticeAt: null, anonymizedAt: null }, data: { exitNoticeAt: plan.noticeAt, leftAt: plan.effective, exitReason: reason } });
    if (res.count === 0) throw new ApiError(409, "CONFLICT", "Für dich ist kein Austritt möglich oder er ist bereits vorgemerkt.");
    await logAudit(tx, {
      actor: auditActorMember(member),
      action: "member.exit",
      objectType: "Member",
      objectId: member.id,
      summary: `Mitglied ${member.memberNumber} hat im Portal den Austritt erklärt, vorgemerkt per ${formatDateCh(plan.effective)}`,
      before: { exitNoticeAt: null, leftAt: null },
      after: { exitNoticeAt: plan.noticeAt, leftAt: plan.effective },
    });
    return tx.member.findUniqueOrThrow({ where: { id: member.id }, select: { id: true, memberNumber: true, firstName: true, lastName: true, email: true } });
  });
  return { member: after, plan };
}

/** Austrittstermin, der bei einer Erklärung heute gelten würde (Anzeige im Portal). */
export async function previewOwnExit(): Promise<ExitPlan> {
  const settings = await getVereinSettings();
  return planExit({ noticeAt: todayZurich(), rule: exitRuleOf(settings), fiscal: fiscalStartOf(settings) });
}

/** Auskunft nach revDSG: alle zum Mitglied gespeicherten Daten. Filtert ausschliesslich nach `memberId`. */
export async function loadDisclosure(memberId: string, now: Date = new Date()): Promise<Disclosure> {
  const m = await db.member.findUnique({
    where: { id: memberId },
    include: {
      membershipType: { select: { name: true } },
      offices: { orderBy: { validFrom: "asc" } },
      invoices: { orderBy: { issueDate: "asc" }, select: { number: true, subject: true, issueDate: true, dueDate: true, totalRappen: true, paidRappen: true, status: true } },
      payments: { orderBy: { receivedAt: "asc" }, select: { receivedAt: true, amountRappen: true, method: true, invoice: { select: { number: true } } } },
      attendances: { select: { status: true, note: true, meeting: { select: { title: true, startsAt: true } } } },
      registrations: { select: { seats: true, status: true, note: true, event: { select: { title: true, startsAt: true } } } },
      user: { select: { email: true, name: true, createdAt: true } },
    },
  });
  if (!m) throw new ApiError(404, "NOT_FOUND", "Mitglied nicht gefunden.");
  const mails = await db.meetingMail.findMany({ where: { memberId }, orderBy: { sentAt: "asc" }, take: 500, select: { kind: true, sentAt: true, email: true, ok: true, meeting: { select: { title: true } } } });
  return buildDisclosure({
    generatedAt: now,
    member: {
      memberNumber: m.memberNumber,
      salutation: m.salutation,
      firstName: m.firstName,
      lastName: m.lastName,
      birthDate: m.birthDate,
      street: m.street,
      houseNumber: m.houseNumber,
      zip: m.zip,
      city: m.city,
      country: m.country,
      email: m.email,
      phone: m.phone,
      status: m.status,
      applicationAt: m.applicationAt,
      joinedAt: m.joinedAt,
      exitNoticeAt: m.exitNoticeAt,
      leftAt: m.leftAt,
      exitReason: m.exitReason,
      consentAt: m.consentAt,
      communicationPref: m.communicationPref,
      hasBoardNotes: m.boardNotes.trim() !== "",
      membershipTypeName: m.membershipType?.name ?? "",
      hasAccount: m.userId !== null,
    },
    account: m.user,
    mails: mails.map((x) => ({ meetingTitle: x.meeting.title, kind: x.kind, sentAt: x.sentAt, email: x.email, ok: x.ok })),
    offices: m.offices,
    invoices: m.invoices,
    payments: m.payments.map((p) => ({ receivedAt: p.receivedAt, amountRappen: p.amountRappen, method: p.method, invoiceNumber: p.invoice?.number ?? null })),
    attendances: m.attendances.map((a) => ({ meetingTitle: a.meeting.title, startsAt: a.meeting.startsAt, status: a.status, note: a.note })),
    registrations: m.registrations.map((r) => ({ eventTitle: r.event.title, startsAt: r.event.startsAt, seats: r.seats, status: r.status, note: r.note })),
  });
}

