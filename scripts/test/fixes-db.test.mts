// Tests gegen eine eigene, leere SQLite-Datenbank (Temp-Ordner) zu den Befunden der Gegenprüfung:
// Änderungsprotokoll und Vorstandsdokumente, Gast-Angaben nach dem Anlass, Auskunft und Löschung für Gäste, Fristen, Bestätigungsseite.
// Aufruf:  npx tsx scripts/test/fixes-db.test.mts
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

const dir = mkdtempSync(join(tmpdir(), "vgs-fixes-db-"));
process.env.DATABASE_URL = `file:${join(dir, "test.db")}`;
process.env.AUTH_SECRET = "ein-geheimnis-fuer-den-test-mindestens-32-zeichen";

const require = createRequire(import.meta.url);
const serverOnlyPath = require.resolve("server-only");
require.cache[serverOnlyPath] = { id: serverOnlyPath, filename: serverOnlyPath, loaded: true, exports: {}, children: [], paths: [] } as unknown as NodeJS.Module;

execFileSync("npx", ["prisma", "db", "push", "--skip-generate", "--accept-data-loss"], { env: process.env, stdio: "pipe" });

const { db } = await import("../../src/lib/db.ts");
const documentsData = await import("../../src/lib/verein/documents-data.ts");
const auditData = await import("../../src/lib/verein/audit-data.ts");
const eventsData = await import("../../src/lib/verein/events-data.ts");
const ops = await import("../../src/lib/verein/events-ops.ts");
const confirm = await import("../../src/lib/verein/events-confirm.ts");
const guests = await import("../../src/lib/verein/events-guests.ts");
const lib = await import("../../src/lib/verein/events-lib.ts");
const tokens = await import("../../src/lib/verein/events-token.ts");
const cron = await import("../../src/lib/verein/cron.ts");

after(async () => {
  await db.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

const admin = { id: "adm1", email: "a@example.test", name: "Test Admin", role: "ADMIN", roles: ["ADMIN"] as never, memberId: null, mustChangePassword: false };
const day = 86_400_000;
const inDays = (d: number) => new Date(Date.now() + d * day);
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000);
const allAudit = async () => db.auditLog.findMany({ orderBy: { createdAt: "asc" } });
const text = (rows: unknown) => JSON.stringify(rows);

// ---- Änderungsprotokoll und Vorstandsdokumente --------------------------------------------------------------------------------

const upload = (fileName: string, sha: string) => ({ ok: true as const, kind: "pdf" as const, mimeType: "application/pdf", sizeBytes: 12, sha256: sha, fileName, data: Buffer.from("%PDF-1.7 test") });

test("Vorstandsdokument: Änderungsprotokoll nennt weder Titel noch Dateiname noch Beschreibung (alle Vorgänge)", async () => {
  const doc = await documentsData.createDocument(admin as never, { title: "Geheimer Vorstandsbeschluss", description: "Geheime Beschreibung", category: "PROTOKOLL", visibility: "VORSTAND", meetingId: null, changeNote: "" } as never, upload("geheim-datei.pdf", "a".repeat(64)));
  await documentsData.addDocumentVersion(admin as never, doc.id, upload("geheim-v2.pdf", "b".repeat(64)), "neu");
  await documentsData.updateDocument(admin as never, doc.id, { title: "Anderer geheimer Titel", description: "Andere geheime Beschreibung" } as never);
  await documentsData.updateDocument(admin as never, doc.id, { archived: true } as never);
  await documentsData.deleteDocument(admin as never, doc.id);
  // Freigabe eines Vorstandsdokuments: Der Eintrag zur Freigabe selbst bleibt neutral (vorher war es geheim).
  const released = await documentsData.createDocument(admin as never, { title: "Geheimer Entwurf", description: "", category: "SONSTIGES", visibility: "VORSTAND", meetingId: null, changeNote: "" } as never, upload("geheim-entwurf.pdf", "d".repeat(64)));
  await documentsData.updateDocument(admin as never, released.id, { visibility: "MITGLIEDER" } as never);
  const rows = (await allAudit()).filter((r) => r.objectType === "Document" && (r.objectId === doc.id || r.objectId === released.id));
  assert.equal(rows.length, 7);
  const json = text(rows);
  for (const secret of ["Geheimer", "geheim", "Geheime", "Anderer", "Andere", "Vorstandsbeschluss", "Beschreibung", "a".repeat(64)]) assert.ok(!json.includes(secret), `Protokoll verrät «${secret}»: ${json}`);
  assert.ok(rows[0].summary.startsWith("Dokument (Nur Vorstand) hochgeladen"), rows[0].summary);
  assert.ok(rows.every((r) => r.summary.includes("Nur Vorstand")));
});

test("Normales Dokument: Titel und Dateiname bleiben im Protokoll (Nachvollziehbarkeit)", async () => {
  const doc = await documentsData.createDocument(admin as never, { title: "Reglement", description: "", category: "REGLEMENT", visibility: "MITGLIEDER", meetingId: null, changeNote: "" } as never, upload("reglement.pdf", "c".repeat(64)));
  const row = (await allAudit()).find((r) => r.objectId === doc.id)!;
  assert.ok(row.summary.includes("«Reglement»"));
  assert.ok((row.after ?? "").includes("reglement.pdf"));
});

test("Alte Protokolleinträge zu Vorstandsdokumenten sind ohne das Einzelrecht weder in der Liste noch in Suche, Zähler oder Export", async () => {
  await db.auditLog.createMany({
    data: [
      { actorType: "ADMIN", actorName: "X", action: "document.create", objectType: "Document", objectId: "legacy1", summary: "Dokument «Altes Geheimprotokoll» (Protokoll, Nur Vorstand) hochgeladen", after: JSON.stringify({ datei: "alt.pdf" }) },
      { actorType: "ADMIN", actorName: "X", action: "document.update", objectType: "Document", objectId: "legacy2", summary: "Dokument «Freigegeben» (Protokoll, Mitglieder) geändert", before: JSON.stringify({ title: "Frueher Geheimtitel", visibility: "VORSTAND" }), after: JSON.stringify({ title: "Freigegeben", visibility: "MITGLIEDER" }) },
      { actorType: "ADMIN", actorName: "X", action: "document.create", objectType: "Document", objectId: "open1", summary: "Dokument «Offen» (Protokoll, Öffentlich) hochgeladen" },
    ],
  });
  const f = auditData.parseAuditFilters(new URLSearchParams({ q: "Geheim" }));
  const without = await auditData.listAuditLog(f, false, 0, 100);
  assert.equal(without.rows.length, 0, "Suche nach dem Titel findet nichts");
  assert.equal(without.total, 0);
  const withRight = await auditData.listAuditLog(f, true, 0, 100);
  assert.equal(withRight.rows.filter((r) => r.objectId === "legacy1").length, 1, "mit dem Recht ist der Eintrag auffindbar");
  const none = auditData.parseAuditFilters(new URLSearchParams({}));
  assert.ok((await auditData.listAuditLog(none, true, 0, 500)).rows.some((r) => r.objectId === "legacy2"), "mit dem Recht sichtbar");
  const all = await auditData.listAuditLog(none, false, 0, 500);
  assert.ok(!text(all.rows).includes("Geheim"));
  assert.ok(all.rows.some((r) => r.objectId === "open1"), "andere Einträge bleiben sichtbar");
  const exported = await auditData.listAuditForExport(none, false);
  assert.ok(!text(exported).includes("Geheim"));
  assert.ok((await auditData.listAuditForExport(none, true)).some((r) => r.objectId === "legacy1"));
});

// ---- Anlässe und Gäste ----------------------------------------------------------------------------------------------------------

let n = 0;
async function makeEvent(opts: { capacity?: number | null; startsAt?: Date; endsAt?: Date | null } = {}) {
  n += 1;
  return db.event.create({ data: { title: `Anlass ${n}`, startsAt: opts.startsAt ?? inDays(30), endsAt: opts.endsAt ?? null, status: "VEROEFFENTLICHT", isPublic: true, membersOnly: false, capacity: opts.capacity ?? null } });
}
async function addGuest(eventId: string, name: string, email: string, status = "ANGEMELDET", note = "", seats = 1, createdAt = new Date()) {
  return db.eventRegistration.create({ data: { eventId, guestName: name, guestEmail: email, status, note, seats, cancelTokenHash: `h-${Math.random().toString(36).slice(2)}-${n++}`, consentAt: new Date(), createdAt } });
}

test("Gast-Angaben werden GUEST_RETENTION_DAYS nach dem Anlass entfernt, Mitglieder und kommende Anlässe bleiben unberührt", async () => {
  const past = await makeEvent({ startsAt: inDays(-45), endsAt: inDays(-44) });
  const pastNoEnd = await makeEvent({ startsAt: inDays(-40) });
  const recent = await makeEvent({ startsAt: inDays(-10), endsAt: inDays(-10) });
  const future = await makeEvent({ startsAt: inDays(10) });
  const member = await db.member.create({ data: { memberNumber: 9001, firstName: "Mia", lastName: "Mitglied", email: "mia@example.test", status: "AKTIV" } });
  const g1 = await addGuest(past.id, "Greta Gast", "greta@example.test", "ANGEMELDET", "vegetarisch");
  const g2 = await addGuest(pastNoEnd.id, "Hans Hinten", "hans@example.test", "WARTELISTE");
  const g3 = await addGuest(past.id, "Abgesagt Anna", "anna@example.test", "ABGESAGT", "krank");
  const gRecent = await addGuest(recent.id, "Recent Rolf", "rolf@example.test");
  const gFuture = await addGuest(future.id, "Future Fritz", "fritz@example.test");
  const mem = await db.eventRegistration.create({ data: { eventId: past.id, memberId: member.id, note: "Mitgliedsnotiz", status: "ANGEMELDET", cancelTokenHash: `h-m-${n++}` } });
  await db.auditLog.create({ data: { actorType: "ADMIN", actorName: "A", action: "registration.add", objectType: "EventRegistration", objectId: g1.id, summary: "Anmeldung (Greta Gast, «Anlass»)", after: JSON.stringify({ guestName: "Greta Gast", personen: 1 }) } });

  const res = await guests.anonymizePastGuestRegistrations();
  assert.equal(res.anonymized, 3);
  for (const id of [g1.id, g2.id, g3.id]) {
    const r = await db.eventRegistration.findUniqueOrThrow({ where: { id } });
    assert.equal(r.guestName, "");
    assert.equal(r.guestEmail, "");
    assert.equal(r.note, "");
  }
  assert.equal((await db.eventRegistration.findUniqueOrThrow({ where: { id: g1.id } })).status, "ANGEMELDET", "Status und Plätze bleiben für die Statistik");
  assert.equal((await db.eventRegistration.findUniqueOrThrow({ where: { id: gRecent.id } })).guestName, "Recent Rolf");
  assert.equal((await db.eventRegistration.findUniqueOrThrow({ where: { id: gFuture.id } })).guestName, "Future Fritz");
  assert.equal((await db.eventRegistration.findUniqueOrThrow({ where: { id: mem.id } })).note, "Mitgliedsnotiz", "Mitglieder gehören nicht dazu");

  const rows = await allAudit();
  const old = rows.find((r) => r.objectId === g1.id)!;
  assert.ok(!text(old).includes("Greta"), "frühere Protokolleinträge sind unkenntlich gemacht");
  assert.equal(old.summary, lib.GUEST_AUDIT_SCRUBBED_SUMMARY);
  const sys = rows.find((r) => r.action === "registration.anonymize")!;
  assert.equal(sys.actorType, "SYSTEM");
  assert.ok(!/greta|hans|anna|example/i.test(text(sys)));

  assert.equal((await guests.anonymizePastGuestRegistrations()).anonymized, 0, "wiederholbar");
  assert.ok(cron.DAILY_TASKS.some((t: { name: string }) => t.name === "guest-data-anonymize"), "als Tagesaufgabe eingetragen");
});

test("Grenze der Aufbewahrung: 29 Tage nach dem Anlass bleibt, 31 Tage danach wird entfernt", async () => {
  const e29 = await makeEvent({ startsAt: inDays(-29), endsAt: inDays(-29) });
  const e31 = await makeEvent({ startsAt: inDays(-31), endsAt: inDays(-31) });
  const a = await addGuest(e29.id, "Neunundzwanzig", "n29@example.test");
  const b = await addGuest(e31.id, "Einunddreissig", "n31@example.test");
  await guests.anonymizePastGuestRegistrations();
  assert.equal((await db.eventRegistration.findUniqueOrThrow({ where: { id: a.id } })).guestName, "Neunundzwanzig");
  assert.equal((await db.eventRegistration.findUniqueOrThrow({ where: { id: b.id } })).guestName, "");
});

test("Auskunft: findet Gast-Anmeldungen zu einer E-Mail-Adresse über alle Anlässe (auch unbestätigte), nur Gäste, kein Treffer bei Fremden", async () => {
  const e1 = await makeEvent();
  const e2 = await makeEvent();
  const mine1 = await addGuest(e1.id, "Gabi Gast", "gabi@example.test", "ANGEMELDET", "Notiz");
  const mine2 = await addGuest(e2.id, "Gabi Gast", "gabi@example.test", "UNBESTAETIGT");
  await addGuest(e1.id, "Anderer", "andere@example.test");
  const member = await db.member.create({ data: { memberNumber: 9002, firstName: "Gabi", lastName: "Mitglied", email: "gabi@example.test", status: "AKTIV" } });
  await db.eventRegistration.create({ data: { eventId: e2.id, memberId: member.id, cancelTokenHash: `h-g-${n++}` } });
  const rows = await guests.discloseGuestData(admin as never, " Gabi@Example.test ");
  assert.deepEqual(rows.map((r: { id: string }) => r.id).sort(), [mine1.id, mine2.id].sort());
  assert.equal((await guests.findGuestRegistrations("niemand@example.test")).length, 0);
  assert.equal((await guests.findGuestRegistrations("")).length, 0);
  const entry = (await allAudit()).find((r) => r.action === "export.guest-disclosure")!;
  assert.ok(!/gabi|example/i.test(text(entry)), "Protokoll nennt weder Namen noch Adresse");
});

test("Löschung per E-Mail-Adresse: alles dieser Adresse weg, Fremde bleiben, Plätze werden frei, Wartende rücken nach, Protokoll ohne Personendaten", async () => {
  const ev = await makeEvent({ capacity: 2 });
  const del = await addGuest(ev.id, "Lösch Lena", "lena@example.test", "ANGEMELDET", "Allergie", 2);
  const waiting = await addGuest(ev.id, "Warte Walter", "walter@example.test", "WARTELISTE", "", 1, new Date(Date.now() + 1000));
  const other = await db.event.create({ data: { title: "Zweiter", startsAt: inDays(5), status: "ENTWURF", isPublic: false, membersOnly: false } });
  const del2 = await addGuest(other.id, "Lösch Lena", "lena@example.test", "UNBESTAETIGT");
  await db.auditLog.create({ data: { actorType: "ADMIN", actorName: "A", action: "registration.add", objectType: "EventRegistration", objectId: del.id, summary: "Anmeldung von Lösch Lena erfasst", after: JSON.stringify({ guestName: "Lösch Lena" }) } });

  const res = await guests.deleteGuestRegistrations(admin as never, "lena@example.test");
  assert.equal(res.deleted, 2);
  assert.equal(await db.eventRegistration.count({ where: { id: { in: [del.id, del2.id] } } }), 0);
  assert.equal((await db.eventRegistration.findUniqueOrThrow({ where: { id: waiting.id } })).status, "ANGEMELDET", "Wartender rückt nach");
  assert.equal((await db.eventRegistration.findUniqueOrThrow({ where: { id: waiting.id } })).guestName, "Warte Walter", "Fremde bleiben unberührt");
  const rows = (await allAudit()).filter((r) => r.action === "registration.guest-delete" || r.objectId === del.id);
  assert.ok(rows.length >= 3);
  assert.ok(!/lena|löschlena|allergie|example/i.test(text(rows)), text(rows));
  assert.equal((await guests.deleteGuestRegistrations(admin as never, "lena@example.test")).deleted, 0, "zweiter Aufruf löscht nichts mehr");
  await assert.rejects(() => guests.deleteGuestRegistrations(admin as never, "  "), /Ungültige Eingabe/);
});

test("Unbestätigte Anmeldung: nach 47 Stunden bleibt sie, nach 49 Stunden wird sie gelöscht; abgelaufene fehlen in den Zählern der Verwaltung", async () => {
  const ev = await makeEvent();
  const fresh = await addGuest(ev.id, "Frisch", "frisch@example.test", "UNBESTAETIGT", "", 1, hoursAgo(47));
  const stale = await addGuest(ev.id, "Abgelaufen", "alt@example.test", "UNBESTAETIGT", "", 1, hoursAgo(49));
  const list = await eventsData.listEventsAdmin(eventsData.parseEventFilters(new URLSearchParams({ view: "alle" })), 0, 100);
  assert.equal(list.rows.find((r: { id: string }) => r.id === ev.id)!.unconfirmed, 1, "nur die noch gültige zählt");
  const res = await confirm.purgeExpiredUnconfirmedRegistrations();
  assert.equal(res.deleted >= 1, true);
  assert.equal(await db.eventRegistration.count({ where: { id: fresh.id } }), 1);
  assert.equal(await db.eventRegistration.count({ where: { id: stale.id } }), 0);
});

test("Bestätigungsseite und Mail zeigen Name, Personenzahl und Bemerkung der gespeicherten Anmeldung (Vorbelegung durch Fremde erkennbar)", async () => {
  const ev = await makeEvent({ capacity: 10 });
  const first = await ops.registerForEvent({ eventId: ev.id, who: { kind: "guest", name: "Angreifer Anton", email: "opfer@example.test", consent: true }, seats: 5, note: "Gruppe des Angreifers", sendMail: false });
  // Die Besitzerin der Adresse meldet sich selbst an: Die fremde, noch offene Zeile bleibt unverändert.
  const second = await ops.registerForEvent({ eventId: ev.id, who: { kind: "guest", name: "Olga Opfer", email: "opfer@example.test", consent: true }, seats: 1, note: "", sendMail: false });
  assert.equal(second.registrationId, first.registrationId);
  const reg = await db.eventRegistration.findUniqueOrThrow({ where: { id: first.registrationId } });
  const token = tokens.signConfirmToken(ops.confirmSecret(), reg.id, lib.confirmExpiresAt(reg.createdAt));
  const info = await confirm.describeConfirmToken(token);
  assert.equal(info.state, "READY");
  if (info.state === "READY") {
    assert.equal(info.guestName, "Angreifer Anton");
    assert.equal(info.note, "Gruppe des Angreifers");
    assert.equal(info.seats, 5);
  }
});
