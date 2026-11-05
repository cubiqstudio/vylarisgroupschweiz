// Personendaten von Gästen bei Anlässen (nur auf dem Server): Entfernen nach dem Anlass (täglicher Lauf) sowie Auskunft und Löschung
// über alle Anlässe per E-Mail-Adresse (revDSG Art. 25 und Art. 32; Datenschutzerklärung, Abschnitt «Anlässe»).
//
// Gast-Anmeldungen haben nie eine memberId. Die Auskunft über Mitglieder (members-data.ts, loadDisclosure) findet sie deshalb nicht.
// Hier wird nach der E-Mail-Adresse gesucht, mit der sich die Person angemeldet hat.
//
// «Entfernen» heisst anonymisieren: Name, E-Mail-Adresse und Bemerkung werden geleert, die Anmeldung bleibt als Zahl der Plätze und
// Status für die Statistik des Anlasses bestehen. In früheren Protokolleinträgen zu diesen Anmeldungen werden Namen unkenntlich gemacht.
import "server-only";
import type { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api";
import type { CurrentAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { auditActor, logAudit, SYSTEM_ACTOR } from "./audit";
import { guestRetentionCutoff, GUEST_AUDIT_SCRUBBED_SUMMARY } from "./events-lib";
import { lockedTx, lockEvent, mailEventOf, mailPromoted, promoteWaitlist } from "./events-ops";
import { scrubPersonalAuditJson } from "./members-lib";

type Tx = Prisma.TransactionClient;

const BATCH = 400;

/** Macht Namen in Protokolleinträgen zu den genannten Anmeldungen unkenntlich (Zusammenfassung und Vorher/Nachher). */
async function scrubRegistrationAudit(tx: Tx, registrationIds: readonly string[]): Promise<void> {
  if (registrationIds.length === 0) return;
  const entries = await tx.auditLog.findMany({
    where: { objectType: "EventRegistration", objectId: { in: [...registrationIds] } },
    select: { id: true, before: true, after: true },
  });
  for (const e of entries) {
    await tx.auditLog.update({ where: { id: e.id }, data: { summary: GUEST_AUDIT_SCRUBBED_SUMMARY, before: scrubPersonalAuditJson(e.before), after: scrubPersonalAuditJson(e.after) } });
  }
}

/** Gast-Anmeldungen (ohne Mitglied), die noch Personendaten tragen und deren Anlass vor dem Stichtag zu Ende ging. */
export function pastGuestWhere(now: Date): Prisma.EventRegistrationWhereInput {
  const cutoff = guestRetentionCutoff(now);
  return {
    memberId: null,
    status: { in: ["ANGEMELDET", "WARTELISTE", "ABGESAGT"] },
    OR: [{ guestName: { not: "" } }, { guestEmail: { not: "" } }, { note: { not: "" } }],
    event: { OR: [{ endsAt: { lt: cutoff } }, { endsAt: null, startsAt: { lt: cutoff } }] },
  };
}

/**
 * Tagesaufgabe: Entfernt Name, E-Mail-Adresse und Bemerkung bestätigter Gast-Anmeldungen, sobald GUEST_RETENTION_DAYS seit dem Ende des
 * Anlasses vergangen sind. Wiederholbar (bereits geleerte Anmeldungen werden nicht mehr gefunden). Protokoll: Akteur «System», ohne Namen.
 */
export async function anonymizePastGuestRegistrations(now: Date = new Date()): Promise<{ anonymized: number }> {
  let total = 0;
  for (;;) {
    const batch = await db.eventRegistration.findMany({ where: pastGuestWhere(now), orderBy: { id: "asc" }, take: BATCH, select: { id: true } });
    if (batch.length === 0) break;
    const ids = batch.map((r) => r.id);
    await db.$transaction(async (tx) => {
      await tx.eventRegistration.updateMany({ where: { id: { in: ids }, memberId: null }, data: { guestName: "", guestEmail: "", note: "" } });
      await scrubRegistrationAudit(tx, ids);
    });
    total += ids.length;
    if (batch.length < BATCH) break;
  }
  if (total > 0) {
    await logAudit(db, {
      actor: SYSTEM_ACTOR,
      action: "registration.anonymize",
      objectType: "EventRegistration",
      objectId: null,
      summary: `Angaben von Gästen zu ${total} ${total === 1 ? "Anmeldung" : "Anmeldungen"} vergangener Anlässe entfernt`,
      after: { anzahl: total },
    });
  }
  return { anonymized: total };
}

// ---- Auskunft und Löschung per E-Mail-Adresse ----------------------------------------------------------------------------

export type GuestRegistrationRow = {
  id: string;
  eventId: string;
  eventTitle: string;
  startsAt: Date;
  guestName: string;
  guestEmail: string;
  seats: number;
  status: string;
  note: string;
  consentAt: Date | null;
  createdAt: Date;
};

const MAX_ROWS = 1000;

function emailWhere(email: string): Prisma.EventRegistrationWhereInput {
  const e = email.trim();
  const lower = e.toLowerCase();
  return { memberId: null, guestEmail: { in: lower === e ? [e] : [e, lower] } };
}

/** Alle Gast-Anmeldungen zu einer E-Mail-Adresse über alle Anlässe (auch unbestätigte und abgesagte), neueste zuerst. */
export async function findGuestRegistrations(email: string): Promise<GuestRegistrationRow[]> {
  const e = email.trim();
  if (!e) return [];
  const rows = await db.eventRegistration.findMany({
    where: emailWhere(e),
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: MAX_ROWS,
    select: { id: true, eventId: true, guestName: true, guestEmail: true, seats: true, status: true, note: true, consentAt: true, createdAt: true, event: { select: { title: true, startsAt: true } } },
  });
  return rows.map(({ event, ...r }) => ({ ...r, eventTitle: event.title, startsAt: event.startsAt }));
}

/** Protokolliert eine Auskunft (ohne E-Mail-Adresse und Namen im Text) und gibt die Treffer zurück. */
export async function discloseGuestData(admin: CurrentAdmin, email: string): Promise<GuestRegistrationRow[]> {
  const rows = await findGuestRegistrations(email);
  await logAudit(db, {
    actor: auditActor(admin),
    action: "export.guest-disclosure",
    objectType: "EventRegistration",
    summary: `Auskunft über Gast-Anmeldungen zu einer E-Mail-Adresse bezogen (${rows.length} ${rows.length === 1 ? "Anmeldung" : "Anmeldungen"})`,
    after: { anzahl: rows.length },
  });
  return rows;
}

/**
 * Löscht alle Gast-Anmeldungen zu einer E-Mail-Adresse samt Personendaten (Anfrage der betroffenen Person). Belegte Plätze werden frei,
 * Wartende rücken nach. Im Protokoll steht weder die Adresse noch ein Name; frühere Einträge zu diesen Anmeldungen werden unkenntlich gemacht.
 */
export async function deleteGuestRegistrations(admin: CurrentAdmin, email: string, now: Date = new Date()): Promise<{ deleted: number }> {
  const e = email.trim();
  if (!e) throw new ApiError(422, "VALIDATION_ERROR", "Ungültige Eingabe.", { email: "Bitte eine E-Mail-Adresse angeben." });
  const found = await db.eventRegistration.findMany({ where: emailWhere(e), select: { eventId: true }, take: MAX_ROWS });
  const eventIds = [...new Set(found.map((r) => r.eventId))];
  let deleted = 0;
  for (const eventId of eventIds) {
    const { ev, promoted, count } = await lockedTx(async (tx) => {
      const ev = await lockEvent(tx, eventId);
      // Erst nach dem Sperren lesen: gleichzeitige Bestätigungen oder Absagen werden so nicht übergangen.
      const regs = await tx.eventRegistration.findMany({ where: { ...emailWhere(e), eventId }, select: { id: true, status: true } });
      if (regs.length === 0) return { ev, promoted: [], count: 0 };
      const ids = regs.map((r) => r.id);
      await scrubRegistrationAudit(tx, ids);
      await tx.eventRegistration.deleteMany({ where: { id: { in: ids }, memberId: null } });
      for (const id of ids) {
        await logAudit(tx, { actor: auditActor(admin), action: "registration.guest-delete", objectType: "EventRegistration", objectId: id, summary: `Anmeldung eines Gasts für «${ev.title}» auf Anfrage gelöscht` });
      }
      const freed = regs.some((r) => r.status === "ANGEMELDET");
      return { ev, promoted: freed ? await promoteWaitlist(tx, ev, now) : [], count: ids.length };
    });
    deleted += count;
    mailPromoted(mailEventOf(ev), promoted);
  }
  return { deleted };
}
