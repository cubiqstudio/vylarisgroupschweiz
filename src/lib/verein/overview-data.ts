// Kennzahlen der Übersicht (Dashboard). Jede Gruppe wird nur geladen, wenn die Rolle den Bereich sehen darf, und defensiv berechnet:
// Fällt eine Abfrage aus oder ist ein Modul noch leer, bleibt der Rest der Seite erhalten (das Ergebnis der Gruppe ist dann null).
// Reine Berechnungen: ./overview-lib.ts.
import "server-only";
import { db } from "@/lib/db";
import { parseCronRun, CRON_LAST_RUN_KEY, type CronRun } from "./cron-lib";
import { startOfDayZurich } from "./dates";
import { getLedgerSummary, type LedgerSummary } from "./ledger-data";
import { dashboardSections, groupMissingSettings, summarizeInvoices, type DashboardSections, type InvoiceSummary, type SetupGroup } from "./overview-lib";
import { getVereinSettings, missingForInvitations, missingForInvoicing, missingForReminders } from "./settings";

export type MemberStats = { active: number; byType: Array<{ name: string; count: number }>; applications: number; exitNotices: number };
export type NextMeeting = { id: string; title: string; kind: string; startsAt: Date; status: string; location: string; invitationSentAt: Date | null };
export type UpcomingEvent = { id: string; title: string; startsAt: Date; location: string; capacity: number | null; seatsTaken: number };
export type TaskStats = { open: number; overdue: number; mine: number };

export type VereinDashboard = {
  sections: DashboardSections;
  members: MemberStats | null;
  fees: InvoiceSummary | null;
  ledger: LedgerSummary | null;
  meeting: { next: NextMeeting | null; minutesPending: number } | null;
  events: UpcomingEvent[] | null;
  tasks: TaskStats | null;
  setup: SetupGroup[] | null;
  /** Ergebnis des letzten täglichen Laufs: null = Anzeige nicht erlaubt oder nicht verfügbar, run null = nie gelaufen */
  cron: { run: CronRun | null } | null;
};

/** Führt eine Abfrage aus und liefert bei einem Fehler null (der Fehler wird ohne Inhalte protokolliert). */
async function safe<T>(label: string, run: () => Promise<T>): Promise<T | null> {
  try {
    return await run();
  } catch (e) {
    console.error(`[uebersicht] ${label} nicht verfügbar:`, e instanceof Error ? e.name : "unbekannt");
    return null;
  }
}

async function memberStats(): Promise<MemberStats> {
  const [byTypeRaw, applications, exitNotices, types] = await Promise.all([
    db.member.groupBy({ by: ["membershipTypeId"], where: { status: "AKTIV" }, _count: { _all: true } }),
    db.member.count({ where: { status: "ANTRAG" } }),
    db.member.count({ where: { status: "AKTIV", exitNoticeAt: { not: null } } }),
    db.membershipType.findMany({ select: { id: true, name: true, sortOrder: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  ]);
  const names = new Map(types.map((t) => [t.id, t.name]));
  const order = new Map(types.map((t, i) => [t.id, i]));
  const byType = byTypeRaw
    .map((r) => ({ id: r.membershipTypeId, name: r.membershipTypeId ? (names.get(r.membershipTypeId) ?? "Unbekannte Art") : "Ohne Art", count: r._count._all }))
    .sort((a, b) => (order.get(a.id ?? "") ?? 999) - (order.get(b.id ?? "") ?? 999))
    .map(({ name, count }) => ({ name, count }));
  return { active: byType.reduce((sum, t) => sum + t.count, 0), byType, applications, exitNotices };
}

async function invoiceStats(): Promise<InvoiceSummary> {
  const rows = await db.invoice.findMany({ where: { status: "OFFEN" }, select: { status: true, totalRappen: true, paidRappen: true, dueDate: true } });
  return summarizeInvoices(rows);
}

async function meetingStats(): Promise<{ next: NextMeeting | null; minutesPending: number }> {
  const today = startOfDayZurich(new Date());
  const [next, minutesPending] = await Promise.all([
    db.meeting.findFirst({
      where: { status: { in: ["GEPLANT", "EINGELADEN"] }, startsAt: { gte: today } },
      orderBy: { startsAt: "asc" },
      select: { id: true, title: true, kind: true, startsAt: true, status: true, location: true, invitationSentAt: true },
    }),
    // Durchgeführte Sitzungen, deren Protokoll noch nicht genehmigt ist
    db.meeting.count({ where: { status: "DURCHGEFUEHRT", minutesApprovedAt: null } }),
  ]);
  return { next, minutesPending };
}

async function upcomingEvents(): Promise<UpcomingEvent[]> {
  const events = await db.event.findMany({
    where: { status: "VEROEFFENTLICHT", startsAt: { gte: new Date() } },
    orderBy: { startsAt: "asc" },
    take: 3,
    select: { id: true, title: true, startsAt: true, location: true, capacity: true },
  });
  if (events.length === 0) return [];
  const seats = await db.eventRegistration.groupBy({ by: ["eventId"], where: { eventId: { in: events.map((e) => e.id) }, status: "ANGEMELDET" }, _sum: { seats: true } });
  const taken = new Map(seats.map((s) => [s.eventId, s._sum.seats ?? 0]));
  return events.map((e) => ({ ...e, seatsTaken: taken.get(e.id) ?? 0 }));
}

async function taskStats(me: { adminId: string; memberId: string | null }): Promise<TaskStats> {
  const today = startOfDayZurich(new Date());
  const notDone = { status: { not: "ERLEDIGT" } } as const;
  const mine = [{ assigneeAdminId: me.adminId }, ...(me.memberId ? [{ assigneeMemberId: me.memberId }] : [])];
  const [open, overdue, mineCount] = await Promise.all([
    db.boardTask.count({ where: notDone }),
    db.boardTask.count({ where: { ...notDone, dueDate: { lt: today } } }),
    db.boardTask.count({ where: { ...notDone, OR: mine } }),
  ]);
  return { open, overdue, mine: mineCount };
}

async function setupHints(): Promise<SetupGroup[]> {
  const s = await getVereinSettings();
  return groupMissingSettings(missingForInvoicing(s), missingForReminders(s), missingForInvitations(s));
}

async function cronStatus(): Promise<{ run: CronRun | null }> {
  const row = await db.siteSetting.findUnique({ where: { key: CRON_LAST_RUN_KEY }, select: { value: true } });
  return { run: parseCronRun(row?.value) };
}

/** Kennzahlen für die Übersicht der angemeldeten Person. Nur Bereiche, die ihre Rollen sehen dürfen, werden berechnet. */
export async function loadVereinDashboard(admin: { id: string; roles: readonly string[]; memberId: string | null }): Promise<VereinDashboard> {
  const sections = dashboardSections(admin.roles);
  const [members, fees, ledger, meeting, events, tasks, setup, cron] = await Promise.all([
    sections.members ? safe("Mitglieder", memberStats) : null,
    sections.fees ? safe("Rechnungen", invoiceStats) : null,
    sections.ledger ? safe("Kasse", getLedgerSummary) : null,
    sections.meetings ? safe("Versammlungen", meetingStats) : null,
    sections.events ? safe("Anlässe", upcomingEvents) : null,
    sections.tasks ? safe("Aufgaben", () => taskStats({ adminId: admin.id, memberId: admin.memberId })) : null,
    sections.setup ? safe("Einrichtung", setupHints) : null,
    sections.cron ? safe("Täglicher Lauf", cronStatus) : null,
  ]);
  return { sections, members, fees, ledger, meeting, events, tasks, setup, cron };
}
