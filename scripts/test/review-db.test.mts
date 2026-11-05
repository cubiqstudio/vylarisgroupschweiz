// Tests gegen eine eigene, leere SQLite-Datenbank (Datei im Temp-Ordner): Datenschutz, Rechte der Anlässe, Protokolle und Nebenläufigkeit.
// Die Entwicklungsdatenbank bleibt unberührt.
// Aufruf:  npx tsx scripts/test/review-db.test.mts
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

const dir = mkdtempSync(join(tmpdir(), "vgs-review-db-"));
process.env.DATABASE_URL = `file:${join(dir, "test.db")}`;
process.env.AUTH_SECRET = "ein-geheimnis-fuer-den-test-mindestens-32-zeichen";

// "server-only" wirft ausserhalb von Next.js; für den Test durch ein leeres Modul ersetzen.
const require = createRequire(import.meta.url);
const serverOnlyPath = require.resolve("server-only");
require.cache[serverOnlyPath] = { id: serverOnlyPath, filename: serverOnlyPath, loaded: true, exports: {}, children: [], paths: [] } as unknown as NodeJS.Module;

execFileSync("npx", ["prisma", "db", "push", "--skip-generate", "--accept-data-loss"], { env: process.env, stdio: "pipe" });

const { db } = await import("../../src/lib/db.ts");
const eventsData = await import("../../src/lib/verein/events-data.ts");
const eventsOps = await import("../../src/lib/verein/events-ops.ts");
const membersData = await import("../../src/lib/verein/members-data.ts");
const meetingsData = await import("../../src/lib/verein/meetings-data.ts");
const feesData = await import("../../src/lib/verein/fees-data.ts");
const dates = await import("../../src/lib/verein/dates.ts");

after(async () => {
  await db.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

const admin = { id: "adm1", email: "a@example.test", name: "Test Admin", role: "ADMIN", roles: ["ADMIN"] as never, memberId: null, mustChangePassword: false };
const when = (days: number) => new Date(Date.now() + days * 86_400_000);

let counter = 100;
async function makeMember(overrides: Record<string, unknown> = {}) {
  counter += 1;
  return db.member.create({ data: { memberNumber: counter, firstName: "Max", lastName: `Muster${counter}`, email: `m${counter}@example.test`, status: "AKTIV", ...overrides } });
}

test("Anlässe nur für Mitglieder: ausgeschlossene und ausgetretene Mitglieder sehen sie nicht", async () => {
  const internal = await db.event.create({ data: { title: "Interner Anlass GEHEIM", location: "Geheimer Ort", startsAt: when(10), status: "VEROEFFENTLICHT", isPublic: false, membersOnly: true } });
  const active = await makeMember();
  const expelled = await makeMember({ status: "AUSGESCHLOSSEN" });
  const left = await makeMember({ status: "AUSGETRETEN" });
  const application = await makeMember({ status: "ANTRAG" });
  assert.ok((await eventsData.listEventsForMember(active.id)).some((e) => e.id === internal.id));
  for (const m of [expelled, left, application]) assert.deepEqual(await eventsData.listEventsForMember(m.id), [], m.status);
});

test("Gast-Anmeldung: eine zweite Anfrage mit derselben Adresse erneuert den Abmelde-Link nicht", async () => {
  const event = await db.event.create({ data: { title: "Sommerfest", startsAt: when(20), status: "VEROEFFENTLICHT", isPublic: true, membersOnly: false } });
  const who = { kind: "guest" as const, name: "Gast Eins", email: "gast@example.test", consent: true };
  const first = await eventsOps.registerForEvent({ eventId: event.id, who, seats: 1, note: "", sendMail: false });
  assert.equal(first.created, true);
  const hashBefore = (await db.eventRegistration.findUniqueOrThrow({ where: { id: first.registrationId } })).cancelTokenHash;
  const second = await eventsOps.registerForEvent({ eventId: event.id, who, seats: 1, note: "", sendMail: false });
  assert.equal(second.created, false);
  assert.equal(second.registrationId, first.registrationId);
  const hashAfter = (await db.eventRegistration.findUniqueOrThrow({ where: { id: first.registrationId } })).cancelTokenHash;
  assert.equal(hashAfter, hashBefore, "der Link der angemeldeten Person bleibt gültig");
});

test("Hand-bestätigtes Konto wird nie automatisch verknüpft, per Mail bestätigtes schon", async () => {
  const member = await makeMember({ email: "md@example.test", memberNumber: 900 });
  const user = await db.user.create({ data: { email: "md@example.test", passwordHash: "x", name: "MD", emailVerifiedAt: new Date(), emailVerifiedViaMail: false } });
  assert.equal(await membersData.linkAccountByVerifiedEmail(user.id), false);
  assert.equal((await db.member.findUniqueOrThrow({ where: { id: member.id } })).userId, null);
  await db.user.update({ where: { id: user.id }, data: { emailVerifiedViaMail: true } });
  assert.equal(await membersData.linkAccountByVerifiedEmail(user.id), true);
  assert.equal((await db.member.findUniqueOrThrow({ where: { id: member.id } })).userId, user.id);
});

test("Adresse aus dem öffentlichen Antrag: keine automatische Verknüpfung bei der Aufnahme", async () => {
  const user = await db.user.create({ data: { email: "fremd@example.test", passwordHash: "x", name: "Fremd", emailVerifiedAt: new Date(), emailVerifiedViaMail: true } });
  const app = await membersData.createApplication({
    salutation: "", firstName: "Eva", lastName: "Antrag", street: "", houseNumber: "", zip: "", city: "", country: "CH", email: "fremd@example.test", phone: "", communicationPref: "EMAIL", message: "", membershipTypeId: null,
  } as never);
  assert.ok(app);
  assert.equal(app.member.emailUnconfirmed, true);
  const out = await membersData.runMemberAction(admin as never, app.member.id, { action: "accept", sendMail: false } as never);
  assert.equal(out.linked ?? false, false);
  assert.equal((await db.member.findUniqueOrThrow({ where: { id: app.member.id } })).userId, null);
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: user.id } })).email, "fremd@example.test");
});

test("Personendaten entfernen: Versandprotokoll, Anmeldenotizen, Namen im Änderungsprotokoll und auf Wunsch das Konto", async () => {
  const user = await db.user.create({ data: { email: "mc@example.test", passwordHash: "x", name: "Maxc Musterc", emailVerifiedAt: new Date() } });
  const member = await makeMember({ status: "AUSGETRETEN", firstName: "Maxc", lastName: "Musterc", email: "mc@example.test", userId: user.id });
  const meeting = await db.meeting.create({ data: { kind: "MITGLIEDERVERSAMMLUNG", title: "GV", startsAt: when(-100) } });
  await db.meetingMail.create({ data: { meetingId: meeting.id, batchId: "b1", kind: "EINLADUNG", memberId: member.id, recipientName: "Maxc Musterc", email: "mc@example.test", ok: true } });
  const event = await db.event.create({ data: { title: "Fest", startsAt: when(30), status: "VEROEFFENTLICHT" } });
  const reg = await db.eventRegistration.create({ data: { eventId: event.id, memberId: member.id, note: "Allergie: Nüsse", cancelTokenHash: "h-anon" } });
  await db.auditLog.create({ data: { actorType: "ADMIN", actorName: "X", action: "member.update", objectType: "Member", objectId: member.id, summary: "Mitglied geändert", before: JSON.stringify({ firstName: "Max", status: "AKTIV" }), after: JSON.stringify({ firstName: "Maxc", status: "AUSGETRETEN" }) } });
  await db.auditLog.create({ data: { actorType: "ADMIN", actorName: "X", action: "registration.add", objectType: "EventRegistration", objectId: reg.id, summary: "Anmeldung von Maxc Musterc erfasst" } });

  await membersData.runMemberAction(admin as never, member.id, { action: "anonymize", confirmNumber: member.memberNumber, deleteAccount: true } as never);

  const mail = await db.meetingMail.findFirstOrThrow({ where: { memberId: member.id } });
  assert.equal(mail.email, "");
  assert.ok(!mail.recipientName.includes("Maxc"));
  assert.equal((await db.eventRegistration.findUniqueOrThrow({ where: { id: reg.id } })).note, "");
  assert.equal(await db.user.count({ where: { id: user.id } }), 0, "Website-Konto gelöscht");
  const logs = await db.auditLog.findMany({ where: { OR: [{ objectId: member.id }, { objectId: reg.id }] } });
  const text = JSON.stringify(logs);
  assert.ok(!text.includes("Maxc") && !text.includes("Musterc"), "keine Namen mehr im Änderungsprotokoll");
  assert.ok(logs.some((l) => l.action === "member.update" && (l.after ?? "").includes("AUSGETRETEN")), "Status bleibt nachvollziehbar");
});

test("Personendaten entfernen ohne Häkchen: das Website-Konto bleibt bestehen, die Verknüpfung ist gelöst", async () => {
  const user = await db.user.create({ data: { email: "keep@example.test", passwordHash: "x", name: "Keep", emailVerifiedAt: new Date() } });
  const member = await makeMember({ status: "AUSGETRETEN", userId: user.id });
  await membersData.runMemberAction(admin as never, member.id, { action: "anonymize", confirmNumber: member.memberNumber, deleteAccount: false } as never);
  assert.equal(await db.user.count({ where: { id: user.id } }), 1);
  assert.equal((await db.member.findUniqueOrThrow({ where: { id: member.id } })).userId, null);
});

test("Protokoll: Änderung nach der Genehmigung sichert den genehmigten Text im vollen Wortlaut; Kopfdaten sind gesperrt", async () => {
  const text = "Traktandum 1: ".concat("y".repeat(900));
  const meeting = await db.meeting.create({ data: { kind: "MITGLIEDERVERSAMMLUNG", title: "GV Test", startsAt: when(-10), status: "DURCHGEFUEHRT", minutes: text } });
  await meetingsData.approveMinutes(admin as never, meeting.id, { approvedOn: dates.todayZurich(), approvedBy: "Vorstand", note: "" });
  await meetingsData.saveMinutes(admin as never, meeting.id, `${text} Nachtrag`, "Tippfehler korrigiert");
  const revisions = await db.minutesRevision.findMany({ where: { meetingId: meeting.id }, orderBy: { createdAt: "asc" } });
  assert.ok(revisions.length >= 2);
  assert.ok(revisions.every((r) => r.text === text), "der genehmigte Text steht vollständig in der Sicherung");
  assert.ok(revisions.every((r) => /^[0-9a-f]{64}$/.test(r.sha256)));
  await assert.rejects(meetingsData.updateMeeting(admin as never, meeting.id, { title: "Anderer Titel" } as never), (e: unknown) => (e as { status?: number }).status === 409);
  await assert.rejects(meetingsData.updateMeeting(admin as never, meeting.id, { startsAt: when(-9) } as never), (e: unknown) => (e as { status?: number }).status === 409);
  // Ohne Wirkung auf das Protokoll bleibt eine Änderung möglich
  await meetingsData.updateMeeting(admin as never, meeting.id, { location: "Saal" } as never);
});

test("Beschlussnummern: fortlaufend und je Sitzung eindeutig (Unique-Index schützt vor gleichzeitiger Vergabe)", async () => {
  const meeting = await db.meeting.create({ data: { kind: "VORSTANDSSITZUNG", title: "Sitzung", startsAt: when(5) } });
  const input = { text: "Beschluss", result: "ANGENOMMEN", majority: "EINFACH", recusal: "", votesYes: null, votesNo: null, abstentions: null, agendaItemId: null };
  // (SQLite sperrt gleichzeitige Transaktionen; die Eindeutigkeit prüft der Index, gleich unten.)
  const created = [];
  for (let i = 0; i < 5; i += 1) created.push(await meetingsData.createResolution(admin as never, meeting.id, input as never));
  const numbers = created.map((r) => r.number).sort((a, b) => a - b);
  assert.deepEqual(numbers, [1, 2, 3, 4, 5]);
  await assert.rejects(db.resolution.create({ data: { meetingId: meeting.id, number: 3, text: "doppelt" } }), (e: unknown) => (e as { code?: string }).code === "P2002");
});

test("Zahlungsimport: dieselbe Zahlung wird nicht doppelt gebucht, die Summe bleibt unter der Obergrenze", async () => {
  const member = await makeMember();
  const invoice = await db.invoice.create({
    data: { number: "2026-9001", year: 2026, seq: 9001, memberId: member.id, recipientName: "Max Muster", subject: "Beitrag", status: "OFFEN", issueDate: dates.todayZurich(), dueDate: dates.todayZurich(), totalRappen: 5000 },
  });
  const pay = { invoiceId: invoice.id, receivedAt: dates.todayZurich(), amount: 2000, method: "UEBERWEISUNG", reference: "", note: "", assetAccountId: null, incomeAccountId: null };
  await feesData.recordPayment(admin, pay as never, { rejectDuplicate: true });
  await assert.rejects(feesData.recordPayment(admin, pay as never, { rejectDuplicate: true }), (e: unknown) => (e as { status?: number }).status === 409);
  assert.equal(await db.payment.count({ where: { invoiceId: invoice.id } }), 1, "die zweite, gleiche Zahlung wird nicht gebucht");
  // Ohne die Prüfung (manuelle Erfassung) sind zwei gleiche Zahlungen erlaubt
  await feesData.recordPayment(admin, pay as never);
  assert.equal(await db.payment.count({ where: { invoiceId: invoice.id } }), 2);
  // Obergrenze der Summe
  const big = await db.invoice.create({
    data: { number: "2026-9002", year: 2026, seq: 9002, memberId: member.id, recipientName: "Max Muster", subject: "Beitrag", status: "OFFEN", issueDate: dates.todayZurich(), dueDate: dates.todayZurich(), totalRappen: 2_000_000_000, paidRappen: 1_900_000_000 },
  });
  await assert.rejects(feesData.recordPayment(admin, { ...pay, invoiceId: big.id, amount: 200_000_000 } as never), (e: unknown) => (e as { status?: number }).status === 422);
});

test("Rechnungs-Link: ein abgelaufener Link zeigt die Rechnung nicht mehr", async () => {
  const member = await makeMember();
  const token = feesData.newViewToken();
  const base = { memberId: member.id, recipientName: "Max Muster", subject: "Beitrag", status: "OFFEN", issueDate: dates.todayZurich(), dueDate: dates.todayZurich(), totalRappen: 1000, viewTokenHash: feesData.sha256(token) };
  const inv = await db.invoice.create({ data: { ...base, number: "2026-9003", year: 2026, seq: 9003, viewTokenExpiresAt: when(10) } });
  assert.equal((await feesData.getInvoiceByViewToken(token))?.id, inv.id);
  await db.invoice.update({ where: { id: inv.id }, data: { viewTokenExpiresAt: when(-1) } });
  assert.equal(await feesData.getInvoiceByViewToken(token), null);
});
