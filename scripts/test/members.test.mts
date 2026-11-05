// Tests für die Fachlogik des Moduls Mitglieder (Austritt, Mitgliedernummer, Statusübergänge, Ämter, Verknüpfung, Anonymisierung, Export).
// Aufruf:  npx tsx scripts/test/members.test.mts
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const serverOnlyPath = require.resolve("server-only");
require.cache[serverOnlyPath] = { id: serverOnlyPath, filename: serverOnlyPath, loaded: true, exports: {}, children: [], paths: [] } as unknown as NodeJS.Module;

const dates = await import("../../src/lib/verein/dates.ts");
const lib = await import("../../src/lib/verein/members-lib.ts");
const schemas = await import("../../src/lib/verein/members-schemas.ts");
const ids = await import("../../src/lib/verein/ids.ts");
const csv = await import("../../src/lib/verein/csv.ts");

const d = dates.dateOnly;
const fmt = dates.formatDateCh;
const KAL = { mode: "KALENDERJAHR", noticeMonths: 6 } as const;
const FISCAL_JAN = { month: 1, day: 1 };

// ---- Austritt -----------------------------------------------------------------------------------------------------------

test("Austritt: Kalenderjahr mit 6 Monaten Frist (ZGB Art. 70 Abs. 2)", () => {
  // Rechtzeitig: bis und mit 30.6. -> Ende des laufenden Jahres
  assert.equal(fmt(lib.planExit({ noticeAt: d(2026, 6, 30), rule: KAL, fiscal: FISCAL_JAN }).effective), "31.12.2026");
  assert.equal(fmt(lib.planExit({ noticeAt: d(2026, 1, 2), rule: KAL, fiscal: FISCAL_JAN }).effective), "31.12.2026");
  // Zu spät: ab 1.7. -> Ende des Folgejahres
  assert.equal(fmt(lib.planExit({ noticeAt: d(2026, 7, 1), rule: KAL, fiscal: FISCAL_JAN }).effective), "31.12.2027");
  assert.equal(fmt(lib.planExit({ noticeAt: d(2026, 11, 5), rule: KAL, fiscal: FISCAL_JAN }).effective), "31.12.2027");
  assert.equal(fmt(lib.planExit({ noticeAt: d(2026, 12, 31), rule: KAL, fiscal: FISCAL_JAN }).effective), "31.12.2027");
});

test("Austritt: abweichende Frist und Geschäftsjahr aus den Einstellungen", () => {
  const three = { mode: "KALENDERJAHR", noticeMonths: 3 } as const;
  assert.equal(fmt(lib.planExit({ noticeAt: d(2026, 9, 30), rule: three, fiscal: FISCAL_JAN }).effective), "31.12.2026");
  assert.equal(fmt(lib.planExit({ noticeAt: d(2026, 10, 1), rule: three, fiscal: FISCAL_JAN }).effective), "31.12.2027");
  // Geschäftsjahr ab 1.7.: Ende 30.6.; Frist 6 Monate -> bis 31.12.
  const fy = { mode: "GESCHAEFTSJAHR", noticeMonths: 6 } as const;
  const july = { month: 7, day: 1 };
  assert.equal(fmt(lib.planExit({ noticeAt: d(2026, 11, 5), rule: fy, fiscal: july }).effective), "30.6.2027");
  assert.equal(fmt(lib.planExit({ noticeAt: d(2027, 1, 5), rule: fy, fiscal: july }).effective), "30.6.2028");
  // Jederzeit mit 3 Monaten Frist
  const any = { mode: "JEDERZEIT", noticeMonths: 3 } as const;
  assert.equal(fmt(lib.planExit({ noticeAt: d(2026, 11, 5), rule: any, fiscal: FISCAL_JAN }).effective), "5.2.2027");
  // Ende Monat wird geklemmt
  assert.equal(fmt(lib.planExit({ noticeAt: d(2026, 11, 30), rule: any, fiscal: FISCAL_JAN }).effective), "28.2.2027");
});

test("Austritt: früherer Wunschtermin wird markiert, Datum ohne Uhrzeit bleibt erhalten", () => {
  const p = lib.planExit({ noticeAt: d(2026, 11, 5), requested: d(2026, 12, 31), rule: KAL, fiscal: FISCAL_JAN });
  assert.equal(p.earlierThanRule, true);
  assert.equal(fmt(p.earliest), "31.12.2027");
  assert.equal(fmt(p.effective), "31.12.2026");
  const later = lib.planExit({ noticeAt: d(2026, 11, 5), requested: d(2028, 3, 31), rule: KAL, fiscal: FISCAL_JAN });
  assert.equal(later.earlierThanRule, false);
  assert.equal(fmt(later.effective), "31.3.2028");
  // Uhrzeit im Eingang spielt keine Rolle (Zürcher Kalendertag)
  const noon = lib.planExit({ noticeAt: new Date("2026-06-30T21:30:00Z"), rule: KAL, fiscal: FISCAL_JAN }); // 30.6. 23:30 Zürcher Zeit
  assert.equal(fmt(noon.noticeAt), "30.6.2026");
  assert.equal(fmt(noon.effective), "31.12.2026");
});

test("Austritt: fällig erst nach dem letzten Tag der Mitgliedschaft", () => {
  const m = { status: "AKTIV", leftAt: d(2026, 12, 31) };
  assert.equal(lib.isExitDue(m, d(2026, 12, 31)), false);
  assert.equal(lib.isExitDue(m, d(2027, 1, 1)), true);
  assert.equal(lib.isExitDue({ status: "AKTIV", leftAt: null }, d(2027, 1, 1)), false);
  assert.equal(lib.isExitDue({ status: "AUSGETRETEN", leftAt: d(2020, 1, 1) }, d(2027, 1, 1)), false);
});

test("Austritt: Beschreibung der Regel", () => {
  assert.match(lib.describeExitRule(KAL), /Kalenderjahr/);
  assert.match(lib.describeExitRule(KAL), /spätestens 6 Monate vorher/);
  assert.match(lib.describeExitRule({ mode: "KALENDERJAHR", noticeMonths: 1 }), /spätestens einen Monat vorher/);
  assert.match(lib.describeExitRule({ mode: "JEDERZEIT", noticeMonths: 6 }), /nach 6 Monaten/);
  assert.match(lib.describeExitRule({ mode: "JEDERZEIT", noticeMonths: 1 }), /nach einem Monat/);
});

// ---- Mitgliedernummer ---------------------------------------------------------------------------------------------------

type CounterRow = { key: string; value: number };
function fakeCounterClient(store: Map<string, number>) {
  return {
    counter: {
      upsert: async ({ where, create, update }: { where: { key: string }; create: CounterRow; update: { value: { increment: number } } }) => {
        const cur = store.get(where.key);
        const next = cur === undefined ? create.value : cur + update.value.increment;
        store.set(where.key, next);
        return { value: next };
      },
    },
  } as never;
}

test("Mitgliedernummer: fortlaufend ab 1, eindeutig und unabhängig von anderen Zählern", async () => {
  const store = new Map<string, number>();
  const c = fakeCounterClient(store);
  const nums: number[] = [];
  for (let i = 0; i < 5; i++) nums.push(await ids.nextMemberNumber(c));
  assert.deepEqual(nums, [1, 2, 3, 4, 5]);
  await ids.nextInvoiceNumber(c, 2026);
  assert.equal(await ids.nextMemberNumber(c), 6);
});

test("Mitgliedernummer: parallele Vergabe liefert nie dieselbe Nummer", async () => {
  const store = new Map<string, number>();
  const c = fakeCounterClient(store);
  const nums = await Promise.all(Array.from({ length: 20 }, () => ids.nextMemberNumber(c)));
  assert.equal(new Set(nums).size, 20);
  assert.equal(Math.max(...nums), 20);
});

test("Mitgliedernummer: Rollback der Transaktion lässt keine Lücke (Zähler wird mit zurückgerollt)", async () => {
  const store = new Map<string, number>();
  async function transaction<T>(fn: (c: never) => Promise<T>): Promise<T> {
    const snapshot = new Map(store);
    try {
      return await fn(fakeCounterClient(store));
    } catch (e) {
      store.clear();
      for (const [k, v] of snapshot) store.set(k, v);
      throw e;
    }
  }
  const first = await transaction(async (c) => ids.nextMemberNumber(c));
  await assert.rejects(transaction(async (c) => {
    await ids.nextMemberNumber(c);
    throw new Error("Anlegen fehlgeschlagen");
  }));
  const second = await transaction(async (c) => ids.nextMemberNumber(c));
  assert.equal(first, 1);
  assert.equal(second, 2);
});

// ---- Statusübergänge ----------------------------------------------------------------------------------------------------

test("Aktionen je Status", () => {
  assert.deepEqual(lib.availableActions({ status: "ANTRAG" }), ["accept", "reject"]);
  assert.deepEqual(lib.availableActions({ status: "ABGELEHNT" }), ["accept", "anonymize"]);
  assert.deepEqual(lib.availableActions({ status: "AKTIV" }), ["exit", "expel", "deceased"]);
  assert.deepEqual(lib.availableActions({ status: "AKTIV", exitNoticeAt: d(2026, 11, 5) }), ["exit-complete", "exit-withdraw", "expel", "deceased"]);
  assert.deepEqual(lib.availableActions({ status: "AUSGETRETEN" }), ["reinstate", "anonymize"]);
  assert.deepEqual(lib.availableActions({ status: "VERSTORBEN" }), ["anonymize"]);
  assert.deepEqual(lib.availableActions({ status: "AKTIV", anonymizedAt: new Date() }), []);
  // Personendaten entfernen nie bei aktiven Mitgliedern oder offenen Anträgen
  assert.equal(lib.canDoAction({ status: "AKTIV" }, "anonymize"), false);
  assert.equal(lib.canDoAction({ status: "ANTRAG" }, "anonymize"), false);
  assert.equal(lib.ANONYMIZABLE_STATUSES.includes("AKTIV"), false);
});

// ---- Verknüpfung mit dem Website-Konto ------------------------------------------------------------------------------------

test("Automatische Verknüpfung nur über bestätigte, gleiche E-Mail-Adresse", () => {
  const verified = { email: "Anna@Example.ch", emailVerifiedAt: new Date(), emailVerifiedViaMail: true, disabled: false };
  const member = { email: "anna@example.ch", userId: null, status: "AKTIV" };
  assert.equal(lib.canAutoLink(verified, member), true);
  assert.equal(lib.canAutoLink({ ...verified, emailVerifiedAt: null }, member), false, "unbestätigtes Konto");
  assert.equal(lib.canAutoLink({ ...verified, emailVerifiedViaMail: false }, member), false, "von Hand bestätigtes Konto (kein Mail-Nachweis)");
  assert.equal(lib.canAutoLink(verified, { ...member, emailUnconfirmed: true }), false, "Adresse aus dem Antrag ist nicht bestätigt");
  assert.equal(lib.canAutoLink({ ...verified, disabled: true }, member), false, "gesperrtes Konto");
  assert.equal(lib.canAutoLink(verified, { ...member, userId: "u1" }), false, "Mitglied hat schon ein Konto");
  assert.equal(lib.canAutoLink(verified, { ...member, status: "ANTRAG" }), false, "Antrag wird nie automatisch verknüpft");
  assert.equal(lib.canAutoLink(verified, { ...member, email: "andere@example.ch" }), false);
  assert.equal(lib.canAutoLink({ ...verified, email: "" }, { ...member, email: "" }), false, "leere Adresse");
});

// ---- Anonymisierung -----------------------------------------------------------------------------------------------------------

test("Anonymisierung entfernt Personendaten, behält Nummer, Status und Daten", () => {
  const at = new Date("2026-11-05T10:00:00Z");
  const f = lib.anonymizedFields(at) as Record<string, unknown>;
  for (const k of ["firstName", "street", "houseNumber", "zip", "city", "email", "phone", "exitReason", "boardNotes", "salutation"]) assert.equal(f[k], "", k);
  assert.equal(f.birthDate, null);
  assert.equal(f.userId, null);
  assert.equal(f.anonymizedAt, at);
  for (const k of ["memberNumber", "status", "joinedAt", "leftAt", "applicationAt"]) assert.equal(k in f, false, `${k} bleibt unverändert`);
  assert.equal(lib.memberName({ firstName: "", lastName: "Anonymisiert", anonymizedAt: at, memberNumber: 12 }), "Anonymisiert (Nr. 12)");
  assert.equal(lib.memberName({ firstName: "Anna", lastName: "Muster" }), "Anna Muster");
});

// ---- Protokoll ----------------------------------------------------------------------------------------------------------------

test("Protokoll: sensible Felder erscheinen nie im Klartext", () => {
  const before = { firstName: "Anna", boardNotes: "Streit um Beitrag", street: "Alte Gasse", status: "AKTIV", birthDate: d(1990, 1, 1), updatedAt: new Date(1) };
  const after = { firstName: "Anne", boardNotes: "Streit beigelegt", street: "Neue Gasse", status: "AKTIV", birthDate: d(1990, 1, 1), updatedAt: new Date(2) };
  const diff = lib.memberAuditDiff(before, after);
  assert.deepEqual(Object.keys(diff.after).sort(), ["boardNotes", "firstName", "street"]);
  assert.equal(diff.after.firstName, "Anne");
  const text = JSON.stringify(diff);
  assert.equal(text.includes("Streit"), false);
  assert.equal(text.includes("Gasse"), false);
  assert.deepEqual(lib.memberAuditDiff(before, { ...before }), { before: {}, after: {} });
});

// ---- Ämter -----------------------------------------------------------------------------------------------------------------------

test("Ämter: Zustand, Gruppen und Hinweis bei Doppelbesetzung", () => {
  const today = d(2026, 11, 5);
  const mk = (id: string, kind: string, from: Date, until: Date | null, memberId = "m1") => ({ id, kind, title: "", validFrom: from, validUntil: until, memberId });
  const offices = [
    mk("a", "PRAESIDENT", d(2025, 9, 1), null),
    mk("b", "KASSIER", d(2025, 9, 1), null, "m2"),
    mk("c", "REVISOR", d(2026, 1, 1), d(2027, 12, 31), "m3"),
    mk("d", "BEISITZ", d(2020, 1, 1), d(2022, 12, 31), "m4"),
    mk("e", "AKTUAR", d(2027, 1, 1), null, "m5"),
    mk("f", "SONSTIGES", d(2026, 1, 1), null, "m6"),
  ];
  assert.equal(lib.officeState(offices[0]!, today), "LAUFEND");
  assert.equal(lib.officeState(offices[3]!, today), "BEENDET");
  assert.equal(lib.officeState(offices[4]!, today), "GEPLANT");
  const g = lib.groupOffices(offices, today);
  assert.deepEqual(g.board.map((o) => o.id), ["a", "b"]);
  assert.deepEqual(g.auditors.map((o) => o.id), ["c"]);
  assert.deepEqual(g.other.map((o) => o.id), ["f"]);
  assert.deepEqual(g.planned.map((o) => o.id), ["e"]);
  assert.deepEqual(g.past.map((o) => o.id), ["d"]);
  // Doppelbesetzung eines Einzelamts: Hinweis, kein Fehler
  assert.match(lib.singleSeatWarning({ kind: "PRAESIDENT", validFrom: d(2026, 6, 1), validUntil: null }, offices) ?? "", /bereits besetzt/);
  assert.equal(lib.singleSeatWarning({ kind: "PRAESIDENT", validFrom: d(2020, 1, 1), validUntil: d(2024, 12, 31) }, offices), null);
  assert.equal(lib.singleSeatWarning({ kind: "BEISITZ", validFrom: d(2026, 6, 1), validUntil: null }, offices), null);
  assert.equal(lib.singleSeatWarning({ id: "a", kind: "PRAESIDENT", validFrom: d(2025, 9, 1), validUntil: null }, offices), null, "das Amt selbst zählt nicht");
  assert.equal(lib.validateOfficePeriod(d(2026, 5, 1), d(2026, 4, 30)) !== null, true);
  assert.equal(lib.validateOfficePeriod(d(2026, 5, 1), null), null);
});

test("Vorstand: Abgleich mit der Über-uns-Seite nur als Hinweis", () => {
  const r = lib.compareBoardWithWebsite(["Anna Muster", "Hüseyn Hüseynli"], ["Anna Muster", "Huseyn Huseynli", "Bruno Beispiel"]);
  assert.deepEqual(r.missingOnWebsite, []);
  assert.deepEqual(r.notInRecords, ["Bruno Beispiel"]);
  assert.equal(r.matches, false);
  assert.equal(lib.compareBoardWithWebsite(["A B"], ["a b"]).matches, true);
});

// ---- Export und Auskunft -----------------------------------------------------------------------------------------------------

test("Mitgliederexport: Formel-Injektion wird neutralisiert, keine Notizen und kein Geburtsdatum", () => {
  const rows = lib.memberCsvRows([
    {
      memberNumber: 7,
      salutation: "",
      firstName: "=HYPERLINK(\"http://x\")",
      lastName: "+Muster",
      street: "-Weg",
      houseNumber: "1",
      zip: "9410",
      city: "@Heiden",
      country: "CH",
      email: "a@b.ch",
      phone: "",
      status: "AKTIV",
      applicationAt: d(2026, 1, 5),
      joinedAt: d(2026, 1, 20),
      leftAt: null,
      communicationPref: "EMAIL",
      anonymizedAt: null,
      membershipTypeName: "Aktivmitglied",
    },
  ]);
  const text = csv.toCsv(lib.MEMBER_CSV_HEADERS, rows);
  assert.ok(text.includes("'=HYPERLINK"), "= wird mit ' neutralisiert");
  assert.ok(text.includes(";'+Muster;"));
  assert.ok(text.includes(";'-Weg;"));
  assert.ok(text.includes(";'@Heiden;"));
  assert.ok(text.includes("5.1.2026"));
  assert.equal(lib.MEMBER_CSV_HEADERS.some((h) => /Geburt|Notiz/i.test(h)), false);
  assert.equal(rows[0]!.length, lib.MEMBER_CSV_HEADERS.length);
});

test("Auskunft (revDSG): enthält die eigenen Daten, aber keine internen Notizen", () => {
  const out = lib.buildDisclosure({
    generatedAt: new Date("2026-11-05T10:00:00Z"),
    member: {
      memberNumber: 3,
      salutation: "FRAU",
      firstName: "Anna",
      lastName: "Muster",
      birthDate: d(1990, 2, 3),
      street: "Hauptstrasse",
      houseNumber: "1",
      zip: "9410",
      city: "Heiden",
      country: "CH",
      email: "anna@example.ch",
      phone: "",
      status: "AKTIV",
      applicationAt: d(2026, 1, 5),
      joinedAt: d(2026, 1, 20),
      exitNoticeAt: null,
      leftAt: null,
      exitReason: "",
      consentAt: new Date("2026-01-05T10:00:00Z"),
      communicationPref: "EMAIL",
      hasBoardNotes: true,
      membershipTypeName: "Aktivmitglied",
      hasAccount: true,
    },
    offices: [{ kind: "KASSIER", title: "", validFrom: d(2026, 1, 20), validUntil: null }],
    invoices: [{ number: "2026-0001", subject: "Mitgliederbeitrag 2026", issueDate: d(2026, 2, 1), dueDate: d(2026, 3, 1), totalRappen: 123450, paidRappen: 0, status: "OFFEN" }],
    payments: [],
    attendances: [],
    registrations: [],
  });
  assert.equal(out.stammdaten.Nachname, "Muster");
  assert.equal(out.stammdaten.Geburtsdatum, "3.2.1990");
  assert.equal(out.stammdaten["Interne Notizen vorhanden"], true);
  assert.equal(JSON.stringify(out).includes("boardNotes"), false);
  assert.equal(out.rechnungen[0]!.betragChf, "1’234.50");
  assert.equal(out.aemter[0]!.amt, "Kassier/in");
  assert.equal(out.aemter[0]!.bis, "offen");
  const rows = lib.disclosureCsvRows(out);
  assert.ok(rows.some((r) => r[0] === "Stammdaten" && r[2] === "Vorname" && r[3] === "Anna"));
  assert.ok(rows.some((r) => r[0] === "Rechnungen" && r[2] === "nummer" && r[3] === "2026-0001"));
});

// ---- Schemas ----------------------------------------------------------------------------------------------------------------------

test("Beitrittsantrag: Pflichtangaben, Einwilligung und Normalisierung", () => {
  const base = { firstName: " Anna ", lastName: "Muster", email: " Anna@Example.CH ", consent: true };
  const ok = schemas.applicationSchema.parse(base);
  assert.equal(ok.firstName, "Anna");
  assert.equal(ok.email, "anna@example.ch");
  assert.equal(ok.country, "CH");
  assert.equal(ok.communicationPref, "EMAIL");
  assert.throws(() => schemas.applicationSchema.parse({ ...base, consent: false }));
  assert.throws(() => schemas.applicationSchema.parse({ ...base, consent: undefined }));
  assert.throws(() => schemas.applicationSchema.parse({ ...base, email: "keine-adresse" }));
  assert.throws(() => schemas.applicationSchema.parse({ ...base, lastName: "" }));
  assert.throws(() => schemas.applicationSchema.parse({ ...base, phone: "abc" }));
  assert.throws(() => schemas.applicationSchema.parse({ ...base, message: "x".repeat(1001) }));
});

test("Aktionen: gültige und ungültige Eingaben", () => {
  const exit = schemas.memberActionSchema.parse({ action: "exit", noticeAt: "2026-11-05", reason: "Umzug" });
  assert.equal(exit.action, "exit");
  assert.equal(exit.action === "exit" && fmt(exit.noticeAt as Date), "5.11.2026");
  assert.throws(() => schemas.memberActionSchema.parse({ action: "exit", noticeAt: "32.13.2026" }));
  assert.throws(() => schemas.memberActionSchema.parse({ action: "expel", reason: "" }), "Ausschluss braucht eine Begründung");
  assert.throws(() => schemas.memberActionSchema.parse({ action: "löschen" }));
  assert.throws(() => schemas.memberActionSchema.parse({ action: "link-user", email: "kein-email" }));
  assert.equal(schemas.memberActionSchema.parse({ action: "accept" }).action, "accept");
});

test("Mitgliedschaftsart und Amt: Beträge und Pflichtfelder", () => {
  const t = schemas.membershipTypeSchema.parse({ name: "Aktivmitglied", annualFee: "1'234.50", votingRight: true, eligibleForBoard: true, selectable: true, active: true });
  assert.equal(t.annualFee, 123450);
  assert.throws(() => schemas.membershipTypeSchema.parse({ name: "X", annualFee: "viel", votingRight: true, eligibleForBoard: true, selectable: true, active: true }));
  assert.throws(() => schemas.officeCreateSchema.parse({ kind: "SONSTIGES", title: "", validFrom: "2026-01-01", memberId: "abc" }), "Eigene Bezeichnung nötig");
  assert.throws(() => schemas.officeCreateSchema.parse({ kind: "KASSIER", validFrom: "2026-05-01", validUntil: "2026-04-01", memberId: "abc" }), "Ende vor Beginn");
  assert.equal(schemas.officeCreateSchema.parse({ kind: "KASSIER", validFrom: "2026-05-01", memberId: "abc" }).validUntil, null);
});

test("Mitglied erfassen: E-Mail Pflicht bei Kontakt per E-Mail (ausser Antrag)", () => {
  const base = { firstName: "A", lastName: "B" };
  assert.throws(() => schemas.memberCreateSchema.parse(base));
  assert.equal(schemas.memberCreateSchema.parse({ ...base, email: "a@b.ch" }).status, "AKTIV");
  assert.doesNotThrow(() => schemas.memberCreateSchema.parse({ ...base, status: "ANTRAG" }));
  assert.doesNotThrow(() => schemas.memberCreateSchema.parse({ ...base, communicationPref: "POST" }));
});
