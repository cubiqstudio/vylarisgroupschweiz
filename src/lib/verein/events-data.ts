// Datenzugriff des Moduls Anlässe (nur auf dem Server): Listen für Verwaltung, öffentliche Seiten und Mitgliederportal.
// Listen laden nie mehr Spalten als nötig. Die öffentlichen Abfragen liefern nur veröffentlichte, öffentliche Anlässe und keine Anmeldedaten.
import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { EVENT_VIEWS, seatsLeft, type EventView } from "./events-lib";
import { startOfDayZurich } from "./dates";
import { firstParam, searchWhere } from "./pagination";

type ParamSource = URLSearchParams | Record<string, string | string[] | undefined>;

/** Felder, die Besucher und Mitglieder zu sehen bekommen (keine Anmeldedaten). */
export const EVENT_VIEW_SELECT = {
  id: true,
  title: true,
  description: true,
  location: true,
  startsAt: true,
  endsAt: true,
  capacity: true,
  registrationDeadline: true,
  status: true,
  isPublic: true,
  membersOnly: true,
  sequence: true,
  updatedAt: true,
} as const satisfies Prisma.EventSelect;

export type EventCore = Prisma.EventGetPayload<{ select: typeof EVENT_VIEW_SELECT }>;

export type SeatInfo = { taken: number; waiting: number; left: number | null };

/** Belegte Plätze und Wartelisten-Personen je Anlass (eine Abfrage für alle). */
export async function seatInfoFor(events: ReadonlyArray<{ id: string; capacity: number | null }>): Promise<Map<string, SeatInfo>> {
  const out = new Map<string, SeatInfo>();
  if (events.length === 0) return out;
  const groups = await db.eventRegistration.groupBy({
    by: ["eventId", "status"],
    where: { eventId: { in: events.map((e) => e.id) }, status: { in: ["ANGEMELDET", "WARTELISTE"] } },
    _sum: { seats: true },
  });
  for (const e of events) out.set(e.id, { taken: 0, waiting: 0, left: seatsLeft(e.capacity, 0) });
  for (const g of groups) {
    const info = out.get(g.eventId);
    if (!info) continue;
    const sum = g._sum.seats ?? 0;
    if (g.status === "ANGEMELDET") info.taken = sum;
    else info.waiting = sum;
  }
  for (const e of events) {
    const info = out.get(e.id);
    if (info) info.left = seatsLeft(e.capacity, info.taken);
  }
  return out;
}

const upcomingWhere = (now: Date): Prisma.EventWhereInput => ({ OR: [{ startsAt: { gte: startOfDayZurich(now) } }, { endsAt: { gte: now } }] });
const pastWhere = (now: Date): Prisma.EventWhereInput => ({ AND: [{ startsAt: { lt: startOfDayZurich(now) } }, { OR: [{ endsAt: null }, { endsAt: { lt: now } }] }] });

// ---- Öffentlich ------------------------------------------------------------------------------------------------------

const PUBLIC_STATUSES = ["VEROEFFENTLICHT", "ABGESAGT"];

/** Kommende öffentliche Anlässe (veröffentlicht oder abgesagt), nach Beginn sortiert. */
export async function listPublicUpcoming(limit = 50, now: Date = new Date()): Promise<Array<EventCore & { seats: SeatInfo }>> {
  const events = await db.event.findMany({
    where: { isPublic: true, status: { in: PUBLIC_STATUSES }, ...upcomingWhere(now) },
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    take: Math.min(Math.max(limit, 1), 200),
    select: EVENT_VIEW_SELECT,
  });
  const seats = await seatInfoFor(events);
  return events.map((e) => ({ ...e, seats: seats.get(e.id) ?? { taken: 0, waiting: 0, left: null } }));
}

/** Ein öffentlicher Anlass (nur wenn veröffentlicht oder abgesagt und öffentlich sichtbar). */
export async function getPublicEvent(id: string): Promise<(EventCore & { seats: SeatInfo }) | null> {
  const e = await db.event.findFirst({ where: { id, isPublic: true, status: { in: PUBLIC_STATUSES } }, select: EVENT_VIEW_SELECT });
  if (!e) return null;
  const seats = await seatInfoFor([e]);
  return { ...e, seats: seats.get(e.id) ?? { taken: 0, waiting: 0, left: null } };
}

/** Öffentliche Anlässe für den Kalender-Feed: kommende und die der letzten 30 Tage (damit Absagen und Änderungen ankommen). */
export async function listForCalendarFeed(now: Date = new Date()): Promise<EventCore[]> {
  const since = new Date(now.getTime() - 30 * 86_400_000);
  return db.event.findMany({
    where: { isPublic: true, status: { in: PUBLIC_STATUSES }, startsAt: { gte: since } },
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    take: 500,
    select: EVENT_VIEW_SELECT,
  });
}

// ---- Mitgliederportal ------------------------------------------------------------------------------------------------

export type OwnRegistration = { id: string; status: string; seats: number; note: string; createdAt: Date; attendedAt: Date | null };

const ownRegistrationSelect = { id: true, status: true, seats: true, note: true, createdAt: true, attendedAt: true } as const;

/** Kommende Anlässe für ein Mitglied (öffentliche und nur für Mitglieder; keine Entwürfe) mit der eigenen Anmeldung. Filtert nach `memberId`. */
export async function listEventsForMember(memberId: string, now: Date = new Date()): Promise<Array<EventCore & { seats: SeatInfo; own: OwnRegistration | null }>> {
  const events = await db.event.findMany({
    where: { status: { in: PUBLIC_STATUSES }, ...upcomingWhere(now) },
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    take: 100,
    select: { ...EVENT_VIEW_SELECT, registrations: { where: { memberId }, select: ownRegistrationSelect, take: 1 } },
  });
  const seats = await seatInfoFor(events);
  return events.map(({ registrations, ...e }) => ({ ...e, seats: seats.get(e.id) ?? { taken: 0, waiting: 0, left: null }, own: registrations[0] ?? null }));
}

/** Die letzten Anlässe, an denen das Mitglied angemeldet war. */
export async function listPastEventsOfMember(memberId: string, now: Date = new Date(), limit = 10) {
  return db.eventRegistration.findMany({
    where: { memberId, status: "ANGEMELDET", event: { status: "VEROEFFENTLICHT", ...pastWhere(now) } },
    orderBy: { event: { startsAt: "desc" } },
    take: limit,
    select: { id: true, seats: true, attendedAt: true, event: { select: { id: true, title: true, startsAt: true, endsAt: true, location: true } } },
  });
}

/** Ein Anlass für ein Mitglied samt eigener Anmeldung (nicht für Entwürfe). */
export async function getEventForMember(eventId: string, memberId: string): Promise<(EventCore & { seats: SeatInfo; own: OwnRegistration | null }) | null> {
  const e = await db.event.findFirst({
    where: { id: eventId, status: { in: PUBLIC_STATUSES } },
    select: { ...EVENT_VIEW_SELECT, registrations: { where: { memberId }, select: ownRegistrationSelect, take: 1 } },
  });
  if (!e) return null;
  const { registrations, ...rest } = e;
  const seats = await seatInfoFor([rest]);
  return { ...rest, seats: seats.get(e.id) ?? { taken: 0, waiting: 0, left: null }, own: registrations[0] ?? null };
}

// ---- Verwaltung -------------------------------------------------------------------------------------------------------

export type EventFilters = { view: EventView; q: string };

export function parseEventFilters(source: ParamSource): EventFilters {
  const view = firstParam(source, "view");
  return {
    view: (EVENT_VIEWS as readonly string[]).includes(view) ? (view as EventView) : "kommend",
    q: firstParam(source, "q").trim().slice(0, 100),
  };
}

function viewWhere(view: EventView, now: Date): Prisma.EventWhereInput {
  switch (view) {
    case "kommend":
      return { status: "VEROEFFENTLICHT", ...upcomingWhere(now) };
    case "vergangen":
      return { status: "VEROEFFENTLICHT", ...pastWhere(now) };
    case "entwurf":
      return { status: "ENTWURF" };
    case "abgesagt":
      return { status: "ABGESAGT" };
    default:
      return {};
  }
}

const adminListSelect = {
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

export type AdminEventRow = Prisma.EventGetPayload<{ select: typeof adminListSelect }> & { seats: SeatInfo; registrations: number };

export async function listEventsAdmin(filters: EventFilters, skip: number, take: number, now: Date = new Date()): Promise<{ rows: AdminEventRow[]; total: number }> {
  const where: Prisma.EventWhereInput = { ...viewWhere(filters.view, now), ...(filters.q ? searchWhere(filters.q, ["title", "location"]) : {}) };
  const asc = filters.view === "kommend" || filters.view === "entwurf";
  const [rows, total] = await Promise.all([
    db.event.findMany({ where, orderBy: [{ startsAt: asc ? "asc" : "desc" }, { id: "asc" }], skip, take, select: adminListSelect }),
    db.event.count({ where }),
  ]);
  const seats = await seatInfoFor(rows);
  const counts = rows.length
    ? await db.eventRegistration.groupBy({ by: ["eventId"], where: { eventId: { in: rows.map((r) => r.id) }, status: { not: "ABGESAGT" } }, _count: { _all: true } })
    : [];
  const countOf = new Map(counts.map((c) => [c.eventId, c._count._all]));
  return { rows: rows.map((r) => ({ ...r, seats: seats.get(r.id) ?? { taken: 0, waiting: 0, left: null }, registrations: countOf.get(r.id) ?? 0 })), total };
}

/** Anzahl Anlässe je Ansicht für die Filter-Chips. */
export async function eventViewCounts(now: Date = new Date()): Promise<Record<EventView, number>> {
  const entries = await Promise.all(EVENT_VIEWS.map(async (v) => [v, await db.event.count({ where: viewWhere(v, now) })] as const));
  return Object.fromEntries(entries) as Record<EventView, number>;
}

const registrationSelect = {
  id: true,
  memberId: true,
  guestName: true,
  guestEmail: true,
  seats: true,
  status: true,
  note: true,
  consentAt: true,
  promotedAt: true,
  cancelledAt: true,
  attendedAt: true,
  reminderSentAt: true,
  createdAt: true,
  member: { select: { id: true, memberNumber: true, firstName: true, lastName: true, email: true, status: true, anonymizedAt: true } },
} as const satisfies Prisma.EventRegistrationSelect;

export type AdminRegistration = Prisma.EventRegistrationGetPayload<{ select: typeof registrationSelect }>;

/** Anlass mit allen Anmeldungen (ohne Abmelde-Token-Hash). Die Anmeldungen sind nach Anmeldezeit geordnet (Reihenfolge der Warteliste). */
export async function getEventDetail(id: string) {
  return db.event.findUnique({
    where: { id },
    select: { ...EVENT_VIEW_SELECT, createdAt: true, registrations: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 2000, select: registrationSelect } },
  });
}

/** Anmeldungen eines Anlasses für den CSV-Export. */
export async function listRegistrationsForExport(eventId: string): Promise<AdminRegistration[]> {
  return db.eventRegistration.findMany({ where: { eventId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 5000, select: registrationSelect });
}
