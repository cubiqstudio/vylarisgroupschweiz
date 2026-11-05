// Bestätigung der E-Mail-Adresse bei Gast-Anmeldungen (Double-Opt-In) und Aufräumen unbestätigter Anmeldungen (nur auf dem Server).
//
// Ablauf: Eine Gast-Anmeldung ist zuerst «UNBESTAETIGT». Sie belegt keinen Platz und zählt nicht zur Warteliste. Die Mail enthält einen
// signierten Link (48 Stunden). Der Link führt auf eine Seite, die nur anzeigt (describeConfirmToken); erst der Klick auf die Schaltfläche
// (POST) ruft confirmRegistrationByToken auf. So bestätigen Mail-Scanner, die Links vorab abrufen, nichts. Beim Bestätigen wird in einer
// Transaktion, die den Anlass sperrt, ein Platz vergeben oder die Person auf die Warteliste gesetzt: gleichzeitige Bestätigungen
// überbuchen den Anlass nie. Eine zweite Bestätigung ändert nichts.
// Unbestätigte Anmeldungen, die älter als 48 Stunden sind, werden gelöscht (Datensparsamkeit, revDSG).
import "server-only";
import { runInBackground } from "@/lib/account";
import { db } from "@/lib/db";
import { logAudit, SYSTEM_ACTOR } from "./audit";
import { confirmPurgeCutoff, isConfirmationExpired, registrationBlock } from "./events-lib";
import { sendRegistrationMail, type Recipient } from "./events-mail";
import { activateUnconfirmed, confirmSecret, lockedTx, lockEvent, mailEventOf } from "./events-ops";
import { verifyConfirmToken } from "./events-token";

export type ConfirmResult =
  /** Anmeldung gilt, Platz zugeteilt */
  | "CONFIRMED"
  /** Anmeldung gilt, der Anlass ist voll: Warteliste */
  | "WAITLISTED"
  /** war schon bestätigt (zweiter Klick) */
  | "ALREADY"
  /** Frist von 48 Stunden abgelaufen */
  | "EXPIRED"
  /** Anmeldung ist nicht mehr möglich (Anmeldeschluss, Anlass abgesagt oder begonnen) */
  | "CLOSED"
  /** Link ungültig, gefälscht oder die Anmeldung existiert nicht mehr */
  | "UNKNOWN";

export type ConfirmInfo =
  | { state: "READY"; eventTitle: string; startsAt: Date; endsAt: Date | null; location: string; seats: number; expiresAt: Date }
  | { state: "UNKNOWN" | "ALREADY" | "EXPIRED" | "CLOSED"; eventTitle?: string };

const isConfirmed = (status: string) => status === "ANGEMELDET" || status === "WARTELISTE";

/** Zeigt, wozu ein Bestätigungs-Link gehört (ohne etwas zu ändern). Die Seite fragt vor dem Bestätigen nach. */
export async function describeConfirmToken(token: string, now: Date = new Date()): Promise<ConfirmInfo> {
  const check = verifyConfirmToken(confirmSecret(), token, now);
  if (!check.ok && check.reason === "INVALID") return { state: "UNKNOWN" };
  const registrationId = check.registrationId;
  const reg = await db.eventRegistration.findUnique({
    where: { id: registrationId },
    select: { status: true, seats: true, createdAt: true, event: { select: { title: true, startsAt: true, endsAt: true, location: true, status: true, registrationDeadline: true, isPublic: true, membersOnly: true } } },
  });
  if (!reg) return { state: check.ok ? "UNKNOWN" : "EXPIRED" };
  if (isConfirmed(reg.status)) return { state: "ALREADY", eventTitle: reg.event.title };
  if (reg.status !== "UNBESTAETIGT") return { state: "UNKNOWN" };
  if (!check.ok || isConfirmationExpired(reg.createdAt, now)) return { state: "EXPIRED", eventTitle: reg.event.title };
  if (registrationBlock(reg.event, now) || reg.event.membersOnly || !reg.event.isPublic) return { state: "CLOSED", eventTitle: reg.event.title };
  return { state: "READY", eventTitle: reg.event.title, startsAt: reg.event.startsAt, endsAt: reg.event.endsAt, location: reg.event.location, seats: reg.seats, expiresAt: check.expiresAt };
}

/**
 * Bestätigt die E-Mail-Adresse über den Link aus der Mail: Platz zuteilen oder Warteliste, danach geht die Bestätigung mit Abmelde-Link hinaus.
 * Antwortet nur mit dem Ergebnis, nie mit Daten Dritter. Wiederholte Aufrufe sind unschädlich (`ALREADY`).
 */
export async function confirmRegistrationByToken(token: string, now: Date = new Date()): Promise<ConfirmResult> {
  const check = verifyConfirmToken(confirmSecret(), token, now);
  if (!check.ok && check.reason === "INVALID") return "UNKNOWN";
  const registrationId = check.registrationId;
  const found = await db.eventRegistration.findUnique({ where: { id: registrationId }, select: { eventId: true } });
  if (!found) return check.ok ? "UNKNOWN" : "EXPIRED";

  const outcome = await lockedTx(async (tx) => {
    const ev = await lockEvent(tx, found.eventId);
    // Den Stand erst nach dem Sperren lesen: Zwei gleichzeitige Klicks sehen nacheinander «unbestätigt» und «bestätigt».
    const reg = await tx.eventRegistration.findUnique({ where: { id: registrationId }, select: { id: true, status: true, seats: true, createdAt: true, memberId: true, guestName: true, guestEmail: true } });
    if (!reg || reg.memberId !== null) return { result: "UNKNOWN" as const };
    if (isConfirmed(reg.status)) return { result: "ALREADY" as const };
    if (reg.status !== "UNBESTAETIGT") return { result: "UNKNOWN" as const };
    if (!check.ok || isConfirmationExpired(reg.createdAt, now)) return { result: "EXPIRED" as const };
    if (registrationBlock(ev, now) || ev.membersOnly || !ev.isPublic) return { result: "CLOSED" as const };
    const act = await activateUnconfirmed(tx, ev, reg, now);
    return { result: act.status === "ANGEMELDET" ? ("CONFIRMED" as const) : ("WAITLISTED" as const), ev, reg, act };
  });

  if ((outcome.result === "CONFIRMED" || outcome.result === "WAITLISTED") && "act" in outcome) {
    const { ev, reg, act } = outcome;
    const recipient: Recipient = { to: reg.guestEmail, name: reg.guestName, isMember: false };
    if (reg.guestEmail) runInBackground(() => sendRegistrationMail({ recipient, event: mailEventOf(ev), status: act.status, seats: reg.seats, token: act.token }));
  }
  return outcome.result;
}

/**
 * Löscht unbestätigte Gast-Anmeldungen, die älter als 48 Stunden sind (samt Name, E-Mail-Adresse und Bemerkung).
 * Unbestätigte Anmeldungen belegen keinen Platz; das Löschen verändert also weder Belegung noch Warteliste und braucht keine Sperre.
 * Wird täglich vom Cron-Lauf und zusätzlich beim Öffnen eines Anlasses in der Verwaltung aufgerufen.
 */
export async function purgeExpiredUnconfirmedRegistrations(now: Date = new Date()): Promise<{ deleted: number }> {
  const res = await db.eventRegistration.deleteMany({ where: { status: "UNBESTAETIGT", memberId: null, createdAt: { lte: confirmPurgeCutoff(now) } } });
  if (res.count > 0) {
    await logAudit(db, {
      actor: SYSTEM_ACTOR,
      action: "registration.purge",
      objectType: "EventRegistration",
      objectId: null,
      summary: `${res.count} unbestätigte ${res.count === 1 ? "Anmeldung" : "Anmeldungen"} zu Anlässen nach 48 Stunden gelöscht`,
      after: { anzahl: res.count },
    });
  }
  return { deleted: res.count };
}
