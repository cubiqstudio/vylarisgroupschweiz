// Änderungen des Moduls Anlässe (nur auf dem Server): Anlässe anlegen, ändern, kopieren, absagen, löschen; Anmeldungen mit
// Warteliste; Erinnerungen. Jede Änderung, die Platz belegt oder freigibt, läuft in einer Transaktion, die zuerst den Anlass
// sperrt (UPDATE auf die Zeile): so können zwei gleichzeitige Anmeldungen den letzten Platz nicht doppelt belegen.
// Sensible Änderungen schreiben in derselben Transaktion einen Eintrag ins Änderungsprotokoll.
import "server-only";
import { Prisma } from "@prisma/client";
import { runInBackground } from "@/lib/account";
import { ApiError } from "@/lib/api";
import type { CurrentAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { auditActor, diffForAudit, logAudit, SYSTEM_ACTOR, type AuditActor } from "./audit";
import { formatDateTimeCh } from "./dates";
import {
  canCancelRegistration,
  decideRegistration,
  eventConsistencyErrors,
  isReminderDue,
  planCopy,
  planPromotions,
  registrantName,
  registrationBlock,
  REGISTRATION_BLOCK_MESSAGE,
  type RegistrationBlock,
} from "./events-lib";
import {
  sendEventCancelledMail,
  sendEventChangedMail,
  sendPromotionMail,
  sendRegistrationMail,
  sendRegistrationRemovedMail,
  sendReminderMail,
  type MailEvent,
  type Recipient,
} from "./events-mail";
import type { AdminRegistrationInput, EventCreateInput, EventPatchInput, RegistrationActionInput } from "./events-schemas";
import { generateCancelToken, hashCancelToken } from "./events-token";
import { emailSchema } from "./validation";

type Tx = Prisma.TransactionClient;

/** Bei vielen gleichzeitigen Anmeldungen (Ansturm nach einer Einladung) warten wartende Transaktionen länger als die Vorgabe von 2 Sekunden. */
const TX_OPTIONS = { maxWait: 15_000, timeout: 20_000 } as const;
const lockedTx = <T>(fn: (tx: Tx) => Promise<T>): Promise<T> => db.$transaction(fn, TX_OPTIONS);

const LOCK_SELECT = {
  id: true,
  title: true,
  location: true,
  startsAt: true,
  endsAt: true,
  capacity: true,
  registrationDeadline: true,
  status: true,
  isPublic: true,
  membersOnly: true,
} as const satisfies Prisma.EventSelect;

type LockedEvent = Prisma.EventGetPayload<{ select: typeof LOCK_SELECT }>;

const mailEventOf = (e: Pick<LockedEvent, "id" | "title" | "location" | "startsAt" | "endsAt" | "isPublic">): MailEvent => ({
  id: e.id,
  title: e.title,
  location: e.location,
  startsAt: e.startsAt,
  endsAt: e.endsAt,
  isPublic: e.isPublic,
});

/** Sperrt den Anlass für die Dauer der Transaktion (UPDATE ohne Wirkung) und liefert seinen aktuellen Stand. */
async function lockEvent(tx: Tx, id: string): Promise<LockedEvent> {
  try {
    return await tx.event.update({ where: { id }, data: { sequence: { increment: 0 } }, select: LOCK_SELECT });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") throw new ApiError(404, "NOT_FOUND", "Anlass nicht gefunden.");
    throw e;
  }
}

async function takenSeats(tx: Tx, eventId: string, excludeId?: string): Promise<number> {
  const r = await tx.eventRegistration.aggregate({ where: { eventId, status: "ANGEMELDET", ...(excludeId ? { id: { not: excludeId } } : {}) }, _sum: { seats: true } });
  return r._sum.seats ?? 0;
}

type RegContact = { guestName: string; guestEmail: string; member: { firstName: string; lastName: string; email: string; anonymizedAt: Date | null } | null };

/** Empfänger einer Mail zur Anmeldung; null, wenn keine gültige Adresse vorliegt. */
function contactOf(r: RegContact): Recipient | null {
  const email = r.member ? (r.member.anonymizedAt ? "" : r.member.email) : r.guestEmail;
  if (!email || !emailSchema.safeParse(email).success) return null;
  return { to: email.trim().toLowerCase(), name: registrantName(r), isMember: r.member !== null };
}

const contactSelect = { guestName: true, guestEmail: true, member: { select: { firstName: true, lastName: true, email: true, anonymizedAt: true } } } as const;

// ---- Warteliste ---------------------------------------------------------------------------------------------------------

export type Promoted = { id: string; seats: number; recipient: Recipient | null };

/** Lässt von der Warteliste nachrücken, wer in die freien Plätze passt (nur bei veröffentlichten Anlässen). Aufruf innerhalb der Transaktion nach lockEvent. */
async function promoteWaitlist(tx: Tx, event: Pick<LockedEvent, "id" | "capacity" | "status">, now: Date): Promise<Promoted[]> {
  if (event.status !== "VEROEFFENTLICHT") return [];
  const waiting = await tx.eventRegistration.findMany({
    where: { eventId: event.id, status: "WARTELISTE" },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, seats: true },
  });
  if (waiting.length === 0) return [];
  const ids = planPromotions({ capacity: event.capacity, taken: await takenSeats(tx, event.id), waiting });
  if (ids.length === 0) return [];
  await tx.eventRegistration.updateMany({ where: { id: { in: ids }, eventId: event.id, status: "WARTELISTE" }, data: { status: "ANGEMELDET", promotedAt: now } });
  const rows = await tx.eventRegistration.findMany({ where: { id: { in: ids } }, select: { id: true, seats: true, ...contactSelect } });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.flatMap((id) => {
    const r = byId.get(id);
    return r ? [{ id, seats: r.seats, recipient: contactOf(r) }] : [];
  });
}

/** Informiert die Nachgerückten (im Hintergrund, Fehler werden nur protokolliert). */
function mailPromoted(event: MailEvent, promoted: readonly Promoted[]): void {
  const todo = promoted.filter((p): p is Promoted & { recipient: Recipient } => p.recipient !== null);
  if (todo.length === 0) return;
  runInBackground(() => Promise.allSettled(todo.map((p) => sendPromotionMail({ recipient: p.recipient, event, seats: p.seats }))));
}

// ---- Anmelden -----------------------------------------------------------------------------------------------------------

export type Registrant =
  | { kind: "member"; member: { id: string; firstName: string; lastName: string; email: string } }
  | { kind: "guest"; name: string; email: string; consent: boolean };

export type RegisterOutcome = {
  registrationId: string;
  status: "ANGEMELDET" | "WARTELISTE";
  seats: number;
  /** false, wenn die Person schon angemeldet war (nichts doppelt gebucht) */
  created: boolean;
};

const blockError = (b: RegistrationBlock) => new ApiError(409, "REGISTRATION_CLOSED", REGISTRATION_BLOCK_MESSAGE[b]);

/**
 * Meldet ein Mitglied oder einen Gast an. Ohne freien Platz kommt die Anmeldung auf die Warteliste.
 * `admin`: der Vorstand trägt ein (ignoriert Anmeldeschluss und Zugangsbeschränkung; `force` überschreitet die Kapazität).
 * Die Bestätigungsmail geht im Hintergrund an die angegebene Adresse (ausser `sendMail: false`).
 */
export async function registerForEvent(opts: {
  eventId: string;
  who: Registrant;
  seats: number;
  note: string;
  admin?: { actor: AuditActor; force: boolean };
  sendMail?: boolean;
  now?: Date;
}): Promise<RegisterOutcome> {
  const now = opts.now ?? new Date();
  const { who, seats } = opts;

  const result = await lockedTx(async (tx) => {
    const ev = await lockEvent(tx, opts.eventId);

    if (opts.admin) {
      if (ev.status === "ABGESAGT") throw blockError("CANCELLED");
      if (now.getTime() > (ev.endsAt ?? ev.startsAt).getTime()) throw blockError("PAST");
    } else {
      const block = registrationBlock(ev, now);
      if (block) throw blockError(block);
      if (who.kind === "guest" && (ev.membersOnly || !ev.isPublic)) {
        throw new ApiError(403, "MEMBERS_ONLY", "Die Anmeldung zu diesem Anlass ist nur für Mitglieder möglich.");
      }
    }

    const existing =
      who.kind === "member"
        ? await tx.eventRegistration.findUnique({ where: { eventId_memberId: { eventId: ev.id, memberId: who.member.id } }, select: { id: true, status: true, seats: true } })
        : await tx.eventRegistration.findFirst({ where: { eventId: ev.id, memberId: null, guestEmail: who.email, status: { not: "ABGESAGT" } }, select: { id: true, status: true, seats: true } });

    // Schon angemeldet: nichts doppelt buchen. Der Abmelde-Link wird NICHT erneuert (sonst könnte jede Person mit einer fremden Adresse den
    // Link der angemeldeten Person entwerten); die Mail an die Adresse geht ohne Link hinaus.
    if (existing && existing.status !== "ABGESAGT") {
      return { ev, outcome: { registrationId: existing.id, status: existing.status as "ANGEMELDET" | "WARTELISTE", seats: existing.seats, created: false }, token: undefined };
    }

    const decision = decideRegistration({ capacity: ev.capacity, taken: await takenSeats(tx, ev.id), seats });
    if (!decision.ok) throw new ApiError(422, "TOO_LARGE", "Für diese Gruppengrösse hat es insgesamt zu wenig Plätze.", { seats: "Mehr Personen, als der Anlass insgesamt Plätze hat." });
    const status = opts.admin?.force ? "ANGEMELDET" : decision.status;

    const t = generateCancelToken();
    const base = {
      status,
      seats,
      note: opts.note,
      cancelTokenHash: t.hash,
      cancelledAt: null,
      promotedAt: null,
      attendedAt: null,
      reminderSentAt: null,
      createdAt: now,
    };
    let registrationId: string;
    if (who.kind === "member") {
      const row = await tx.eventRegistration.upsert({
        where: { eventId_memberId: { eventId: ev.id, memberId: who.member.id } },
        create: { ...base, eventId: ev.id, memberId: who.member.id },
        update: base,
        select: { id: true },
      });
      registrationId = row.id;
    } else {
      const row = await tx.eventRegistration.create({
        data: { ...base, eventId: ev.id, guestName: who.name, guestEmail: who.email, consentAt: who.consent ? now : null },
        select: { id: true },
      });
      registrationId = row.id;
    }
    if (opts.admin) {
      await logAudit(tx, {
        actor: opts.admin.actor,
        action: "registration.add",
        objectType: "EventRegistration",
        objectId: registrationId,
        summary: `Anmeldung eines ${who.kind === "member" ? "Mitglieds" : "Gasts"} für «${ev.title}» erfasst (${status === "ANGEMELDET" ? "angemeldet" : "Warteliste"})`,
        after: { personen: seats, status },
      });
    }
    return { ev, outcome: { registrationId, status, seats, created: true }, token: t.token };
  });

  if (opts.sendMail !== false && (result.token !== undefined || (!result.outcome.created && who.kind === "guest"))) {
    const recipient: Recipient | null =
      who.kind === "member"
        ? contactOf({ guestName: "", guestEmail: "", member: { ...who.member, anonymizedAt: null } })
        : { to: who.email, name: who.name, isMember: false };
    if (recipient) {
      const { ev, outcome, token } = result;
      runInBackground(() => sendRegistrationMail({ recipient, event: mailEventOf(ev), status: outcome.status, seats: outcome.seats, token }));
    }
  }
  return result.outcome;
}

// ---- Abmelden ------------------------------------------------------------------------------------------------------------

/** Beendet eine Anmeldung und lässt Wartende nachrücken. Aufruf innerhalb der Transaktion nach lockEvent. */
async function cancelAndPromote(tx: Tx, ev: LockedEvent, registrationId: string, now: Date): Promise<Promoted[]> {
  await tx.eventRegistration.update({ where: { id: registrationId }, data: { status: "ABGESAGT", cancelledAt: now } });
  return promoteWaitlist(tx, ev, now);
}

/** Ein Mitglied meldet sich selbst ab. Betrifft nur die eigene Anmeldung (`memberId` kommt aus der Sitzung). */
export async function cancelOwnRegistration(memberId: string, eventId: string, now: Date = new Date()): Promise<void> {
  const { ev, promoted } = await lockedTx(async (tx) => {
    const ev = await lockEvent(tx, eventId);
    const reg = await tx.eventRegistration.findFirst({ where: { eventId, memberId, status: { not: "ABGESAGT" } }, select: { id: true } });
    if (!reg) throw new ApiError(404, "NOT_FOUND", "Du bist für diesen Anlass nicht angemeldet.");
    if (!canCancelRegistration(ev, now)) throw new ApiError(409, "EVENT_STARTED", "Der Anlass hat bereits begonnen. Eine Abmeldung ist nicht mehr möglich.");
    return { ev, promoted: await cancelAndPromote(tx, ev, reg.id, now) };
  });
  mailPromoted(mailEventOf(ev), promoted);
}

export type TokenInfo = {
  registrationId: string;
  eventId: string;
  eventTitle: string;
  startsAt: Date;
  endsAt: Date | null;
  location: string;
  status: string;
  seats: number;
  canCancel: boolean;
};

/** Zeigt, wozu ein Abmelde-Token gehört (ohne etwas zu ändern). Die Seite fragt vor dem Abmelden nach. */
export async function describeCancelToken(token: string, eventId: string, now: Date = new Date()): Promise<TokenInfo | null> {
  const reg = await db.eventRegistration.findUnique({
    where: { cancelTokenHash: hashCancelToken(token) },
    select: { id: true, eventId: true, status: true, seats: true, event: { select: { title: true, startsAt: true, endsAt: true, location: true, status: true } } },
  });
  if (!reg || reg.eventId !== eventId) return null;
  return {
    registrationId: reg.id,
    eventId: reg.eventId,
    eventTitle: reg.event.title,
    startsAt: reg.event.startsAt,
    endsAt: reg.event.endsAt,
    location: reg.event.location,
    status: reg.status,
    seats: reg.seats,
    canCancel: reg.status !== "ABGESAGT" && canCancelRegistration(reg.event, now),
  };
}

/** Abmeldung über den Link aus der Mail. Antwortet nur mit dem Ergebnis, nie mit Daten Dritter. */
export async function cancelByToken(token: string, now: Date = new Date()): Promise<"CANCELLED" | "ALREADY" | "UNKNOWN" | "STARTED"> {
  const found = await db.eventRegistration.findUnique({ where: { cancelTokenHash: hashCancelToken(token) }, select: { id: true, eventId: true } });
  if (!found) return "UNKNOWN";
  const outcome = await lockedTx(async (tx) => {
    const ev = await lockEvent(tx, found.eventId);
    const reg = await tx.eventRegistration.findUnique({ where: { id: found.id }, select: { id: true, status: true } });
    if (!reg) return { kind: "UNKNOWN" as const };
    if (reg.status === "ABGESAGT") return { kind: "ALREADY" as const };
    if (!canCancelRegistration(ev, now)) return { kind: "STARTED" as const };
    return { kind: "CANCELLED" as const, ev, promoted: await cancelAndPromote(tx, ev, reg.id, now) };
  });
  if (outcome.kind === "CANCELLED") mailPromoted(mailEventOf(outcome.ev), outcome.promoted);
  return outcome.kind;
}

// ---- Verwaltung: Anmeldungen ---------------------------------------------------------------------------------------------

async function registrationOf(tx: Tx, eventId: string, regId: string) {
  const reg = await tx.eventRegistration.findFirst({
    where: { id: regId, eventId },
    select: { id: true, status: true, seats: true, note: true, attendedAt: true, memberId: true, ...contactSelect },
  });
  if (!reg) throw new ApiError(404, "NOT_FOUND", "Anmeldung nicht gefunden.");
  return reg;
}

const noCapacity = () => new ApiError(409, "NO_CAPACITY", "Es sind nicht genug Plätze frei. Mit «Trotzdem anmelden» wird die Kapazität bewusst überschritten.");

/** Der Vorstand trägt eine Person von Hand ein (Mitglied oder Gast). */
export async function adminAddRegistration(admin: CurrentAdmin, eventId: string, input: AdminRegistrationInput): Promise<RegisterOutcome> {
  const actor = auditActor(admin);
  if (input.memberId) {
    const member = await db.member.findUnique({ where: { id: input.memberId }, select: { id: true, firstName: true, lastName: true, email: true, status: true, anonymizedAt: true } });
    if (!member || member.anonymizedAt) throw new ApiError(404, "NOT_FOUND", "Mitglied nicht gefunden.");
    if (member.status !== "AKTIV") throw new ApiError(422, "VALIDATION_ERROR", "Ungültige Eingabe.", { memberId: "Nur aktive Mitglieder lassen sich anmelden." });
    return registerForEvent({ eventId, who: { kind: "member", member }, seats: input.seats, note: input.note, admin: { actor, force: input.force }, sendMail: input.sendMail });
  }
  return registerForEvent({
    eventId,
    who: { kind: "guest", name: input.guestName, email: input.guestEmail, consent: false },
    seats: input.seats,
    note: input.note,
    admin: { actor, force: input.force },
    sendMail: input.sendMail && input.guestEmail !== "",
  });
}

/** Aktion auf einer Anmeldung: absagen, von der Warteliste anmelden, wiederherstellen, Anwesenheit, Personen/Notiz ändern. */
type ActionResult = {
  ev: LockedEvent;
  status: string;
  promoted: Promoted[];
  /** Empfänger der Mail «Anmeldung beendet» */
  removed: Recipient | null;
  /** Mail «Platz frei» an die Person selbst (manuell nachgerückt) */
  promotedSelf: { recipient: Recipient; seats: number } | null;
};

export async function adminRegistrationAction(admin: CurrentAdmin, eventId: string, regId: string, input: RegistrationActionInput, now: Date = new Date()): Promise<{ status: string }> {
  const actor = auditActor(admin);
  const res = await lockedTx(async (tx): Promise<ActionResult> => {
    const ev = await lockEvent(tx, eventId);
    const reg = await registrationOf(tx, eventId, regId);
    const name = registrantName(reg);
    const audit = (action: string, summary: string, after?: unknown) =>
      logAudit(tx, { actor, action, objectType: "EventRegistration", objectId: reg.id, summary: `${summary} (${name}, «${ev.title}»)`, after });

    switch (input.action) {
      case "cancel": {
        if (reg.status === "ABGESAGT") throw new ApiError(409, "CONFLICT", "Die Anmeldung ist bereits beendet.");
        const promoted = await cancelAndPromote(tx, ev, reg.id, now);
        await audit("registration.cancel", "Anmeldung beendet");
        return { ev, status: "ABGESAGT", promoted, removed: input.sendMail ? contactOf(reg) : null, promotedSelf: null };
      }
      case "promote": {
        if (reg.status !== "WARTELISTE") throw new ApiError(409, "CONFLICT", "Nur Personen auf der Warteliste lassen sich nachrücken.");
        const taken = await takenSeats(tx, ev.id);
        if (ev.capacity !== null && taken + reg.seats > ev.capacity && !input.force) throw noCapacity();
        await tx.eventRegistration.update({ where: { id: reg.id }, data: { status: "ANGEMELDET", promotedAt: now } });
        await audit("registration.promote", "Von der Warteliste angemeldet", { personen: reg.seats });
        const self = input.sendMail ? contactOf(reg) : null;
        return { ev, status: "ANGEMELDET", promoted: [], removed: null, promotedSelf: self ? { recipient: self, seats: reg.seats } : null };
      }
      case "restore": {
        if (reg.status !== "ABGESAGT") throw new ApiError(409, "CONFLICT", "Nur beendete Anmeldungen lassen sich wiederherstellen.");
        const decision = decideRegistration({ capacity: ev.capacity, taken: await takenSeats(tx, ev.id), seats: reg.seats });
        if (!decision.ok) throw noCapacity();
        if (decision.status === "WARTELISTE" && !input.force) throw noCapacity();
        const status = decision.status === "WARTELISTE" && input.force ? "ANGEMELDET" : decision.status;
        await tx.eventRegistration.update({ where: { id: reg.id }, data: { status, cancelledAt: null, promotedAt: null, attendedAt: null, createdAt: now } });
        await audit("registration.restore", "Anmeldung wiederhergestellt", { status });
        return { ev, status, promoted: [], removed: null, promotedSelf: null };
      }
      case "attendance": {
        if (reg.status !== "ANGEMELDET") throw new ApiError(409, "CONFLICT", "Die Anwesenheit lässt sich nur bei angemeldeten Personen erfassen.");
        await tx.eventRegistration.update({ where: { id: reg.id }, data: { attendedAt: input.attended ? now : null } });
        return { ev, status: reg.status, promoted: [], removed: null, promotedSelf: null };
      }
      case "update": {
        const seats = input.seats ?? reg.seats;
        if (reg.status === "ANGEMELDET" && ev.capacity !== null) {
          const others = await takenSeats(tx, ev.id, reg.id);
          if (others + seats > ev.capacity) throw noCapacity();
        }
        await tx.eventRegistration.update({ where: { id: reg.id }, data: { seats, ...(input.note !== undefined ? { note: input.note } : {}) } });
        const promoted = reg.status === "ANGEMELDET" && seats < reg.seats ? await promoteWaitlist(tx, ev, now) : [];
        await audit("registration.update", "Anmeldung geändert", { personen: seats });
        return { ev, status: reg.status, promoted, removed: null, promotedSelf: null };
      }
    }
  });

  const event = mailEventOf(res.ev);
  mailPromoted(event, res.promoted);
  if (res.removed) {
    const recipient = res.removed;
    runInBackground(() => sendRegistrationRemovedMail({ recipient, event }));
  }
  if (res.promotedSelf) {
    const { recipient, seats } = res.promotedSelf;
    runInBackground(() => sendPromotionMail({ recipient, event, seats }));
  }
  return { status: res.status };
}

/** Löscht eine Anmeldung samt Personendaten (z. B. auf Wunsch). Gibt den Platz frei und lässt Wartende nachrücken. */
export async function adminDeleteRegistration(admin: CurrentAdmin, eventId: string, regId: string, now: Date = new Date()): Promise<void> {
  const { ev, promoted } = await lockedTx(async (tx) => {
    const ev = await lockEvent(tx, eventId);
    const reg = await registrationOf(tx, eventId, regId);
    await tx.eventRegistration.delete({ where: { id: reg.id } });
    await logAudit(tx, { actor: auditActor(admin), action: "registration.delete", objectType: "EventRegistration", objectId: reg.id, summary: `Anmeldung von ${registrantName(reg)} für «${ev.title}» gelöscht` });
    return { ev, promoted: reg.status === "ANGEMELDET" ? await promoteWaitlist(tx, ev, now) : [] };
  });
  mailPromoted(mailEventOf(ev), promoted);
}

// ---- Verwaltung: Anlässe ------------------------------------------------------------------------------------------------

export type MailReport = { mailed: number; failed: number; noEmail: number };

/** Anmeldungen, die informiert werden sollen (angemeldet und Warteliste). */
async function activeRecipients(client: Tx | typeof db, eventId: string) {
  const regs = await client.eventRegistration.findMany({
    where: { eventId, status: { in: ["ANGEMELDET", "WARTELISTE"] } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 2000,
    select: { id: true, seats: true, status: true, ...contactSelect },
  });
  return regs.map((r) => ({ id: r.id, seats: r.seats, status: r.status, recipient: contactOf(r) }));
}

async function mailAll(targets: ReadonlyArray<{ recipient: Recipient | null }>, send: (r: Recipient) => Promise<{ ok: boolean }>): Promise<MailReport> {
  const report: MailReport = { mailed: 0, failed: 0, noEmail: 0 };
  for (const t of targets) {
    if (!t.recipient) {
      report.noEmail += 1;
      continue;
    }
    try {
      const r = await send(t.recipient);
      if (r.ok) report.mailed += 1;
      else report.failed += 1;
    } catch {
      report.failed += 1;
    }
  }
  return report;
}

const CALENDAR_FIELDS = ["title", "description", "location", "startsAt", "endsAt"] as const;
const AUDIT_FIELDS = ["title", "description", "location", "startsAt", "endsAt", "capacity", "registrationDeadline", "isPublic", "membersOnly", "status"] as const;

const auditView = (e: Record<string, unknown>) => Object.fromEntries(AUDIT_FIELDS.map((k) => [k, e[k]]));

export async function createEvent(admin: CurrentAdmin, input: EventCreateInput) {
  return lockedTx(async (tx) => {
    const event = await tx.event.create({
      data: {
        title: input.title,
        description: input.description,
        location: input.location,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        capacity: input.capacity,
        registrationDeadline: input.registrationDeadline,
        status: input.status,
        isPublic: input.isPublic,
        membersOnly: input.membersOnly,
      },
    });
    await logAudit(tx, { actor: auditActor(admin), action: "event.create", objectType: "Event", objectId: event.id, summary: `Anlass «${event.title}» angelegt (${formatDateTimeCh(event.startsAt)})`, after: auditView(event) });
    return event;
  });
}

/** Ändert einen Anlass. Rückt Wartende nach, wenn Platz entsteht, und informiert auf Wunsch die Angemeldeten über Änderungen. */
export async function updateEvent(admin: CurrentAdmin, id: string, patch: EventPatchInput, now: Date = new Date()): Promise<{ warning: string | null; mail: MailReport | null }> {
  const { notify, ...fields } = patch;
  const out = await lockedTx(async (tx) => {
    const before = await lockEvent(tx, id);
    const full = await tx.event.findUniqueOrThrow({ where: { id } });
    const merged = { ...full, ...fields };
    const errors = eventConsistencyErrors(merged);
    if (Object.keys(errors).length > 0) throw new ApiError(422, "VALIDATION_ERROR", "Ungültige Eingabe.", errors);
    const calendarChanged = CALENDAR_FIELDS.some((k) => k in fields && String(fields[k] ?? "") !== String(full[k] ?? ""));
    const after = await tx.event.update({ where: { id }, data: { ...fields, ...(calendarChanged ? { sequence: { increment: 1 } } : {}) } });
    const taken = await takenSeats(tx, id);
    const promoted = after.capacity !== before.capacity ? await promoteWaitlist(tx, after, now) : [];
    const diff = diffForAudit(auditView(full), auditView(after));
    await logAudit(tx, { actor: auditActor(admin), action: "event.update", objectType: "Event", objectId: id, summary: `Anlass «${after.title}» geändert`, ...diff });
    const warning = after.capacity !== null && taken > after.capacity ? `Es sind ${taken} Personen angemeldet, aber nur ${after.capacity} Plätze vorgesehen. Bestehende Anmeldungen bleiben bestehen.` : null;
    const visible = ["startsAt", "endsAt", "location", "title"].some((k) => k in fields && String(fields[k as keyof typeof fields] ?? "") !== String(full[k as keyof typeof full] ?? ""));
    return { after, promoted, warning, visibleChange: visible };
  });
  mailPromoted(mailEventOf(out.after), out.promoted);

  let mail: MailReport | null = null;
  if (notify && out.visibleChange && out.after.status === "VEROEFFENTLICHT" && out.after.startsAt.getTime() > now.getTime()) {
    const targets = (await activeRecipients(db, id)).filter((t) => !out.promoted.some((p) => p.id === t.id));
    const event = mailEventOf(out.after);
    mail = await mailAll(targets, (recipient) => {
      const seats = targets.find((t) => t.recipient === recipient)?.seats ?? 1;
      return sendEventChangedMail({ recipient, event, seats });
    });
  }
  return { warning: out.warning, mail };
}

/** Veröffentlichen oder wieder zum Entwurf machen. Mit Anmeldungen geht nur die Absage. */
export async function setEventPublished(admin: CurrentAdmin, id: string, publish: boolean): Promise<void> {
  await lockedTx(async (tx) => {
    const ev = await lockEvent(tx, id);
    if (publish) {
      if (ev.status === "VEROEFFENTLICHT") return;
    } else {
      if (ev.status !== "VEROEFFENTLICHT") return;
      const active = await tx.eventRegistration.count({ where: { eventId: id, status: { in: ["ANGEMELDET", "WARTELISTE"] } } });
      if (active > 0) throw new ApiError(409, "HAS_REGISTRATIONS", "Es gibt Anmeldungen. Sage den Anlass ab, statt ihn zurückzuziehen.");
    }
    const status = publish ? "VEROEFFENTLICHT" : "ENTWURF";
    await tx.event.update({ where: { id }, data: { status, sequence: { increment: 1 } } });
    await logAudit(tx, {
      actor: auditActor(admin),
      action: publish ? (ev.status === "ABGESAGT" ? "event.reopen" : "event.publish") : "event.unpublish",
      objectType: "Event",
      objectId: id,
      summary: `Anlass «${ev.title}» ${publish ? (ev.status === "ABGESAGT" ? "wieder angesetzt und veröffentlicht" : "veröffentlicht") : "zum Entwurf gemacht"}`,
      before: { status: ev.status },
      after: { status },
    });
  });
}

/** Sagt den Anlass ab. Die Angemeldeten bekommen auf Wunsch eine Mail; die Anmeldungen bleiben zur Übersicht bestehen. */
export async function cancelEvent(admin: CurrentAdmin, id: string, opts: { reason: string; notify: boolean }): Promise<MailReport | null> {
  const ev = await lockedTx(async (tx) => {
    const ev = await lockEvent(tx, id);
    if (ev.status === "ABGESAGT") throw new ApiError(409, "CONFLICT", "Der Anlass ist bereits abgesagt.");
    await tx.event.update({ where: { id }, data: { status: "ABGESAGT", sequence: { increment: 1 } } });
    await logAudit(tx, {
      actor: auditActor(admin),
      action: "event.cancel",
      objectType: "Event",
      objectId: id,
      summary: `Anlass «${ev.title}» abgesagt${opts.reason ? `: ${opts.reason}` : ""}`,
      before: { status: ev.status },
      after: { status: "ABGESAGT" },
    });
    return ev;
  });
  if (!opts.notify) return null;
  const event = mailEventOf(ev);
  return mailAll(await activeRecipients(db, id), (recipient) => sendEventCancelledMail({ recipient, event, reason: opts.reason }));
}

/** Kopie als Entwurf auf einen neuen Beginn (Dauer und Abstand des Anmeldeschlusses bleiben). Anmeldungen werden nicht kopiert. */
export async function duplicateEvent(admin: CurrentAdmin, id: string, startsAt: Date) {
  return lockedTx(async (tx) => {
    const src = await tx.event.findUnique({ where: { id } });
    if (!src) throw new ApiError(404, "NOT_FOUND", "Anlass nicht gefunden.");
    const plan = planCopy(src, startsAt);
    const copy = await tx.event.create({ data: plan });
    await logAudit(tx, { actor: auditActor(admin), action: "event.create", objectType: "Event", objectId: copy.id, summary: `Anlass «${copy.title}» als Kopie angelegt (${formatDateTimeCh(copy.startsAt)})`, after: auditView(copy) });
    return copy;
  });
}

/** Löscht einen Anlass samt Anmeldungen. Ein bevorstehender, veröffentlichter Anlass mit Anmeldungen muss zuerst abgesagt werden. */
export async function deleteEvent(admin: CurrentAdmin, id: string, now: Date = new Date()): Promise<void> {
  await lockedTx(async (tx) => {
    const ev = await lockEvent(tx, id);
    const active = await tx.eventRegistration.count({ where: { eventId: id, status: { in: ["ANGEMELDET", "WARTELISTE"] } } });
    if (active > 0 && ev.status === "VEROEFFENTLICHT" && ev.startsAt.getTime() > now.getTime()) {
      throw new ApiError(409, "HAS_REGISTRATIONS", "Es gibt Anmeldungen für diesen bevorstehenden Anlass. Sage ihn zuerst ab, damit die Angemeldeten informiert werden.");
    }
    const total = await tx.eventRegistration.count({ where: { eventId: id } });
    await tx.event.delete({ where: { id } });
    await logAudit(tx, { actor: auditActor(admin), action: "event.delete", objectType: "Event", objectId: id, summary: `Anlass «${ev.title}» (${formatDateTimeCh(ev.startsAt)}) mit ${total} Anmeldungen gelöscht` });
  });
}

// ---- Erinnerungen --------------------------------------------------------------------------------------------------------

export type ReminderSummary = { events: number; mailed: number; failed: number; noEmail: number };

const REMINDER_BATCH = 500;

/**
 * Verschickt Erinnerungen an alle angemeldeten Personen (jede Anmeldung höchstens einmal).
 *  - mit `eventId`: von Hand für diesen Anlass (veröffentlicht, noch nicht begonnen), unabhängig vom Zeitfenster
 *  - ohne `eventId`: für alle veröffentlichten Anlässe, die innerhalb des Zeitfensters beginnen (für einen täglichen Cron-Aufruf)
 */
export async function sendEventReminders(opts: { eventId?: string; actor?: AuditActor; now?: Date } = {}): Promise<ReminderSummary> {
  const now = opts.now ?? new Date();
  const candidates = await db.event.findMany({
    where: opts.eventId ? { id: opts.eventId } : { status: "VEROEFFENTLICHT", startsAt: { gt: now, lte: new Date(now.getTime() + 48 * 3_600_000) } },
    select: { id: true, title: true, location: true, startsAt: true, endsAt: true, isPublic: true, status: true },
    take: 200,
  });
  if (opts.eventId && candidates.length === 0) throw new ApiError(404, "NOT_FOUND", "Anlass nicht gefunden.");
  const events = candidates.filter((e) => e.status === "VEROEFFENTLICHT" && e.startsAt.getTime() > now.getTime() && (opts.eventId ? true : isReminderDue(e.startsAt, now)));
  if (opts.eventId && events.length === 0) throw new ApiError(409, "CONFLICT", "Erinnerungen gibt es nur für veröffentlichte Anlässe, die noch nicht begonnen haben.");

  const summary: ReminderSummary = { events: 0, mailed: 0, failed: 0, noEmail: 0 };
  let budget = REMINDER_BATCH;
  for (const e of events) {
    if (budget <= 0) break;
    const regs = await db.eventRegistration.findMany({
      where: { eventId: e.id, status: "ANGEMELDET", reminderSentAt: null },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: budget,
      select: { id: true, seats: true, ...contactSelect },
    });
    if (regs.length === 0) continue;
    summary.events += 1;
    budget -= regs.length;
    const event = mailEventOf(e);
    for (const r of regs) {
      const recipient = contactOf(r);
      if (!recipient) {
        summary.noEmail += 1;
        continue;
      }
      try {
        const res = await sendReminderMail({ recipient, event, seats: r.seats });
        if (res.ok) {
          await db.eventRegistration.update({ where: { id: r.id }, data: { reminderSentAt: now } });
          summary.mailed += 1;
        } else summary.failed += 1;
      } catch {
        summary.failed += 1;
      }
    }
  }
  if (summary.events > 0) {
    await logAudit(db, {
      actor: opts.actor ?? SYSTEM_ACTOR,
      action: "event.reminders",
      objectType: "Event",
      objectId: opts.eventId ?? null,
      summary: `Erinnerungen versendet: ${summary.mailed} Mails, ${summary.failed} fehlgeschlagen, ${summary.noEmail} ohne E-Mail-Adresse (${summary.events} ${summary.events === 1 ? "Anlass" : "Anlässe"})`,
    });
  }
  return summary;
}
