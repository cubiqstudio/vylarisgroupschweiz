// Tests gegen eine eigene, leere SQLite-Datenbank (Datei im Temp-Ordner): Double-Opt-In für Gast-Anmeldungen zu Anlässen.
// Unbestätigt belegt keinen Platz; die Bestätigung vergibt Platz oder Warteliste; Idempotenz, Fristen, Drosselung, Aufräumen.
// Die Entwicklungsdatenbank bleibt unberührt.
// Aufruf:  npx tsx scripts/test/events-confirm.test.mts
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

const dir = mkdtempSync(join(tmpdir(), "vgs-events-confirm-"));
process.env.DATABASE_URL = `file:${join(dir, "test.db")}`;
process.env.AUTH_SECRET = "ein-geheimnis-fuer-den-test-mindestens-32-zeichen";

const require = createRequire(import.meta.url);
const serverOnlyPath = require.resolve("server-only");
require.cache[serverOnlyPath] = { id: serverOnlyPath, filename: serverOnlyPath, loaded: true, exports: {}, children: [], paths: [] } as unknown as NodeJS.Module;

execFileSync("npx", ["prisma", "db", "push", "--skip-generate", "--accept-data-loss"], { env: process.env, stdio: "pipe" });

const { db } = await import("../../src/lib/db.ts");
const eventsData = await import("../../src/lib/verein/events-data.ts");
const ops = await import("../../src/lib/verein/events-ops.ts");
const confirm = await import("../../src/lib/verein/events-confirm.ts");
const lib = await import("../../src/lib/verein/events-lib.ts");
const audit = await import("../../src/lib/verein/audit.ts");
const tokens = await import("../../src/lib/verein/events-token.ts");

after(async () => {
  await db.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

const admin = { id: "adm1", email: "a@example.test", name: "Test Admin", role: "ADMIN", roles: ["ADMIN"] as never, memberId: null, mustChangePassword: false };
const inDays = (days: number) => new Date(Date.now() + days * 86_400_000);
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000);

let n = 0;
async function makeEvent(capacity: number | null) {
  n += 1;
  return db.event.create({ data: { title: `Anlass ${n}`, startsAt: inDays(30), status: "VEROEFFENTLICHT", isPublic: true, membersOnly: false, capacity } });
}
async function guest(eventId: string, email: string, seats = 1, now?: Date) {
  return ops.registerForEvent({ eventId, who: { kind: "guest", name: `Gast ${email}`, email, consent: true }, seats, note: "", sendMail: false, now });
}
/** Link-Token, wie er in der Mail steht (gültig bis 48 Stunden nach Eingang). */
async function tokenFor(registrationId: string) {
  const reg = await db.eventRegistration.findUniqueOrThrow({ where: { id: registrationId }, select: { createdAt: true } });
  return tokens.signConfirmToken(ops.confirmSecret(), registrationId, lib.confirmExpiresAt(reg.createdAt));
}
const seatInfo = async (e: { id: string; capacity: number | null }) => (await eventsData.seatInfoFor([e])).get(e.id)!;

test("Gast-Anmeldung ist unbestätigt, belegt keinen Platz und steht nicht auf der Warteliste", async () => {
  const ev = await makeEvent(2);
  const r = await guest(ev.id, "a@example.test", 2);
  assert.equal(r.status, "UNBESTAETIGT");
  assert.equal(r.created, true);
  assert.deepEqual(await seatInfo(ev), { taken: 0, waiting: 0, left: 2 });
  // Der Platz ist weiterhin frei: eine zweite Person bekommt ihn nach der Bestätigung.
  const other = await guest(ev.id, "b@example.test", 2);
  assert.equal(await confirm.confirmRegistrationByToken(await tokenFor(other.registrationId)), "CONFIRMED");
  assert.deepEqual(await seatInfo(ev), { taken: 2, waiting: 0, left: 0 });
  const row = await db.eventRegistration.findUniqueOrThrow({ where: { id: r.registrationId } });
  assert.equal(row.status, "UNBESTAETIGT");
  assert.equal(row.consentAt !== null, true, "die Einwilligung ist festgehalten");
});

test("Bestätigung vergibt den Platz und erzeugt den Abmelde-Link", async () => {
  const ev = await makeEvent(3);
  const r = await guest(ev.id, "platz@example.test");
  const before = await db.eventRegistration.findUniqueOrThrow({ where: { id: r.registrationId } });
  assert.equal(await confirm.confirmRegistrationByToken(await tokenFor(r.registrationId)), "CONFIRMED");
  const after = await db.eventRegistration.findUniqueOrThrow({ where: { id: r.registrationId } });
  assert.equal(after.status, "ANGEMELDET");
  assert.notEqual(after.cancelTokenHash, before.cancelTokenHash);
  assert.deepEqual(await seatInfo(ev), { taken: 1, waiting: 0, left: 2 });
});

test("Bestätigung bei vollem Anlass: Warteliste in der Reihenfolge der Bestätigung", async () => {
  const ev = await makeEvent(1);
  const first = await guest(ev.id, "erste@example.test");
  const second = await guest(ev.id, "zweite@example.test");
  // Die zweite Person bestätigt zuerst und bekommt den Platz, obwohl sie sich später angemeldet hat.
  assert.equal(await confirm.confirmRegistrationByToken(await tokenFor(second.registrationId)), "CONFIRMED");
  assert.equal(await confirm.confirmRegistrationByToken(await tokenFor(first.registrationId)), "WAITLISTED");
  assert.equal((await db.eventRegistration.findUniqueOrThrow({ where: { id: first.registrationId } })).status, "WARTELISTE");
  assert.deepEqual(await seatInfo(ev), { taken: 1, waiting: 1, left: 0 });
  // Wird der Platz frei, rückt die Wartende nach.
  await ops.adminRegistrationAction(admin as never, ev.id, second.registrationId, { action: "cancel", sendMail: false });
  assert.equal((await db.eventRegistration.findUniqueOrThrow({ where: { id: first.registrationId } })).status, "ANGEMELDET");
});

test("Doppelte Bestätigung ist unschädlich: zweiter Klick ändert nichts", async () => {
  const ev = await makeEvent(5);
  const r = await guest(ev.id, "doppelt@example.test", 2);
  const t = await tokenFor(r.registrationId);
  assert.equal(await confirm.confirmRegistrationByToken(t), "CONFIRMED");
  const afterFirst = await db.eventRegistration.findUniqueOrThrow({ where: { id: r.registrationId } });
  assert.equal(await confirm.confirmRegistrationByToken(t), "ALREADY");
  const afterSecond = await db.eventRegistration.findUniqueOrThrow({ where: { id: r.registrationId } });
  assert.equal(afterSecond.cancelTokenHash, afterFirst.cancelTokenHash, "der Abmelde-Link wird nicht erneut erzeugt");
  assert.equal(afterSecond.createdAt.getTime(), afterFirst.createdAt.getTime());
  assert.deepEqual(await seatInfo(ev), { taken: 2, waiting: 0, left: 3 });
});

test("Gleichzeitige Bestätigungen überbuchen den Anlass nie", async () => {
  // Mehr gleichzeitige Transaktionen verträgt die Test-SQLite nicht zuverlässig (PostgreSQL sperrt die Zeile des Anlasses).
  const ev = await makeEvent(2);
  const regs = [];
  for (const i of [1, 2, 3, 4]) regs.push(await guest(ev.id, `rennen${i}@example.test`));
  const tokensList = await Promise.all(regs.map((r) => tokenFor(r.registrationId)));
  const results = await Promise.all(tokensList.map((t) => confirm.confirmRegistrationByToken(t)));
  assert.equal(results.filter((r) => r === "CONFIRMED").length, 2);
  assert.equal(results.filter((r) => r === "WAITLISTED").length, 2);
  assert.deepEqual(await seatInfo(ev), { taken: 2, waiting: 2, left: 0 });

  // Derselbe Link zweimal gleichzeitig (Doppelklick): genau eine Bestätigung, die andere meldet «bereits bestätigt»
  const solo = await makeEvent(1);
  const r = await guest(solo.id, "doppelklick@example.test");
  const t = await tokenFor(r.registrationId);
  const both = await Promise.all([confirm.confirmRegistrationByToken(t), confirm.confirmRegistrationByToken(t)]);
  assert.deepEqual([...both].sort(), ["ALREADY", "CONFIRMED"]);
  assert.deepEqual(await seatInfo(solo), { taken: 1, waiting: 0, left: 0 });
});

test("Abgelaufener, gefälschter und unbekannter Link bestätigt nichts", async () => {
  const ev = await makeEvent(5);
  const r = await guest(ev.id, "frist@example.test");
  const t = await tokenFor(r.registrationId);

  // gefälscht: Signatur verändert, andere Anmeldung, Müll
  const [id, ms, sig] = t.split(".") as [string, string, string];
  assert.equal(await confirm.confirmRegistrationByToken(`${id}.${ms}.${sig.slice(0, -1)}${sig.endsWith("A") ? "B" : "A"}`), "UNKNOWN");
  assert.equal(await confirm.confirmRegistrationByToken(`${id}.${Number(ms) + 3_600_000}.${sig}`), "UNKNOWN");
  assert.equal(await confirm.confirmRegistrationByToken("kein-token"), "UNKNOWN");
  const foreign = tokens.signConfirmToken("fremdes-geheimnis-fremdes-geheimnis-xx", r.registrationId, new Date(Date.now() + 3_600_000));
  assert.equal(await confirm.confirmRegistrationByToken(foreign), "UNKNOWN");
  const missing = tokens.signConfirmToken(ops.confirmSecret(), "gibt_es_nicht", new Date(Date.now() + 3_600_000));
  assert.equal(await confirm.confirmRegistrationByToken(missing), "UNKNOWN");

  // abgelaufen: nach 48 Stunden
  const late = new Date(Date.now() + 49 * 3_600_000);
  assert.equal(await confirm.confirmRegistrationByToken(t, late), "EXPIRED");
  assert.deepEqual(await confirm.describeConfirmToken(t, late), { state: "EXPIRED", eventTitle: ev.title });

  // auch mit einem Token mit fernem Ablauf, aber alter Anmeldung (Datenbank ist massgebend)
  await db.eventRegistration.update({ where: { id: r.registrationId }, data: { createdAt: hoursAgo(50) } });
  const farToken = tokens.signConfirmToken(ops.confirmSecret(), r.registrationId, new Date(Date.now() + 10 * 86_400_000));
  assert.equal(await confirm.confirmRegistrationByToken(farToken), "EXPIRED");

  assert.equal((await db.eventRegistration.findUniqueOrThrow({ where: { id: r.registrationId } })).status, "UNBESTAETIGT");
  assert.deepEqual(await seatInfo(ev), { taken: 0, waiting: 0, left: 5 });
});

test("Die Seite zum Link ändert nichts (describe), erst die Bestätigung tut es", async () => {
  const ev = await makeEvent(5);
  const r = await guest(ev.id, "scanner@example.test", 2);
  const t = await tokenFor(r.registrationId);
  for (let i = 0; i < 3; i++) {
    const info = await confirm.describeConfirmToken(t);
    assert.equal(info.state, "READY");
    if (info.state === "READY") {
      assert.equal(info.eventTitle, ev.title);
      assert.equal(info.seats, 2);
    }
  }
  assert.equal((await db.eventRegistration.findUniqueOrThrow({ where: { id: r.registrationId } })).status, "UNBESTAETIGT");
  assert.equal((await confirm.describeConfirmToken("kein-token")).state, "UNKNOWN");
  await confirm.confirmRegistrationByToken(t);
  assert.equal((await confirm.describeConfirmToken(t)).state, "ALREADY");
});

test("Nach Absage oder Anmeldeschluss lässt sich nicht mehr bestätigen", async () => {
  const cancelled = await makeEvent(5);
  const a = await guest(cancelled.id, "abgesagt@example.test");
  await db.event.update({ where: { id: cancelled.id }, data: { status: "ABGESAGT" } });
  assert.equal(await confirm.confirmRegistrationByToken(await tokenFor(a.registrationId)), "CLOSED");

  const deadline = await makeEvent(5);
  const b = await guest(deadline.id, "schluss@example.test");
  await db.event.update({ where: { id: deadline.id }, data: { registrationDeadline: hoursAgo(1) } });
  assert.equal(await confirm.confirmRegistrationByToken(await tokenFor(b.registrationId)), "CLOSED");
  assert.equal((await db.eventRegistration.findUniqueOrThrow({ where: { id: b.registrationId } })).status, "UNBESTAETIGT");
});

test("Dieselbe Adresse erneut: keine Dublette, gleiche Antwort, Versand höchstens alle paar Minuten", async () => {
  const ev = await makeEvent(5);
  const t0 = new Date();
  const first = await guest(ev.id, "wieder@example.test", 1, t0);
  const sentAt = (await db.eventRegistration.findUniqueOrThrow({ where: { id: first.registrationId } })).confirmSentAt;
  assert.equal(sentAt?.getTime(), t0.getTime());

  // Sofort erneut: dieselbe Anmeldung, kein neuer Versand (confirmSentAt bleibt)
  const again = await guest(ev.id, "wieder@example.test", 4, new Date(t0.getTime() + 60_000));
  assert.equal(again.registrationId, first.registrationId);
  assert.equal(again.status, "UNBESTAETIGT");
  assert.equal(again.created, false);
  assert.equal((await db.eventRegistration.findUniqueOrThrow({ where: { id: first.registrationId } })).confirmSentAt?.getTime(), t0.getTime());
  assert.equal((await db.eventRegistration.findUniqueOrThrow({ where: { id: first.registrationId } })).seats, 1, "fremde offene Angaben werden nicht überschrieben");

  // Nach der Drosselung: erneuter Versand wird festgehalten
  const later = new Date(t0.getTime() + (lib.CONFIRM_RESEND_MINUTES + 1) * 60_000);
  await guest(ev.id, "wieder@example.test", 1, later);
  assert.equal((await db.eventRegistration.findUniqueOrThrow({ where: { id: first.registrationId } })).confirmSentAt?.getTime(), later.getTime());

  assert.equal(await db.eventRegistration.count({ where: { eventId: ev.id, guestEmail: "wieder@example.test" } }), 1);

  // Nach der Bestätigung ist die Adresse bekannt: wieder keine Dublette, und die Anmeldung bleibt bestätigt
  await confirm.confirmRegistrationByToken(await tokenFor(first.registrationId));
  const known = await guest(ev.id, "wieder@example.test");
  assert.equal(known.registrationId, first.registrationId);
  assert.equal(known.created, false);
  assert.equal(await db.eventRegistration.count({ where: { eventId: ev.id, guestEmail: "wieder@example.test" } }), 1);
});

test("Abgelaufene unbestätigte Anmeldung wird bei erneuter Anmeldung ersetzt", async () => {
  const ev = await makeEvent(5);
  const old = await guest(ev.id, "alt@example.test");
  await db.eventRegistration.update({ where: { id: old.registrationId }, data: { createdAt: hoursAgo(49) } });
  const fresh = await guest(ev.id, "alt@example.test");
  assert.notEqual(fresh.registrationId, old.registrationId);
  assert.equal(fresh.created, true);
  assert.equal(await db.eventRegistration.count({ where: { eventId: ev.id, guestEmail: "alt@example.test" } }), 1);
});

test("Mitglieder und Anmeldungen des Vorstands brauchen keine Bestätigung", async () => {
  const ev = await makeEvent(5);
  const member = await db.member.create({ data: { memberNumber: 9001, firstName: "Mia", lastName: "Muster", email: "mia@example.test", status: "AKTIV" } });
  const m = await ops.registerForEvent({ eventId: ev.id, who: { kind: "member", member }, seats: 1, note: "", sendMail: false });
  assert.equal(m.status, "ANGEMELDET");
  const g = await ops.registerForEvent({ eventId: ev.id, who: { kind: "guest", name: "Telefon", email: "tel@example.test", consent: false }, seats: 1, note: "", admin: { actor: audit.auditActor(admin as never), force: false }, sendMail: false });
  assert.equal(g.status, "ANGEMELDET");
});

test("Vorstand bestätigt von Hand: Platz oder Warteliste, mit Änderungsprotokoll", async () => {
  const ev = await makeEvent(1);
  const a = await guest(ev.id, "hand1@example.test");
  const b = await guest(ev.id, "hand2@example.test");
  assert.deepEqual(await ops.adminRegistrationAction(admin as never, ev.id, a.registrationId, { action: "confirm", force: false, sendMail: false }), { status: "ANGEMELDET" });
  assert.deepEqual(await ops.adminRegistrationAction(admin as never, ev.id, b.registrationId, { action: "confirm", force: false, sendMail: false }), { status: "WARTELISTE" });
  await assert.rejects(ops.adminRegistrationAction(admin as never, ev.id, a.registrationId, { action: "confirm", force: false, sendMail: false }), /unbestätigter/);
  const logs = await db.auditLog.findMany({ where: { action: "registration.confirm" } });
  assert.ok(logs.length >= 2);
  assert.ok(logs.every((l) => l.summary.includes("von Hand bestätigt")));
  // Der Link aus der Mail nützt danach nichts mehr
  assert.equal(await confirm.confirmRegistrationByToken(await tokenFor(a.registrationId)), "ALREADY");
});

test("Aufräumen: unbestätigte Anmeldungen nach 48 Stunden löschen, alles andere bleibt", async () => {
  await db.eventRegistration.deleteMany({ where: { status: "UNBESTAETIGT" } });
  const ev = await makeEvent(10);
  const stale1 = await guest(ev.id, "stale1@example.test");
  const stale2 = await guest(ev.id, "stale2@example.test");
  const fresh = await guest(ev.id, "fresh@example.test");
  const confirmed = await guest(ev.id, "confirmed@example.test");
  await confirm.confirmRegistrationByToken(await tokenFor(confirmed.registrationId));
  await db.eventRegistration.update({ where: { id: stale1.registrationId }, data: { createdAt: hoursAgo(48) } });
  await db.eventRegistration.update({ where: { id: stale2.registrationId }, data: { createdAt: hoursAgo(100) } });
  await db.eventRegistration.update({ where: { id: fresh.registrationId }, data: { createdAt: hoursAgo(47) } });
  await db.eventRegistration.update({ where: { id: confirmed.registrationId }, data: { createdAt: hoursAgo(500) } });

  assert.deepEqual(await confirm.purgeExpiredUnconfirmedRegistrations(), { deleted: 2 });
  assert.equal(await db.eventRegistration.findUnique({ where: { id: stale1.registrationId } }), null);
  assert.equal(await db.eventRegistration.findUnique({ where: { id: stale2.registrationId } }), null);
  assert.notEqual(await db.eventRegistration.findUnique({ where: { id: fresh.registrationId } }), null);
  assert.equal((await db.eventRegistration.findUniqueOrThrow({ where: { id: confirmed.registrationId } })).status, "ANGEMELDET");
  assert.deepEqual(await seatInfo(ev), { taken: 1, waiting: 0, left: 9 });

  const log = await db.auditLog.findFirst({ where: { action: "registration.purge" }, orderBy: { createdAt: "desc" } });
  assert.ok(log?.summary.includes("2 unbestätigte Anmeldungen"));
  // zweiter Lauf: nichts mehr zu tun, kein weiterer Protokolleintrag
  const logsBefore = await db.auditLog.count({ where: { action: "registration.purge" } });
  assert.deepEqual(await confirm.purgeExpiredUnconfirmedRegistrations(), { deleted: 0 });
  assert.equal(await db.auditLog.count({ where: { action: "registration.purge" } }), logsBefore);
});
