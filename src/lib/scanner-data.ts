// Scanner-Schnittstelle v1: Abfragen und Eingriffe (Anlässe, Ausweis prüfen, Check-in, Suche, Anwesenheit).
// Nur Eingriffe (Check-in, Rückgängig) stehen im Änderungsprotokoll, Abfragen nicht. Das Protokoll enthält die Mitgliedernummer und den Anlass, nie einen Namen.
import "server-only";
import type { ScannerDevice } from "@prisma/client";
import { ApiError } from "@/lib/api";
import { db } from "@/lib/db";
import { assertCanCheckIn } from "@/lib/scanner";
import {
  EVENT_LIST_MAX,
  MEMBER_SEARCH_MAX,
  eventWindowWhere,
  matchesMemberQuery,
  memberSearchWhere,
  needsExactFilter,
  parseMemberQuery,
  ticketOf,
  toEventCheck,
  toScannerMember,
  toScannerRegistration,
  type MemberQuery,
  type RegistrationRow,
  type ScanBody,
  type ScannerEventCheck,
  type ScannerMember,
  type ScannerRegistration,
} from "@/lib/scanner-lib";
import { logAudit, type AuditActor } from "@/lib/verein/audit";
import { assertAttendanceAllowed, lockedTx, markAttendance } from "@/lib/verein/events-ops";
import { CARD_MEMBER_SELECT, inspectCardToken, toInspectMember } from "@/lib/verein/membership-card-data";
import { getVereinName } from "@/lib/verein/profile";

const REGISTRATION_SELECT = { id: true, status: true, seats: true, note: true, attendedAt: true } as const;

/** Akteur im Änderungsprotokoll: das Gerät (Typ SYSTEM), mit der Bezeichnung, ohne Personenname. */
const deviceActor = (d: Pick<ScannerDevice, "id" | "label">): AuditActor => ({ type: "SYSTEM", id: d.id, name: `Scanner: ${d.label}` });

/** Nur veröffentlichte Anlässe gehören zur Tür; alles andere (unbekannt, Entwurf, abgesagt) ist 404. */
async function loadPublishedEvent(eventId: string): Promise<{ id: string; title: string }> {
  const ev = await db.event.findFirst({ where: { id: eventId, status: "VEROEFFENTLICHT" }, select: { id: true, title: true } });
  if (!ev) throw new ApiError(404, "NOT_FOUND", "Anlass nicht gefunden.");
  return ev;
}

// ---- GET /me ----------------------------------------------------------------------------------------------------------

export async function scannerMe(device: ScannerDevice, now: Date = new Date()) {
  return {
    club: { name: await getVereinName() },
    device: { id: device.id, label: device.label, canCheckIn: device.canCheckIn },
    serverTime: now.toISOString(),
  };
}

// ---- GET /events ------------------------------------------------------------------------------------------------------

export type ScannerEvent = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  location: string;
  stats: { registered: number; waitlist: number; attended: number };
};

/**
 * Anlässe der Tür: veröffentlicht, Beginn höchstens 14 Tage in der Zukunft, Ende (sonst Beginn + 6 h) noch nicht länger als 6 Stunden vorbei;
 * aufsteigend nach Beginn, höchstens 20. Zahlen: angemeldete Personen (Summe der Plätze), Warteliste (Anzahl), Anwesende (Summe der Plätze).
 * Unbestätigte Gast-Anmeldungen und beendete Anmeldungen zählen nirgends.
 */
export async function listScannerEvents(now: Date = new Date()): Promise<ScannerEvent[]> {
  const events = await db.event.findMany({
    where: eventWindowWhere(now),
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    take: EVENT_LIST_MAX,
    select: { id: true, title: true, startsAt: true, endsAt: true, location: true },
  });
  if (events.length === 0) return [];
  const ids = events.map((e) => e.id);
  const [byStatus, attended] = await Promise.all([
    db.eventRegistration.groupBy({ by: ["eventId", "status"], where: { eventId: { in: ids }, status: { in: ["ANGEMELDET", "WARTELISTE"] } }, _sum: { seats: true }, _count: { _all: true } }),
    db.eventRegistration.groupBy({ by: ["eventId"], where: { eventId: { in: ids }, status: "ANGEMELDET", attendedAt: { not: null } }, _sum: { seats: true } }),
  ]);
  return events.map((e) => ({
    id: e.id,
    title: e.title,
    startsAt: e.startsAt.toISOString(),
    endsAt: e.endsAt ? e.endsAt.toISOString() : null,
    location: e.location,
    stats: {
      registered: byStatus.find((r) => r.eventId === e.id && r.status === "ANGEMELDET")?._sum.seats ?? 0,
      waitlist: byStatus.find((r) => r.eventId === e.id && r.status === "WARTELISTE")?._count._all ?? 0,
      attended: attended.find((r) => r.eventId === e.id)?._sum.seats ?? 0,
    },
  }));
}

// ---- POST /scan -------------------------------------------------------------------------------------------------------

export type ScanOutcome =
  | { valid: true; reason: null; member: ScannerMember; event: ScannerEventCheck | null }
  | { valid: false; reason: "malformed" | "unknown" | "outdated" | "inactive"; member: ScannerMember | null; event: null };

/** Trägt die Person ein (atomar) und schreibt den Protokolleintrag in derselben Transaktion. true = dieser Aufruf hat eingecheckt. */
async function checkInAndLog(device: ScannerDevice, event: { id: string; title: string }, reg: { id: string; seats: number }, memberNumber: number, now: Date): Promise<boolean> {
  return lockedTx(async (tx) => {
    const done = await markAttendance(tx, reg.id, true, now);
    if (done) {
      await logAudit(tx, {
        actor: deviceActor(device),
        action: "scanner.checkin",
        objectType: "EventRegistration",
        objectId: reg.id,
        summary: `Check-in: Mitglied ${memberNumber} bei «${event.title}»`,
        after: { personen: reg.seats },
      });
    }
    return done;
  });
}

/**
 * Ausweis prüfen, mit `eventId` zusätzlich das Ticket (die Anmeldung des Mitglieds) und mit `checkIn: true` einchecken.
 * Eingecheckt wird nur, wenn das Gerät es darf, der Ausweis gültig ist, das Ticket gilt (ANGEMELDET) und die Person noch nicht anwesend ist.
 * Gleichzeitige Scans desselben Ausweises ergeben höchstens einen Check-in (bedingte Aktualisierung, siehe markAttendance).
 */
export async function scanCard(device: ScannerDevice, body: ScanBody, now: Date = new Date()): Promise<ScanOutcome> {
  const checkIn = body.checkIn === true;
  if (checkIn) assertCanCheckIn(device);
  const event = body.eventId ? await loadPublishedEvent(body.eventId) : null;

  const found = await inspectCardToken(body.token, now);
  if (!found.valid) return { valid: false, reason: found.reason, member: found.member ? toScannerMember(found.member) : null, event: null };

  let eventCheck: ScannerEventCheck | null = null;
  if (event) {
    const where = { eventId_memberId: { eventId: event.id, memberId: found.member.id } };
    let reg: RegistrationRow | null = await db.eventRegistration.findUnique({ where, select: REGISTRATION_SELECT });
    let performed = false;
    if (checkIn && reg && ticketOf(reg.status) === "valid" && !reg.attendedAt) {
      performed = await checkInAndLog(device, event, reg, found.member.memberNumber, now);
      // Aktueller Stand: bei verlorenem Wettlauf steht der Zeitpunkt des anderen Check-ins darin.
      reg = await db.eventRegistration.findUnique({ where, select: REGISTRATION_SELECT });
    }
    eventCheck = toEventCheck(event, reg, { performed, checkInRequested: checkIn });
  }
  return { valid: true, reason: null, member: toScannerMember(found.member), event: eventCheck };
}

// ---- GET /members -----------------------------------------------------------------------------------------------------

export type LookupEntry = { member: ScannerMember; event: ScannerEventCheck | null };

const SEARCH_ORDER = [{ lastName: "asc" }, { firstName: "asc" }, { memberNumber: "asc" }] as const;
/** Obergrenze der Vorauswahl, wenn der Suchbegriff Sonderzeichen enthält und die Treffer von Hand geprüft werden. */
const EXACT_FILTER_CANDIDATES = 5000;

/** Mitglieder zum Suchbegriff, höchstens 20, sortiert nach Nachname. Mit %, _ oder Backslash im Begriff: Vorauswahl in der Datenbank, genaue Prüfung hier. */
async function findMembers(query: MemberQuery) {
  const where = memberSearchWhere(query);
  if (!needsExactFilter(query)) return db.member.findMany({ where, orderBy: [...SEARCH_ORDER], take: MEMBER_SEARCH_MAX, select: CARD_MEMBER_SELECT });
  const candidates = await db.member.findMany({ where, orderBy: [...SEARCH_ORDER], take: EXACT_FILTER_CANDIDATES, select: { id: true, firstName: true, lastName: true } });
  const ids = candidates.filter((c) => matchesMemberQuery(c, query)).slice(0, MEMBER_SEARCH_MAX).map((c) => c.id);
  if (ids.length === 0) return [];
  const rows = await db.member.findMany({ where: { id: { in: ids } }, select: CARD_MEMBER_SELECT });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}

/** Manuelle Suche: nur Ziffern = Mitgliedernummer, sonst Teilstring im Vor- oder Nachnamen. Höchstens 20 Treffer; mit `eventId` je Treffer die Anmeldung. */
export async function searchScannerMembers(q: string, eventId: string | null | undefined, now: Date = new Date()): Promise<LookupEntry[]> {
  const event = eventId ? await loadPublishedEvent(eventId) : null;
  const rows = await findMembers(parseMemberQuery(q));
  if (rows.length === 0) return [];
  const regs = event
    ? await db.eventRegistration.findMany({ where: { eventId: event.id, memberId: { in: rows.map((r) => r.id) } }, select: { ...REGISTRATION_SELECT, memberId: true } })
    : [];
  const byMember = new Map(regs.map((r) => [r.memberId, r]));
  return rows.map((row) => ({
    member: toScannerMember(toInspectMember(row, now)),
    event: event ? toEventCheck(event, byMember.get(row.id) ?? null) : null,
  }));
}

// ---- PATCH /events/{id}/attendance ------------------------------------------------------------------------------------

/**
 * Anwesenheit von Hand setzen oder zurücknehmen. Keine Anmeldung: 404. Nur ANGEMELDET lässt sich einchecken oder zurücknehmen, sonst 409
 * (dieselbe Regel wie in der Verwaltung, assertAttendanceAllowed). Ist der Zustand schon erreicht, bleibt er unverändert und es gibt keinen Protokolleintrag.
 */
export async function setScannerAttendance(device: ScannerDevice, eventId: string, memberId: string, attended: boolean, now: Date = new Date()): Promise<{ registration: ScannerRegistration }> {
  const event = await loadPublishedEvent(eventId);
  const where = { eventId_memberId: { eventId: event.id, memberId } };
  const reg = await db.eventRegistration.findUnique({ where, select: { ...REGISTRATION_SELECT, member: { select: { memberNumber: true } } } });
  if (!reg) throw new ApiError(404, "NOT_FOUND", "Keine Anmeldung gefunden.");
  assertAttendanceAllowed(reg.status);
  await lockedTx(async (tx) => {
    const changed = await markAttendance(tx, reg.id, attended, now);
    if (!changed) return;
    const nr = reg.member?.memberNumber;
    await logAudit(tx, {
      actor: deviceActor(device),
      action: attended ? "scanner.checkin" : "scanner.undo",
      objectType: "EventRegistration",
      objectId: reg.id,
      summary: `${attended ? "Check-in" : "Check-in zurückgenommen"}: ${nr !== undefined ? `Mitglied ${nr}` : "Anmeldung"} bei «${event.title}»`,
      after: { personen: reg.seats },
    });
  });
  const current = await db.eventRegistration.findUnique({ where, select: REGISTRATION_SELECT });
  if (!current) throw new ApiError(404, "NOT_FOUND", "Keine Anmeldung gefunden.");
  return { registration: toScannerRegistration(current) };
}
