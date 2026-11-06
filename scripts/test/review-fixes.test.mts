// Tests zu den Befunden der unabhängigen Prüfung: Rechte, Datenschutz, Protokolle, Fristen, Rechenfehler und Token.
// Jeder Test schlägt ohne die zugehörige Korrektur fehl.
// Aufruf:  npx tsx scripts/test/review-fixes.test.mts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";

// "server-only" wirft ausserhalb von Next.js; für den Test durch ein leeres Modul ersetzen.
const require = createRequire(import.meta.url);
const serverOnlyPath = require.resolve("server-only");
require.cache[serverOnlyPath] = { id: serverOnlyPath, filename: serverOnlyPath, loaded: true, exports: {}, children: [], paths: [] } as unknown as NodeJS.Module;

const dates = await import("../../src/lib/verein/dates.ts");
const ledger = await import("../../src/lib/verein/ledger-lib.ts");
const members = await import("../../src/lib/verein/members-lib.ts");
const meetings = await import("../../src/lib/verein/meetings-lib.ts");
const minutes = await import("../../src/lib/verein/minutes-revision.ts");
const perms = await import("../../src/lib/verein/permissions.ts");
const card = await import("../../src/lib/verein/membership-card.ts");
const feesCalc = await import("../../src/lib/verein/fees-calc.ts");
const money = await import("../../src/lib/verein/money.ts");
const audit = await import("../../src/lib/verein/audit.ts");
const settingsAudit = await import("../../src/lib/settings-audit.ts");
const mdSafe = await import("../../src/lib/markdown-safe.ts");
const rate = await import("../../src/lib/rate-limit.ts");
const apiLib = await import("../../src/lib/api.ts");
const qr = await import("../../src/lib/verein/qr-bill.ts");
const qrSvg = await import("../../src/lib/verein/qr-bill-svg.ts");

const d = dates.dateOnly;

// ---- Rechte ---------------------------------------------------------------------------------------------------------------

test("Konten von Hand bestätigen: nur mit «Mitglieder ändern» oder «System», nicht mit der Website-Rolle", () => {
  assert.equal(perms.canHandVerifyAccounts(["EDITOR"]), false);
  assert.equal(perms.canHandVerifyAccounts(["KASSIER"]), false);
  assert.equal(perms.canHandVerifyAccounts(["REVISOR"]), false);
  assert.equal(perms.canHandVerifyAccounts(["AKTUAR"]), true);
  assert.equal(perms.canHandVerifyAccounts(["PRAESIDENT"]), true);
  assert.equal(perms.canHandVerifyAccounts(["ADMIN"]), true);
  assert.equal(perms.canHandVerifyAccounts(["EDITOR", "AKTUAR"]), true);
  assert.equal(perms.canHandVerifyAccounts([]), false);
});

test("Automatische Verknüpfung braucht den Mail-Nachweis; ein von Hand bestätigtes Konto verknüpft nie", () => {
  const member = { email: "md@example.test", userId: null, status: "AKTIV" };
  const byHand = { email: "md@example.test", emailVerifiedAt: new Date(), emailVerifiedViaMail: false };
  const byMail = { ...byHand, emailVerifiedViaMail: true };
  assert.equal(members.canAutoLink(byHand, member), false);
  assert.equal(members.canAutoLink(byMail, member), true);
  // Adresse aus einem öffentlichen Antrag gilt nicht als bestätigt
  assert.equal(members.canAutoLink(byMail, { ...member, emailUnconfirmed: true }), false);
});

test("Startpasswort: nur das Ändern des eigenen Passworts bleibt erlaubt", () => {
  assert.equal(perms.isAllowedWhilePasswordChangeRequired("/api/admin/account/password"), true);
  assert.equal(perms.isAllowedWhilePasswordChangeRequired("/admin/account"), true);
  for (const path of ["/api/admin/members/export", "/api/admin/members", "/admin", "/admin/members", "/api/admin/account/password/x", "/api/admin/users/abc"]) {
    assert.equal(perms.isAllowedWhilePasswordChangeRequired(path), false, path);
  }
  const admin = (mustChangePassword: boolean) => ({ id: "a", email: "k@example.test", name: "K", role: "KASSIER", roles: ["KASSIER"] as never, memberId: null, mustChangePassword });
  assert.throws(
    () => apiLib.assertPasswordChanged(admin(true), "/api/admin/members/export"),
    (e: unknown) => e instanceof apiLib.ApiError && e.status === 403 && e.code === "PASSWORD_CHANGE_REQUIRED",
  );
  assert.doesNotThrow(() => apiLib.assertPasswordChanged(admin(true), "/api/admin/account/password"));
  assert.doesNotThrow(() => apiLib.assertPasswordChanged(admin(false), "/api/admin/members/export"));
});

// ---- Datenschutz ----------------------------------------------------------------------------------------------------------

test("Fehler im Log: nur Name und Code, nie Meldungstext mit Personendaten", () => {
  const prismaLike = Object.assign(new Error("Invalid `prisma.member.create()` invocation: firstName: 'Anna Muster', email: 'anna@example.test'"), { name: "PrismaClientValidationError", code: "P2009" });
  const text = apiLib.describeErrorForLog(prismaLike);
  assert.equal(text, "PrismaClientValidationError P2009");
  assert.ok(!text.includes("Anna") && !text.includes("example.test"));
  assert.equal(apiLib.describeErrorForLog("irgendein Text mit anna@example.test"), "unbekannt");
  assert.equal(apiLib.describeErrorForLog(new TypeError("geheim")), "TypeError");
});

test("Personendaten in früheren Protokolleinträgen werden unkenntlich gemacht, der Rest bleibt", () => {
  const json = JSON.stringify({ status: "AKTIV", firstName: "Anna", lastName: "Muster", email: "anna@example.test", leftAt: "2026-12-31", nested: { guestName: "Gast", seats: 2 } });
  const out = members.scrubPersonalAuditJson(json)!;
  assert.ok(!out.includes("Anna") && !out.includes("Muster") && !out.includes("example.test") && !out.includes("Gast"));
  const parsed = JSON.parse(out);
  assert.equal(parsed.status, "AKTIV");
  assert.equal(parsed.leftAt, "2026-12-31");
  assert.equal(parsed.nested.seats, 2);
  assert.equal(members.scrubPersonalAuditJson(null), null);
  assert.equal(members.scrubPersonalAuditJson("kein json"), "[entfernt]");
});

test("Auskunft (revDSG) enthält Versandprotokoll, Bemerkungen, Konto und den Hinweis auf Vorstandsnotizen", () => {
  const out = members.buildDisclosure({
    generatedAt: new Date("2026-11-05T10:00:00Z"),
    member: {
      memberNumber: 3, salutation: "", firstName: "Anna", lastName: "Muster", birthDate: null, street: "", houseNumber: "", zip: "", city: "", country: "CH", email: "anna@example.test", phone: "",
      status: "AKTIV", applicationAt: d(2026, 1, 1), joinedAt: d(2026, 1, 5), exitNoticeAt: null, leftAt: null, exitReason: "", consentAt: null, communicationPref: "EMAIL", hasBoardNotes: true, membershipTypeName: "Aktiv", hasAccount: true,
    },
    account: { email: "anna@example.test", name: "Anna M.", createdAt: new Date("2026-01-02T08:00:00Z") },
    mails: [{ meetingTitle: "GV 2026", kind: "EINLADUNG", sentAt: new Date("2026-03-01T08:00:00Z"), email: "anna@example.test", ok: true }],
    offices: [],
    invoices: [],
    payments: [],
    attendances: [{ meetingTitle: "GV 2026", startsAt: d(2026, 4, 1), status: "ANWESEND", note: "Früher gegangen" }],
    registrations: [{ eventTitle: "Sommerfest", startsAt: d(2026, 8, 1), seats: 2, status: "ANGEMELDET", note: "Allergie: Nüsse" }],
  });
  assert.equal(out.einladungen.length, 1);
  assert.equal(out.einladungen[0]!.adresse, "anna@example.test");
  assert.equal(out.anmeldungenAnlaesse[0]!.bemerkung, "Allergie: Nüsse");
  assert.equal(out.versammlungen[0]!.bemerkung, "Früher gegangen");
  assert.equal(out.stammdaten["Website-Konto: E-Mail-Adresse"], "anna@example.test");
  assert.match(out.hinweis, /interne Notizen des Vorstands.*auf Anfrage/);
  assert.equal(out.stammdaten["Interne Notizen vorhanden"], true);
  assert.ok(members.disclosureCsvRows(out).some((r) => r[0] === "Einladungen und Erinnerungen"));
});

test("Markdown: nur Bilder der eigenen Website, keine fremden Server (Datenschutz)", () => {
  assert.equal(mdSafe.isOwnImageSrc("/api/blog/bild.png"), true);
  for (const bad of ["https://tracker.example/p.png", "http://x.test/a.png", "//tracker.example/p.png", "data:image/png;base64,AAAA", "javascript:alert(1)", "/\\evil.test/x.png", "bild.png", "", undefined, null]) {
    assert.equal(mdSafe.isOwnImageSrc(bad), false, String(bad));
  }
  const cfg = readFileSync(new URL("../../next.config.ts", import.meta.url), "utf8");
  assert.match(cfg, /Content-Security-Policy/);
  assert.match(cfg, /img-src 'self'/);
  assert.match(cfg, /frame-ancestors 'none'/);
});

test("Client-IP: vom Client vorangestellte X-Forwarded-For-Einträge zählen nicht", () => {
  const base = { cfConnectingIp: null, realIp: null, trustProxy: "", hops: 1 };
  assert.equal(rate.pickClientIp({ ...base, forwardedFor: "203.0.113.9" }), "203.0.113.9");
  // Der Angreifer schreibt 1.1.1.1 vor, der Proxy hängt die echte Adresse an
  assert.equal(rate.pickClientIp({ ...base, forwardedFor: "1.1.1.1, 203.0.113.9" }), "203.0.113.9");
  assert.equal(rate.pickClientIp({ ...base, forwardedFor: "9.9.9.9, 1.1.1.1, 203.0.113.9" }), "203.0.113.9");
  // zwei vertrauenswürdige Proxys
  assert.equal(rate.pickClientIp({ ...base, hops: 2, forwardedFor: "1.1.1.1, 203.0.113.9, 10.0.0.2" }), "203.0.113.9");
  assert.equal(rate.pickClientIp({ ...base, hops: 5, forwardedFor: "203.0.113.9" }), "203.0.113.9");
  assert.equal(rate.pickClientIp({ ...base, forwardedFor: null, realIp: "198.51.100.4" }), "198.51.100.4");
  assert.equal(rate.pickClientIp({ ...base, forwardedFor: null }), "unknown");
  // Cloudflare
  assert.equal(rate.pickClientIp({ ...base, trustProxy: "cloudflare", cfConnectingIp: "198.51.100.7", forwardedFor: "1.1.1.1" }), "198.51.100.7");
  assert.equal(rate.pickClientIp({ ...base, trustProxy: "cloudflare", forwardedFor: "1.1.1.1, 198.51.100.8" }), "198.51.100.8");
});

// ---- Protokolle (Audit) ---------------------------------------------------------------------------------------------------

test("Mailserver-Änderung: Protokoll nennt die Felder, das Passwort nie", () => {
  const before = { host: "smtp.example.ch", port: 587, security: "STARTTLS", user: "verein", fromName: "Verein", fromEmail: "info@example.ch", hasPassword: true };
  const next = { host: "smtp.evil.test", port: 587, security: "STARTTLS", user: "verein", fromName: "Verein", fromEmail: "info@example.ch", password: "Sup3rGeheim!" };
  const r = settingsAudit.mailSettingsAudit(before, next);
  assert.deepEqual(r.changed, ["host", "password"]);
  const text = JSON.stringify(r);
  assert.ok(!text.includes("Sup3rGeheim"));
  assert.ok(text.includes("smtp.evil.test") && text.includes("smtp.example.ch"));
  assert.deepEqual(settingsAudit.mailSettingsAudit(before, { ...next, host: "smtp.example.ch", password: undefined }).changed, []);
  assert.deepEqual(settingsAudit.mailSettingsAudit(before, { ...next, host: "smtp.example.ch", password: "" }).changed, ["password"]);
  assert.deepEqual(settingsAudit.mailSettingsAudit({ ...before, hasPassword: false }, { ...next, host: "smtp.example.ch", password: "" }).changed, []);
});

test("Genehmigtes Protokoll: Sicherung im vollen Wortlaut, das Änderungsprotokoll allein kürzt", () => {
  const original = "Beschluss: ".concat("x".repeat(900));
  // Das Änderungsprotokoll kürzt lange Texte auf 500 Zeichen (Beleg für die Lücke) ...
  const logged = audit.serializeAuditValue({ minutes: original })!;
  assert.ok(logged.length < original.length);
  // ... die Sicherung enthält den ganzen Text samt Hash.
  const snap = minutes.minutesSnapshot(original);
  assert.equal(snap.text, original);
  assert.match(snap.sha256, /^[0-9a-f]{64}$/);
  assert.notEqual(snap.sha256, minutes.minutesSnapshot(`${original}.`).sha256);
});

test("Genehmigtes Protokoll: Datum, Titel, Leitung, Protokollführung, Quorum und Art sind gesperrt", () => {
  const before = { title: "GV 2026", startsAt: d(2026, 11, 30), leaderId: "a", recorderId: "b", quorumMin: 10, kind: "MITGLIEDERVERSAMMLUNG" };
  assert.deepEqual(meetings.changedMinutesBoundFields(before, {}), []);
  assert.deepEqual(meetings.changedMinutesBoundFields(before, { title: "GV 2026" }), []);
  assert.deepEqual(meetings.changedMinutesBoundFields(before, { startsAt: d(2026, 11, 30) }), []);
  assert.deepEqual(meetings.changedMinutesBoundFields(before, { startsAt: d(2026, 12, 1) }), ["startsAt"]);
  assert.deepEqual(meetings.changedMinutesBoundFields(before, { title: "Neu", quorumMin: null, leaderId: "c" }).sort(), ["leaderId", "quorumMin", "title"]);
});

// ---- Fachlogik ------------------------------------------------------------------------------------------------------------

test("Monatsbilanz: Geschäftsjahr ab 15.7. rechnet tagesgenau, die Summe stimmt mit der Jahresrechnung", () => {
  const start = { month: 7, day: 15 };
  assert.equal(ledger.monthIndexOf(d(2027, 7, 5), 2026, start), 11, "5.7.2027 gehört noch zum Geschäftsjahr 2026");
  assert.equal(ledger.monthIndexOf(d(2027, 7, 14), 2026, start), 11);
  assert.equal(ledger.monthIndexOf(d(2027, 7, 15), 2026, start), null, "15.7.2027 beginnt das nächste Geschäftsjahr");
  assert.equal(ledger.monthIndexOf(d(2026, 7, 14), 2026, start), null);
  assert.equal(ledger.monthIndexOf(d(2026, 7, 15), 2026, start), 0);
  assert.equal(ledger.monthIndexOf(d(2026, 8, 14), 2026, start), 0, "1. bis 14. eines Monats zählt zum Vormonat");
  assert.equal(ledger.monthIndexOf(d(2026, 8, 15), 2026, start), 1);
  // Beginn am 1.: unverändert
  assert.equal(ledger.monthIndexOf(d(2027, 6, 30), 2026, { month: 7, day: 1 }), 11);

  const accounts = [
    { id: "bank", kind: "VERMOEGEN", number: "V01", name: "Bank", openingBalanceRappen: 0, active: true, sortOrder: 0 },
    { id: "beitr", kind: "EINNAHMEN", number: "E01", name: "Beiträge", openingBalanceRappen: 0, active: true, sortOrder: 0 },
  ];
  const entry = (bookingDate: Date, amountRappen: number) => ({ fiscalYear: dates.fiscalYearOf(bookingDate, start), direction: "EINNAHME", amountRappen, categoryId: "beitr", counterAccountId: "bank", reversal: false, bookingDate });
  const entries = [entry(d(2027, 7, 5), 1000), entry(d(2026, 7, 20), 2500), entry(d(2026, 8, 3), 700)];
  const annual = ledger.buildAnnualStatement(accounts, entries, 2026);
  const series = ledger.monthlySeries(accounts, entries, 2026, start, 0);
  assert.equal(annual.totalIncomeRappen, 4200);
  assert.equal(series.reduce((sum, r) => sum + r.incomeRappen, 0), annual.totalIncomeRappen);
  assert.equal(series[0]!.incomeRappen, 3200);
  assert.equal(series[11]!.incomeRappen, 1000);
});

test("Einladungsfrist: Rechnung und Beschreibung stimmen überein", () => {
  // Versammlung 30.11., Frist 14 Tage: spätester Versandtag 16.11. (Tagesdifferenz 14, dazwischen 13 volle Tage)
  const latest = dates.latestInvitationDate(d(2026, 11, 30), 14);
  assert.equal(dates.formatDateCh(latest), "16.11.2026");
  assert.equal(dates.daysBetween(latest, d(2026, 11, 30)), 14);
  assert.equal(dates.isInvitationOnTime(d(2026, 11, 16), d(2026, 11, 30), 14), true);
  assert.equal(dates.isInvitationOnTime(d(2026, 11, 17), d(2026, 11, 30), 14), false);
  const t = meetings.invitationTiming({ start: new Date("2026-11-30T18:00:00Z"), minDays: 14, now: new Date("2026-11-05T10:00:00Z") });
  assert.match(t.text, /Versandtag und Versammlungstag/);
  assert.match(t.text, /Statuten/);
});

test("Mehrheitsregel: Voreinstellung ist als neutral und nicht als Gesetz bezeichnet; absolutes Mehr nennt den Ausstand", () => {
  assert.match(meetings.MAJORITY_DEFAULT_HINT, /Art\. 67 Abs\. 2 ZGB/);
  assert.match(meetings.MAJORITY_DEFAULT_HINT, /Neutrale Voreinstellung/);
  assert.match(meetings.MAJORITY_DEFAULT_HINT, /Statuten gehen vor/);
  const out = meetings.tallyResolution({ yes: 6, no: 2, majority: "ABSOLUT", presentVoters: 11 });
  assert.equal(out.result, "ANGENOMMEN");
  assert.match(out.note, /Ausstand \(Art\. 68 ZGB\)/);
});

test("Kalendereintrag einer Sitzung: SEQUENCE steigt mit jeder Änderung", () => {
  const base = { id: "m1", kind: "MITGLIEDERVERSAMMLUNG", title: "GV", startsAt: new Date("2026-11-30T18:00:00Z"), endsAt: null, location: "", status: "EINGELADEN" };
  const first = meetings.meetingIcsEvent({ ...base, updatedAt: new Date("2026-11-01T10:00:00Z") });
  const later = meetings.meetingIcsEvent({ ...base, status: "ABGESAGT", updatedAt: new Date("2026-11-02T10:05:00Z") });
  assert.ok((first.sequence ?? 0) > 0);
  assert.ok((later.sequence ?? 0) > (first.sequence ?? 0));
  assert.ok((later.sequence ?? 0) < 2 ** 31, "passt in 32 Bit");
  assert.equal(meetings.meetingIcsSequence(new Date(0)), 0);
});

test("Ausweis: «neu ausstellen» entwertet ausgegebene QR-Codes", () => {
  const secret = "ein-geheimnis-fuer-den-test-mindestens-32-zeichen";
  const v0 = card.signCardToken(secret, "cm1abc2def");
  const v1 = card.signCardToken(secret, "cm1abc2def", 1);
  assert.notEqual(v0, v1);
  assert.deepEqual(card.verifyCardToken(secret, v0), { memberId: "cm1abc2def", version: 0 });
  assert.deepEqual(card.verifyCardToken(secret, v1), { memberId: "cm1abc2def", version: 1 });
  // Die Version lässt sich nicht nachträglich ändern
  const parts = v1.split(".");
  assert.equal(card.verifyCardToken(secret, `${parts[0]}.2.${parts[2]}`), null);
  assert.equal(card.verifyCardToken(secret, `${parts[0]}.0.${parts[2]}`), null);
  assert.equal(card.verifyCardToken(secret, `${parts[0]}.${parts[2]}`), null, "Version 1 ohne Versionsangabe ist ungültig");
  // Der Aufrufer vergleicht mit Member.cardVersion: ein Token der Version 0 passt nach dem Neuausstellen (Version 1) nicht mehr
  assert.notEqual(card.verifyCardToken(secret, v0)!.version, 1);
});

test("Rechnungs-Link läuft ab und gilt nach der Zahlung nur noch kurz", () => {
  const now = new Date("2026-11-05T10:00:00Z");
  const due = d(2026, 12, 5);
  const exp = feesCalc.invoiceLinkExpiry(now, due);
  assert.ok(exp.getTime() >= due.getTime() + 89 * 86_400_000);
  // Bereits überfällige Rechnung: mindestens 30 Tage ab Versand
  assert.ok(feesCalc.invoiceLinkExpiry(now, d(2026, 1, 1)).getTime() >= now.getTime() + 30 * 86_400_000);
  const open = { status: "OFFEN", viewTokenExpiresAt: exp, paidAt: null };
  assert.equal(feesCalc.isInvoiceLinkActive(open, now), true);
  assert.equal(feesCalc.isInvoiceLinkActive(open, new Date(exp.getTime() + 1000)), false);
  assert.equal(feesCalc.isInvoiceLinkActive({ ...open, viewTokenExpiresAt: null }, new Date("2040-01-01")), true, "alter Link ohne Ablauf");
  const paid = { status: "BEZAHLT", viewTokenExpiresAt: exp, paidAt: new Date("2026-11-10T10:00:00Z") };
  assert.equal(feesCalc.isInvoiceLinkActive(paid, new Date("2026-11-20T10:00:00Z")), true);
  assert.equal(feesCalc.isInvoiceLinkActive(paid, new Date("2026-12-20T10:00:00Z")), false);
  assert.equal(feesCalc.isInvoiceLinkActive({ ...open, status: "ENTWURF" }, now), false);
});

test("Beträge passen in eine 32-Bit-Ganzzahl der Datenbank (PostgreSQL)", () => {
  const INT32 = 2_147_483_647;
  assert.ok(money.MAX_RAPPEN <= INT32);
  assert.ok(feesCalc.MAX_INVOICE_RAPPEN <= INT32);
  assert.equal(money.isRappen(money.MAX_RAPPEN), true);
  assert.equal(money.isRappen(INT32 + 1), false);
  assert.equal(money.parseChf("21474837.00"), null, "mehr als CHF 20 Mio. wird abgelehnt");
  assert.equal(money.parseChf("20000000.00"), 2_000_000_000);
  // Mehrere Zahlungen auf eine Rechnung dürfen die Obergrenze nicht überschreiten
  assert.equal(feesCalc.paidWithinLimit(1_500_000_000, 400_000_000), true);
  assert.equal(feesCalc.paidWithinLimit(1_500_000_000, 600_000_000), false);
  assert.equal(feesCalc.paidWithinLimit(Number.MAX_SAFE_INTEGER, 1), false);
});

test("QR-Rechnung: die Daten stehen in einem einzigen Byte-Segment", () => {
  const creditor = { name: "Muster Verein", street: "Musterstrasse", houseNo: "1", zip: "9000", town: "Musterort", country: "CH" };
  const debtor = { name: "Anna Beispiel", street: "Beispielweg", houseNo: "7", zip: "8000", town: "Zürich", country: "CH" };
  const payload = qr.buildQrBillPayload({ account: "CH4431999123000889012", creditor, amountRappen: 123450, debtor, referenceType: "QRR", reference: "210000000003139471430009017", message: "Rechnung 2026-0001" });
  const g = qrSvg.qrBillQrGeometry(payload);
  assert.equal(g.segments, 1);
  assert.ok(g.version <= 25);
  // Auch ein Inhalt mit langen Ziffernfolgen und Umlauten bleibt ein Segment und passt in Version 25
  const long = `${"1234567890".repeat(90)}Zürich`.slice(0, 990);
  assert.ok(new TextEncoder().encode(long).length <= 997);
  assert.equal(qrSvg.qrBillQrGeometry(long).segments, 1);
  assert.ok(qrSvg.qrBillQrGeometry(long).version <= 25);
});

test("Austritt: Beschreibung der Regel ist grammatisch richtig", () => {
  assert.match(dates.EXIT_MODE_LABEL.KALENDERJAHR, /Kalenderjahr/);
  assert.match(members.describeExitRule({ mode: "KALENDERJAHR", noticeMonths: 6 }), /spätestens 6 Monate vorher/);
  assert.match(members.describeExitRule({ mode: "GESCHAEFTSJAHR", noticeMonths: 1 }), /spätestens einen Monat vorher/);
  assert.doesNotMatch(members.describeExitRule({ mode: "KALENDERJAHR", noticeMonths: 6 }), /Monaten vorher/);
});
