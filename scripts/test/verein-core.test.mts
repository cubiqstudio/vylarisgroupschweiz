// Tests für die reinen Vereins-Helfer unter src/lib/verein (ohne Server, ohne Datenbank).
// Aufruf:  npx tsx scripts/test/verein-core.test.mts
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

// "server-only" wirft ausserhalb von Next.js; für den Test durch ein leeres Modul ersetzen.
const require = createRequire(import.meta.url);
const serverOnlyPath = require.resolve("server-only");
require.cache[serverOnlyPath] = { id: serverOnlyPath, filename: serverOnlyPath, loaded: true, exports: {}, children: [], paths: [] } as unknown as NodeJS.Module;

const money = await import("../../src/lib/verein/money.ts");
const dates = await import("../../src/lib/verein/dates.ts");
const csv = await import("../../src/lib/verein/csv.ts");
const audit = await import("../../src/lib/verein/audit.ts");
const perms = await import("../../src/lib/verein/permissions.ts");
const ids = await import("../../src/lib/verein/ids.ts");
const iban = await import("../../src/lib/verein/iban.ts");
const ics = await import("../../src/lib/verein/ics.ts");
const files = await import("../../src/lib/verein/files.ts");
const sett = await import("../../src/lib/verein/settings-schema.ts");
const pag = await import("../../src/lib/verein/pagination.ts");
const links = await import("../../src/lib/verein/links.ts");
const val = await import("../../src/lib/verein/validation.ts");

const AP = "\u2019";

// ---- money ---------------------------------------------------------------------------------------------------------
test("money: formatChf", () => {
  assert.equal(money.formatChf(0), "0.00");
  assert.equal(money.formatChf(5), "0.05");
  assert.equal(money.formatChf(123450), `1${AP}234.50`);
  assert.equal(money.formatChf(100000000), `1${AP}000${AP}000.00`);
  assert.equal(money.formatChf(-123450), `-1${AP}234.50`);
  assert.equal(money.formatChf(99900), "999.00");
  assert.throws(() => money.formatChf(1.5));
  assert.equal(money.formatChfWithCurrency(1250), "CHF\u00a012.50");
  assert.equal(money.toDecimalString(123450), "1234.50");
  assert.equal(money.toDecimalString(-5), "-0.05");
});

test("money: parseChf akzeptiert übliche Schreibweisen", () => {
  const ok: Array<[string, number]> = [
    ["1234", 123400],
    ["1234.5", 123450],
    ["1234,5", 123450],
    ["1234,50", 123450],
    ["1'234.50", 123450],
    [`1${AP}234.50`, 123450],
    ["1 234,50", 123450],
    ["CHF 12", 1200],
    ["CHF 12.50", 1250],
    ["Fr. 12.50", 1250],
    ["12.–", 1200],
    ["12.-", 1200],
    ["-5.00", -500],
    ["0.05", 5],
    [".5", 50],
    ["1.234,56", 123456],
    ["1,234.56", 123456],
    ["1.234.567", 123456700],
    ["  7  ", 700],
  ];
  for (const [input, expected] of ok) assert.equal(money.parseChf(input), expected, input);
});

test("money: parseChf lehnt Mehrdeutiges und Ungültiges ab", () => {
  for (const bad of ["", "abc", "1.234", "12.345", "1,2,3", "1.23.4", "12.5.0", "1..2", "--5", "9999999999999", "1e5", "12 CHF 3"]) {
    assert.equal(money.parseChf(bad), null, bad);
  }
});

test("money: Rundung, Anteil, Summen", () => {
  assert.equal(money.roundToFiveRappen(1252), 1250);
  assert.equal(money.roundToFiveRappen(1253), 1255);
  assert.equal(money.roundToFiveRappen(1250), 1250);
  assert.equal(money.roundToFiveRappen(-1253), -1255);
  assert.equal(money.prorateAnnual(12000, 6), 6000);
  assert.equal(money.prorateAnnual(10000, 5), 4167);
  assert.equal(money.prorateAnnual(10000, 0), 0);
  assert.equal(money.prorateAnnual(10000, 12), 10000);
  assert.throws(() => money.prorateAnnual(1000, 13));
  assert.equal(money.sumRappen([100, 250, 5]), 355);
  assert.equal(money.lineTotal(3, 1250), 3750);
  assert.equal(money.openAmount(1000, 400), 600);
  assert.equal(money.openAmount(1000, 1400), 0);
  assert.ok(money.isRappen(100) && !money.isRappen(1.5) && !money.isRappen(money.MAX_RAPPEN + 1));
});

// ---- dates ---------------------------------------------------------------------------------------------------------
test("dates: Zürcher Zeit, Sommer- und Winterzeit", () => {
  assert.equal(dates.zurichOffsetMinutes(new Date("2026-01-15T12:00:00Z")), 60);
  assert.equal(dates.zurichOffsetMinutes(new Date("2026-07-15T12:00:00Z")), 120);
  // 31.12.2026 23:30 Zürcher Zeit ist noch der 31.12.
  assert.deepEqual(dates.zurichToDate(2026, 12, 31, 23, 30).toISOString(), "2026-12-31T22:30:00.000Z");
  assert.equal(dates.zurichToDate(2026, 7, 1, 0, 0).toISOString(), "2026-06-30T22:00:00.000Z");
  assert.equal(dates.formatDateCh(new Date("2026-06-30T22:30:00Z")), "1.7.2026");
  assert.equal(dates.formatDateTimeCh(new Date("2026-11-05T18:30:00Z")), "5.11.2026, 19:30 Uhr");
  // Umstellung Sommerzeit 2026: 29.3. 02:00 -> 03:00
  assert.equal(dates.zurichToDate(2026, 3, 29, 12, 0).toISOString(), "2026-03-29T10:00:00.000Z");
  assert.equal(dates.zurichToDate(2026, 10, 25, 12, 0).toISOString(), "2026-10-25T11:00:00.000Z");
});

test("dates: Datum ohne Uhrzeit", () => {
  const d = dates.dateOnly(2026, 11, 5);
  assert.equal(d.toISOString(), "2026-11-05T12:00:00.000Z");
  assert.equal(dates.toDateInputValue(d), "2026-11-05");
  assert.equal(dates.formatDateCh(d), "5.11.2026");
  assert.throws(() => dates.dateOnly(2026, 2, 30));
  assert.equal(dates.parseDateOnly("2026-11-05")?.toISOString(), d.toISOString());
  assert.equal(dates.parseDateOnly("5.11.2026")?.toISOString(), d.toISOString());
  assert.equal(dates.parseDateOnly("31.2.2026"), null);
  assert.equal(dates.parseDateOnly("abc"), null);
  assert.equal(dates.parseDateOnly("1.1.1800"), null);
  // Mitternacht Zürcher Zeit ist derselbe Kalendertag
  assert.equal(dates.toDateOnly(dates.zurichToDate(2026, 11, 5, 0, 0)).toISOString(), d.toISOString());
  assert.equal(dates.toDateOnly(dates.zurichToDate(2026, 11, 5, 23, 59)).toISOString(), d.toISOString());
  assert.equal(dates.parseDateTimeLocal("2026-11-05T19:30")?.toISOString(), "2026-11-05T18:30:00.000Z");
  assert.equal(dates.parseDateTimeLocal("5.11.2026 19:30")?.toISOString(), "2026-11-05T18:30:00.000Z");
  assert.equal(dates.parseDateTimeLocal("2026-11-05T25:00"), null);
  assert.equal(dates.toDateTimeLocalValue(new Date("2026-11-05T18:30:00Z")), "2026-11-05T19:30");
});

test("dates: Tage und Monate rechnen", () => {
  const d = dates.dateOnly(2026, 11, 5);
  assert.equal(dates.toDateInputValue(dates.addDays(d, 30)), "2026-12-05");
  assert.equal(dates.toDateInputValue(dates.addDays(d, -5)), "2026-10-31");
  assert.equal(dates.toDateInputValue(dates.addMonths(dates.dateOnly(2026, 12, 31), -6)), "2026-06-30");
  assert.equal(dates.toDateInputValue(dates.addMonths(dates.dateOnly(2026, 1, 31), 1)), "2026-02-28");
  assert.equal(dates.toDateInputValue(dates.addMonths(dates.dateOnly(2024, 1, 31), 1)), "2024-02-29");
  assert.equal(dates.toDateInputValue(dates.addMonths(dates.dateOnly(2026, 11, 15), 3)), "2027-02-15");
  assert.equal(dates.daysBetween(dates.dateOnly(2026, 1, 1), dates.dateOnly(2026, 12, 31)), 364);
  assert.equal(dates.daysBetween(dates.dateOnly(2026, 3, 28), dates.dateOnly(2026, 3, 30)), 2); // Sommerzeit-Umstellung dazwischen
  assert.equal(dates.toDateInputValue(dates.dueDateFrom(dates.dateOnly(2026, 11, 5), 30)), "2026-12-05");
});

test("dates: Fälligkeit gilt bis Ende des Fälligkeitstags", () => {
  const due = dates.dateOnly(2026, 12, 5);
  assert.equal(dates.isPastDue(due, dates.zurichToDate(2026, 12, 5, 23, 59)), false);
  assert.equal(dates.isPastDue(due, dates.zurichToDate(2026, 12, 6, 0, 1)), true);
  assert.equal(dates.isPastDue(due, dates.zurichToDate(2026, 12, 1, 8, 0)), false);
});

test("dates: Geschäftsjahr", () => {
  const cal = dates.fiscalYearRange(2026);
  assert.equal(dates.toDateInputValue(cal.start), "2026-01-01");
  assert.equal(dates.toDateInputValue(cal.end), "2026-12-31");
  const jul = { month: 7, day: 1 };
  const r = dates.fiscalYearRange(2026, jul);
  assert.equal(dates.toDateInputValue(r.start), "2026-07-01");
  assert.equal(dates.toDateInputValue(r.end), "2027-06-30");
  assert.equal(dates.fiscalYearOf(dates.dateOnly(2026, 6, 30), jul), 2025);
  assert.equal(dates.fiscalYearOf(dates.dateOnly(2026, 7, 1), jul), 2026);
  assert.equal(dates.fiscalYearOf(dates.dateOnly(2026, 11, 5)), 2026);
});

test("dates: Austritt nach ZGB Art. 70 Abs. 2 (Ende Kalenderjahr, 6 Monate Frist)", () => {
  const iso = (d: Date) => dates.toDateInputValue(d);
  // Frist: spätestens am 30.6. angekündigt
  assert.equal(iso(dates.earliestExitDate(dates.dateOnly(2026, 5, 15))), "2026-12-31");
  assert.equal(iso(dates.earliestExitDate(dates.dateOnly(2026, 6, 30))), "2026-12-31");
  assert.equal(iso(dates.earliestExitDate(dates.dateOnly(2026, 7, 1))), "2027-12-31");
  assert.equal(iso(dates.earliestExitDate(dates.dateOnly(2026, 11, 5))), "2027-12-31");
  assert.equal(iso(dates.earliestExitDate(dates.dateOnly(2026, 12, 31))), "2027-12-31");
  assert.equal(iso(dates.earliestExitDate(dates.dateOnly(2026, 1, 1))), "2026-12-31");
  // Geschäftsjahr 1.7.–30.6., 3 Monate: Ende 30.6.2027, Frist 30.3.2027
  const fy = { mode: "GESCHAEFTSJAHR" as const, noticeMonths: 3 };
  const jul = { month: 7, day: 1 };
  assert.equal(iso(dates.earliestExitDate(dates.dateOnly(2027, 3, 30), fy, jul)), "2027-06-30");
  assert.equal(iso(dates.earliestExitDate(dates.dateOnly(2027, 3, 31), fy, jul)), "2028-06-30");
  // Jederzeit mit Frist
  assert.equal(iso(dates.earliestExitDate(dates.dateOnly(2026, 11, 30), { mode: "JEDERZEIT", noticeMonths: 1 })), "2026-12-30");
  assert.equal(iso(dates.earliestExitDate(dates.dateOnly(2026, 11, 5), { mode: "KALENDERJAHR", noticeMonths: 0 })), "2026-12-31");
});

test("dates: Einladungsfrist", () => {
  const meeting = dates.zurichToDate(2026, 11, 30, 19, 0);
  assert.equal(dates.toDateInputValue(dates.latestInvitationDate(meeting, 14)), "2026-11-16");
  assert.equal(dates.isInvitationOnTime(dates.zurichToDate(2026, 11, 16, 22, 0), meeting, 14), true);
  assert.equal(dates.isInvitationOnTime(dates.zurichToDate(2026, 11, 17, 8, 0), meeting, 14), false);
});

// ---- csv ---------------------------------------------------------------------------------------------------------
test("csv: Format, BOM, Semikolon, Anführungszeichen", () => {
  const out = csv.toCsv(["Name", "Betrag", "Notiz"], [["Müller; Hans", csv.csvMoney(123450), 'Er sagte "hallo"'], ["Zeile\numbruch", csv.csvNumber(3), null]]);
  assert.ok(out.startsWith("\uFEFF"));
  assert.equal(
    out.slice(1),
    'Name;Betrag;Notiz\r\n"Müller; Hans";1234.50;"Er sagte ""hallo"""\r\n"Zeile\numbruch";3;\r\n',
  );
});

test("csv: Formel-Injektion wird neutralisiert", () => {
  for (const evil of ["=1+1", "+41 78 322 21 39", "-2+3", "@SUM(A1)", "\t=cmd", "\r=cmd", "=HYPERLINK(\"http://x\")"]) {
    const field = csv.csvField(evil);
    assert.ok(field.replace(/^"/, "").startsWith("'"), `${JSON.stringify(evil)} -> ${field}`);
  }
  assert.equal(csv.csvField("normal"), "normal");
  assert.equal(csv.csvField("a=b"), "a=b");
  assert.equal(csv.csvField(-5), "-5"); // echte Zahl, kein Text
  assert.equal(csv.csvField(true), "Ja");
  assert.equal(csv.csvField(new Date("2026-11-05T11:00:00Z")), "5.11.2026");
  assert.equal(csv.csvField(undefined), "");
  assert.throws(() => csv.csvNumber(Number.NaN));
});

test("csv: Dateiname und Antwort", async () => {
  assert.equal(csv.safeDownloadName("Mitglieder März 2026/../x"), "Mitglieder_Maerz_2026_.._x");
  assert.equal(csv.safeDownloadName("///"), "export");
  const res = csv.csvResponse("Mitglieder 2026.csv", ["A"], [["x"]]);
  assert.equal(res.headers.get("Content-Type"), "text/csv; charset=utf-8");
  assert.equal(res.headers.get("Content-Disposition"), 'attachment; filename="Mitglieder_2026.csv"');
  assert.equal(res.headers.get("Cache-Control"), "no-store");
  const body = new Uint8Array(await res.arrayBuffer());
  assert.deepEqual([...body.subarray(0, 3)], [0xef, 0xbb, 0xbf]); // BOM
  assert.equal(new TextDecoder("utf-8", { ignoreBOM: true }).decode(body), "\uFEFFA\r\nx\r\n");
});

// ---- audit -------------------------------------------------------------------------------------------------------
test("audit: Serialisierung ohne Geheimnisse", () => {
  const s = audit.serializeAuditValue({ name: "A", password: "x", passwordHash: "y", apiKey: "z", nested: { token: "t", ok: 1 }, when: new Date("2026-11-05T00:00:00Z"), iban: "CH93" });
  assert.ok(s);
  const o = JSON.parse(s!);
  assert.equal(o.password, "[verborgen]");
  assert.equal(o.passwordHash, "[verborgen]");
  assert.equal(o.apiKey, "[verborgen]");
  assert.equal(o.nested.token, "[verborgen]");
  assert.equal(o.nested.ok, 1);
  assert.equal(o.when, "2026-11-05T00:00:00.000Z");
  assert.equal(o.iban, "CH93");
  assert.equal(audit.serializeAuditValue(null), null);
  assert.equal(audit.serializeAuditValue(undefined), null);
});

test("audit: Zirkelbezüge, Bytes, BigInt und Grösse", () => {
  const a: Record<string, unknown> = { n: 1 };
  a.self = a;
  assert.equal(JSON.parse(audit.serializeAuditValue(a)!).self, "[Zirkelbezug]");
  assert.equal(JSON.parse(audit.serializeAuditValue({ data: new Uint8Array(10), big: 5n })!).data, "[10 Bytes]");
  const huge = audit.serializeAuditValue({ list: Array.from({ length: 50 }, () => "x".repeat(400)) })!;
  assert.ok(huge.length <= 8100);
  assert.equal(JSON.parse(audit.serializeAuditValue("x".repeat(2000))!).length, 501);
});

test("audit: diffObjects liefert nur Änderungen", () => {
  const d = audit.diffObjects(
    { a: 1, b: "x", c: new Date("2026-01-01T00:00:00Z"), d: { k: 1 }, updatedAt: new Date(1) },
    { a: 2, b: "x", c: new Date("2026-01-01T00:00:00Z"), d: { k: 1 }, updatedAt: new Date(2), e: "neu" },
  );
  assert.deepEqual(d, { before: { a: 1 }, after: { a: 2, e: "neu" } });
  assert.deepEqual(audit.diffObjects({ a: 1 }, { a: 1 }), { before: {}, after: {} });
});

test("audit: logAudit schreibt gekürzte, bereinigte Einträge", async () => {
  const rows: Array<Record<string, unknown>> = [];
  const client = { auditLog: { create: async ({ data }: { data: Record<string, unknown> }) => void rows.push(data) } };
  await audit.logAudit(client as never, {
    actor: audit.auditActor({ id: "u1", name: "Anna" }),
    action: "member.update",
    objectType: "Member",
    objectId: "m1",
    summary: "Mitglied 1 geändert",
    before: { status: "ANTRAG" },
    after: { status: "AKTIV", passwordHash: "x" },
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.actorType, "ADMIN");
  assert.equal(rows[0]!.actorId, "u1");
  assert.equal(rows[0]!.after, JSON.stringify({ status: "AKTIV", passwordHash: "[verborgen]" }));
  // logAuditSafe schluckt Fehler
  const failing = { auditLog: { create: async () => { throw new Error("db"); } } };
  const origError = console.error;
  console.error = () => {};
  try {
    await audit.logAuditSafe(failing as never, { actor: audit.SYSTEM_ACTOR, action: "x", objectType: "Y" });
  } finally {
    console.error = origError;
  }
  await assert.rejects(() => audit.logAudit(failing as never, { actor: audit.SYSTEM_ACTOR, action: "x", objectType: "Y" }));
});

// ---- permissions -----------------------------------------------------------------------------------------------
test("permissions: Rollenmatrix", () => {
  const can = perms.canAccess;
  for (const role of ["OWNER", "ADMIN"]) for (const m of perms.VEREIN_MODULES) assert.ok(can([role], m, "write"), `${role} ${m}`);
  assert.ok(can(["KASSIER"], "fees", "write"));
  assert.ok(can(["KASSIER"], "ledger", "write"));
  assert.ok(can(["KASSIER"], "members", "read"));
  assert.ok(!can(["KASSIER"], "members", "write"));
  assert.ok(!can(["KASSIER"], "website"));
  assert.ok(!can(["KASSIER"], "system"));
  assert.ok(can(["AKTUAR"], "meetings", "write"));
  assert.ok(!can(["AKTUAR"], "ledger"));
  assert.ok(!can(["AKTUAR"], "fees"));
  assert.ok(can(["PRAESIDENT"], "members", "write"));
  assert.ok(can(["PRAESIDENT"], "ledger", "read") && !can(["PRAESIDENT"], "ledger", "write"));
  assert.ok(can(["VIZEPRAESIDENT"], "verein_settings", "read") && !can(["VIZEPRAESIDENT"], "verein_settings", "write"));
  assert.ok(can(["EDITOR"], "website", "write") && !can(["EDITOR"], "members") && !can(["EDITOR"], "system"));
  // Revisor: nur lesend
  for (const m of perms.VEREIN_MODULES) assert.ok(!can(["REVISOR"], m, "write") || m === "self", `REVISOR schreibt ${m}`);
  assert.ok(can(["REVISOR"], "ledger", "read") && can(["REVISOR"], "audit", "read") && !can(["REVISOR"], "members"));
  // Unbekannte / leere Rollen dürfen nichts
  assert.ok(!can([], "dashboard"));
  assert.ok(!can(["HACKER"], "dashboard"));
  // Mehrere Rollen: höchste Stufe zählt
  assert.ok(can(["AKTUAR", "KASSIER"], "ledger", "write") && can(["AKTUAR", "KASSIER"], "meetings", "write"));
  assert.equal(perms.levelFor(["KASSIER", "REVISOR"], "ledger"), "write");
  assert.equal(perms.levelFor(["REVISOR"], "ledger"), "read");
  assert.equal(perms.levelFor(["REVISOR"], "members"), null);
});

test("permissions: wirksame Rollen", () => {
  assert.deepEqual(perms.effectiveRoles("KASSIER", "ADMIN, aktuar,FOO,KASSIER"), ["KASSIER", "ADMIN", "AKTUAR"]);
  assert.deepEqual(perms.effectiveRoles("unbekannt", ""), []);
  assert.deepEqual(perms.effectiveRoles("ADMIN"), ["ADMIN"]);
  assert.equal(perms.serializeExtraRoles("KASSIER", ["kassier", "ADMIN", "x", "ADMIN"]), "ADMIN");
  assert.ok(perms.hasBoardRole(["AKTUAR"]) && !perms.hasBoardRole(["REVISOR"]) && !perms.hasBoardRole(["EDITOR"]));
  assert.ok(perms.isAdminRole("OWNER") && !perms.isAdminRole("owner"));
});

test("permissions: Pfad → Modul, Methode → Stufe", () => {
  const m = perms.moduleForPath;
  assert.equal(m("/admin"), "dashboard");
  assert.equal(m("/admin/"), "dashboard");
  assert.equal(m("/api/admin/members"), "members");
  assert.equal(m("/api/admin/members/abc/export"), "members");
  assert.equal(m("/admin/members/new"), "members");
  assert.equal(m("/api/admin/invoices/x"), "fees");
  assert.equal(m("/admin/fees/invoices/x/print"), "fees");
  assert.equal(m("/api/admin/ledger/transactions"), "ledger");
  assert.equal(m("/api/admin/settings/verein"), "verein_settings");
  assert.equal(m("/api/admin/settings/verein/finanzen"), "finance_settings");
  assert.equal(m("/admin/verein/finanzen"), "finance_settings");
  assert.equal(m("/admin/verein"), "verein_settings");
  assert.equal(m("/admin/verein/zugaenge"), "system");
  assert.equal(m("/admin/verein/protokoll"), "audit");
  assert.equal(m("/api/admin/settings/mail"), "system");
  assert.equal(m("/api/admin/tickets/5"), "website");
  assert.equal(m("/api/admin/newsletter/campaigns"), "newsletter");
  assert.equal(m("/api/admin/account/password"), "self");
  assert.equal(m("/api/admin/unbekannt"), "system");
  assert.equal(m("/api/admin/membersx"), "system"); // kein Präfix-Treffer ohne Trennzeichen
  assert.equal(perms.levelForMethod("GET"), "read");
  assert.equal(perms.levelForMethod("post"), "write");
  assert.equal(perms.levelForMethod("DELETE"), "write");
});

test("permissions: Navigation wird nach Rolle gefiltert", () => {
  const groups = [
    { title: "Verein", items: [{ href: "/admin/members", label: "Mitglieder", module: "members" as const }, { href: "/admin/ledger", label: "Kassa", module: "ledger" as const }] },
    { title: "Website", items: [{ href: "/admin/blog", label: "Blog", module: "website" as const }] },
  ];
  const rev = perms.filterNav(groups, ["REVISOR"]);
  assert.deepEqual(rev.map((g) => [g.title, g.items.map((i) => i.label)]), [["Verein", ["Kassa"]]]);
  assert.equal(perms.filterNav(groups, []).length, 0);
  assert.equal(perms.filterNav(groups, ["ADMIN"]).length, 2);
  assert.ok(perms.visibleModules(["REVISOR"]).includes("ledger"));
});

// ---- ids ---------------------------------------------------------------------------------------------------------
test("ids: Formate", () => {
  assert.equal(ids.formatInvoiceNumber(2026, 1), "2026-0001");
  assert.equal(ids.formatInvoiceNumber(2026, 12345), "2026-12345");
  assert.equal(ids.formatVoucherNumber(2026, 42), "B-2026-0042");
  assert.deepEqual(ids.parseInvoiceNumber("2026-0007"), { year: 2026, seq: 7 });
  assert.equal(ids.parseInvoiceNumber("26-7"), null);
  assert.equal(ids.invoiceCounterKey(2026), "invoice:2026");
});

function fakeCounter(conflictsFirst = 0) {
  const store = new Map<string, number>();
  let conflicts = conflictsFirst;
  const client = {
    counter: {
      upsert: async ({ where, create, update }: { where: { key: string }; create: { key: string; value: number }; update: { value: { increment: number } } }) => {
        if (conflicts > 0) {
          conflicts--;
          throw Object.assign(new Error("Unique"), { code: "P2002" });
        }
        const cur = store.get(where.key);
        const next = cur === undefined ? create.value : cur + update.value.increment;
        store.set(where.key, next);
        return { value: next };
      },
    },
  };
  return { client, store };
}

test("ids: nextSequence zählt je Schlüssel fortlaufend", async () => {
  const { client } = fakeCounter();
  assert.equal(await ids.nextMemberNumber(client as never), 1);
  assert.equal(await ids.nextMemberNumber(client as never), 2);
  assert.deepEqual(await ids.nextInvoiceNumber(client as never, 2026), { number: "2026-0001", year: 2026, seq: 1 });
  assert.deepEqual(await ids.nextInvoiceNumber(client as never, 2026), { number: "2026-0002", year: 2026, seq: 2 });
  assert.deepEqual(await ids.nextInvoiceNumber(client as never, 2027), { number: "2027-0001", year: 2027, seq: 1 });
  assert.deepEqual(await ids.nextVoucherNumber(client as never, 2026), { number: "B-2026-0001", year: 2026, seq: 1 });
});

test("ids: parallele Vergabe liefert eindeutige Nummern; Konflikt beim Anlegen wird wiederholt", async () => {
  const { client } = fakeCounter();
  const nums = await Promise.all(Array.from({ length: 20 }, () => ids.nextMemberNumber(client as never)));
  assert.equal(new Set(nums).size, 20);
  assert.equal(Math.max(...nums), 20);
  const retry = fakeCounter(1);
  assert.equal(await ids.nextMemberNumber(retry.client as never), 1);
  const hard = fakeCounter(5);
  await assert.rejects(() => ids.nextMemberNumber(hard.client as never));
  const other = { counter: { upsert: async () => { throw new Error("kaputt"); } } };
  await assert.rejects(() => ids.nextMemberNumber(other as never), /kaputt/);
});

// ---- iban --------------------------------------------------------------------------------------------------------
test("iban: Prüfsumme und QR-IBAN", () => {
  assert.equal(iban.isValidIban("CH93 0076 2011 6238 5295 7"), true);
  assert.equal(iban.isValidIban("ch9300762011623852957"), true);
  assert.equal(iban.isValidIban("CH93 0076 2011 6238 5295 8"), false);
  assert.equal(iban.isValidIban("DE89 3704 0044 0532 0130 00"), true);
  assert.equal(iban.isValidSwissIban("DE89 3704 0044 0532 0130 00"), false);
  assert.equal(iban.isValidSwissIban("CH93 0076 2011 6238 5295 7"), true);
  assert.equal(iban.isValidSwissIban("LI21 0881 0000 2324 013A A"), true);
  assert.equal(iban.isQrIban("CH93 0076 2011 6238 5295 7"), false);
  assert.equal(iban.isQrIban("CH44 3199 9123 0008 8901 2"), true); // Beispiel aus dem Style Guide QR-Rechnung
  assert.equal(iban.formatIban("ch9300762011623852957"), "CH93 0076 2011 6238 5295 7");
  assert.equal(iban.isValidIban("abc"), false);
});

test("iban: QR-Referenz und Creditor Reference", () => {
  // Beispiel aus der Schweizer Implementierungsrichtlinie: 21 00000 00003 13947 14300 09017
  assert.equal(iban.isValidQrReference("210000000003139471430009017"), true);
  assert.equal(iban.isValidQrReference("21 00000 00003 13947 14300 09017"), true);
  assert.equal(iban.isValidQrReference("210000000003139471430009018"), false);
  assert.equal(iban.buildQrReference("21000000000313947143000901"), "210000000003139471430009017");
  assert.equal(iban.buildQrReference("1000").slice(0, 26), "1000".padStart(26, "0"));
  assert.equal(iban.buildQrReference("1").length, 27);
  assert.equal(iban.isValidQrReference(iban.buildQrReference("123456789")), true);
  assert.equal(iban.formatQrReference("210000000003139471430009017"), "21 00000 00003 13947 14300 09017");
  assert.throws(() => iban.buildQrReference("12a"));
  assert.throws(() => iban.buildQrReference("1".repeat(27)));
  assert.equal(iban.buildCreditorReference("539007547034"), "RF18539007547034");
  assert.equal(iban.isValidCreditorReference("RF18 5390 0754 7034"), true);
  assert.equal(iban.isValidCreditorReference("RF19539007547034"), false);
});

// ---- ics ---------------------------------------------------------------------------------------------------------
test("ics: Kalenderdatei", () => {
  const out = ics.buildIcs(
    [
      {
        uid: "abc123",
        title: "Hauptversammlung; mit, Komma",
        description: "Zeile 1\nZeile 2 mit \\ Backslash",
        location: "Heiden",
        start: new Date("2026-11-30T18:00:00Z"),
        end: new Date("2026-11-30T20:00:00Z"),
        url: "https://vylaris.ch/anlaesse/abc123",
        updatedAt: new Date("2026-11-05T10:00:00Z"),
        sequence: 2,
      },
      { uid: "x y\r\nEVIL:1", title: "Abgesagt", start: new Date("2026-12-01T10:00:00Z"), cancelled: true, updatedAt: new Date("2026-11-05T10:00:00Z") },
    ],
    { calendarName: "Vereinskalender", now: new Date("2026-11-05T10:00:00Z") },
  );
  assert.ok(out.startsWith("BEGIN:VCALENDAR\r\n"));
  assert.ok(out.endsWith("END:VCALENDAR\r\n"));
  assert.ok(out.includes("SUMMARY:Hauptversammlung\; mit\\, Komma\r\n"));
  assert.ok(out.includes("DESCRIPTION:Zeile 1\\nZeile 2 mit \\\\ Backslash\r\n"));
  assert.ok(out.includes("DTSTART:20261130T180000Z\r\n"));
  assert.ok(out.includes("DTEND:20261130T200000Z\r\n"));
  assert.ok(out.includes("UID:abc123@vylaris.ch\r\n"));
  assert.ok(out.includes("SEQUENCE:2\r\n"));
  assert.ok(out.includes("STATUS:CANCELLED\r\n"));
  assert.ok(!out.includes("\r\nEVIL:1"), "Header-Injektion über die UID");
  assert.ok(out.includes("UID:xyEVIL1@vylaris.ch"));
  // jede Zeile höchstens 75 Oktette
  for (const line of out.split("\r\n")) assert.ok(new TextEncoder().encode(line).length <= 75, line);
});

test("ics: Zeilenfaltung bricht keine Mehrbyte-Zeichen", () => {
  const line = "SUMMARY:" + "ä".repeat(80);
  const folded = ics.foldIcsLine(line);
  const parts = folded.split("\r\n");
  assert.ok(parts.length > 1);
  for (const p of parts) assert.ok(new TextEncoder().encode(p).length <= 75);
  assert.equal(parts.map((p, i) => (i === 0 ? p : p.slice(1))).join(""), line);
});

// ---- files -------------------------------------------------------------------------------------------------------
test("files: Typ-Erkennung und Prüfung", async () => {
  const pdf = Buffer.from("%PDF-1.7\n...");
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
  const exe = Buffer.from("MZ\x90\x00\x03\x00\x00\x00");
  const html = Buffer.from("<html><script>alert(1)</script>");
  assert.equal(files.sniffKind(pdf), "pdf");
  assert.equal(files.sniffKind(png), "png");
  assert.equal(files.sniffKind(jpg), "jpeg");
  assert.equal(files.sniffKind(exe), null);
  assert.equal(files.sniffKind(html), null);
  assert.equal(files.sniffKind(html, "x.html"), null);
  assert.equal(files.sniffKind(Buffer.from("Hallo Welt\n"), "a.txt"), "txt");
  assert.equal(files.sniffKind(Buffer.from([0x68, 0x00, 0x01, 0x02, 0x03]), "a.txt"), null);
  assert.equal(files.sniffKind(Buffer.from("PK\x03\x04rest"), "a.docx"), "docx");
  assert.equal(files.sniffKind(Buffer.from("PK\x03\x04rest"), "a.zip"), null);

  const mk = (b: Buffer, name: string) => new File([new Uint8Array(b)], name);
  const ok = await files.checkUpload(mk(pdf, "../../Rechnung März.PDF"), { maxBytes: 1024, kinds: files.RECEIPT_KINDS });
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.mimeType, "application/pdf");
    assert.equal(ok.fileName, "Rechnung_Maerz.pdf");
    assert.equal(ok.sha256.length, 64);
    assert.equal(ok.sizeBytes, pdf.length);
  }
  const big = await files.checkUpload(mk(pdf, "a.pdf"), { maxBytes: 4, kinds: files.RECEIPT_KINDS });
  assert.deepEqual(big, { ok: false, error: "Die Datei ist zu gross (höchstens 0 MB)." });
  const bad = await files.checkUpload(mk(exe, "virus.pdf"), { maxBytes: 1024, kinds: files.RECEIPT_KINDS });
  assert.equal(bad.ok, false);
  const wrongKind = await files.checkUpload(mk(Buffer.from("Hallo\n"), "a.txt"), { maxBytes: 1024, kinds: files.RECEIPT_KINDS });
  assert.equal(wrongKind.ok, false);
  const empty = await files.checkUpload(mk(Buffer.alloc(0), "a.pdf"), { maxBytes: 1024, kinds: files.RECEIPT_KINDS });
  assert.deepEqual(empty, { ok: false, error: "Die Datei ist leer." });
});

test("files: Dateinamen und Download-Header", () => {
  assert.equal(files.sanitizeFileName("C:\\evil\\..\\Beleg 1.PNG"), "Beleg_1.png");
  assert.equal(files.sanitizeFileName("../../etc/passwd"), "passwd");
  assert.equal(files.sanitizeFileName(""), "datei");
  const h = files.downloadHeaders('a"b.pdf', "application/pdf", 5);
  assert.ok(h["Content-Disposition"]!.startsWith("attachment;"));
  assert.ok(!h["Content-Disposition"]!.includes('a"b'));
  assert.equal(h["X-Content-Type-Options"], "nosniff");
  assert.equal(h["Content-Length"], "5");
});

// ---- settings ----------------------------------------------------------------------------------------------------
test("settings: Voreinstellungen erfinden nichts", () => {
  const d = sett.DEFAULT_VEREIN_SETTINGS;
  assert.equal(d.paymentDays, null);
  assert.equal(d.invitationDays, null);
  assert.equal(d.reminderDays1, null);
  assert.equal(d.iban, "");
  assert.equal(d.applyEnabled, false);
  // Gesetz bzw. neutral: ZGB Art. 70 Abs. 2 und Kalenderjahr
  assert.equal(d.exitMode, "KALENDERJAHR");
  assert.equal(d.exitNoticeMonths, 6);
  assert.equal(d.fiscalStartMonth, 1);
  assert.equal(d.fiscalStartDay, 1);
  assert.equal(sett.missingForInvoicing(d).length, 3);
  assert.equal(sett.missingForInvitations(d).length, 1);
  assert.equal(sett.missingForReminders(d).length, 4);
  assert.equal(sett.missingSettings(d).length, 8);
});

test("settings: Schema validiert IBAN und Grenzen", () => {
  const base = { ...sett.DEFAULT_VEREIN_SETTINGS };
  assert.equal(sett.vereinSettingsSchema.safeParse(base).success, true);
  const good = sett.vereinSettingsSchema.safeParse({ ...base, iban: "ch93 0076 2011 6238 5295 7", paymentDays: 30 });
  assert.equal(good.success, true);
  if (good.success) assert.equal(good.data.iban, "CH9300762011623852957");
  assert.equal(sett.vereinSettingsSchema.safeParse({ ...base, iban: "CH93 0076 2011 6238 5295 8" }).success, false);
  assert.equal(sett.vereinSettingsSchema.safeParse({ ...base, iban: "CH44 3199 9123 0008 8901 2" }).success, false); // QR-IBAN gehört in qrIban
  assert.equal(sett.vereinSettingsSchema.safeParse({ ...base, qrIban: "CH44 3199 9123 0008 8901 2" }).success, true);
  assert.equal(sett.vereinSettingsSchema.safeParse({ ...base, qrIban: "CH93 0076 2011 6238 5295 7" }).success, false);
  assert.equal(sett.vereinSettingsSchema.safeParse({ ...base, paymentDays: -1 }).success, false);
  assert.equal(sett.vereinSettingsSchema.safeParse({ ...base, paymentDays: 1.5 }).success, false);
  assert.equal(sett.vereinSettingsSchema.safeParse({ ...base, fiscalStartDay: 31 }).success, false);
  assert.equal(sett.vereinSettingsSchema.safeParse({ ...base, exitMode: "NIE" }).success, false);
  assert.equal(sett.vereinSettingsSchema.safeParse({ ...base, replyToEmail: "kein-mail" }).success, false);
  assert.equal(sett.vereinSettingsSchema.safeParse({ ...base, applyNotifyEmail: "vorstand@example.org" }).success, true);
  assert.equal(sett.vereinSettingsPatchSchema.safeParse({ paymentDays: 30 }).success, true);
});

test("settings: Key/Value-Umwandlung", () => {
  const raw = {
    "verein.account.holder": "Verein Muster",
    "verein.account.iban": "CH9300762011623852957",
    "verein.fees.paymentDays": "30",
    "verein.fees.reminderFee1Rappen": "500",
    "verein.exit.noticeMonths": "3",
    "verein.public.applyEnabled": "true",
    "verein.assembly.invitationDays": "kaputt",
    "verein.exit.mode": "UNGUELTIG",
  };
  const s = sett.parseVereinSettings(raw);
  assert.equal(s.accountHolder, "Verein Muster");
  assert.equal(s.paymentDays, 30);
  assert.equal(s.reminderFee1Rappen, 500);
  assert.equal(s.exitNoticeMonths, 3);
  assert.equal(s.applyEnabled, true);
  assert.equal(s.invitationDays, null); // ungültig → Voreinstellung
  assert.equal(s.exitMode, "KALENDERJAHR"); // ungültig → Voreinstellung
  assert.equal(sett.reminderDaysFor(s, 1), null);
  assert.equal(sett.reminderFeeFor(s, 1), 500);
  assert.equal(sett.reminderFeeFor(s, 2), 0);
  assert.deepEqual(sett.serializeVereinSettings({ paymentDays: 14, invitationDays: null, applyEnabled: false, bank: "Raiffeisen" }), {
    "verein.fees.paymentDays": "14",
    "verein.assembly.invitationDays": null,
    "verein.public.applyEnabled": "false",
    "verein.account.bank": "Raiffeisen",
  });
  assert.deepEqual(sett.exitRuleOf(s), { mode: "KALENDERJAHR", noticeMonths: 3 });
  assert.deepEqual(sett.fiscalStartOf(s), { month: 1, day: 1 });
  // Rundlauf
  const flat = Object.fromEntries(Object.entries(sett.serializeVereinSettings(s)).filter((e): e is [string, string] => e[1] !== null));
  const back = sett.parseVereinSettings(flat);
  assert.deepEqual(back, s);
});

// ---- pagination --------------------------------------------------------------------------------------------------
test("pagination: Parameter und Metadaten", () => {
  const p = pag.listParams(new URLSearchParams("q=%20Müller%20&page=3&pageSize=500"));
  assert.deepEqual(p, { q: "Müller", page: 3, pageSize: 100, skip: 200, take: 100 });
  const d = pag.listParams({ q: ["a", "b"], page: "x" });
  assert.deepEqual(d, { q: "a", page: 1, pageSize: 25, skip: 0, take: 25 });
  assert.equal(pag.listParams({ q: "x".repeat(300) }).q.length, 100);
  assert.deepEqual(pag.pageMeta(60, 3, 25), { page: 3, totalPages: 3, from: 51, to: 60, total: 60, pageSize: 25 });
  assert.deepEqual(pag.pageMeta(60, 9, 25), { page: 3, totalPages: 3, from: 51, to: 60, total: 60, pageSize: 25 });
  assert.deepEqual(pag.pageMeta(0, 1, 25), { page: 1, totalPages: 1, from: 0, to: 0, total: 0, pageSize: 25 });
  assert.equal(pag.skipFor(3, 25), 50);
  assert.equal(pag.listHref("/admin/members", { q: "a b", page: 1, status: "", x: undefined }), "/admin/members?q=a+b");
  assert.equal(pag.listHref("/admin/members", { page: 2 }), "/admin/members?page=2");
  assert.equal(pag.listHref("/admin/members", {}), "/admin/members");
});

test("pagination: searchWhere zerlegt in Wörter (AND) über Felder (OR)", () => {
  const w = pag.searchWhere("Hans Muster", ["firstName", "lastName"]);
  assert.equal(w.AND.length, 2);
  assert.equal(w.AND[0]!.OR.length, 2);
  assert.deepEqual(w.AND[0]!.OR[0], { firstName: { contains: "Hans" } });
  assert.equal(pag.searchWhere("   ", ["a"]).AND.length, 0);
  assert.equal(pag.searchWhere("a b c d e f g", ["a"]).AND.length, 5);
});

// ---- links / validation ------------------------------------------------------------------------------------------
test("links: nur feste Basis-URL, keine Umleitung auf fremde Hosts", () => {
  assert.ok(links.publicUrl("/anlaesse/abc").endsWith("/anlaesse/abc"));
  assert.ok(links.publicUrl("/x", { a: "b c" }).endsWith("/x?a=b+c"));
  assert.throws(() => links.publicUrl("//evil.example/x"));
  assert.throws(() => links.publicUrl("https://evil.example"));
  assert.throws(() => links.publicUrl("/a\\b"));
  assert.ok(links.memberPortalUrl("beitraege").endsWith("/account/verein/beitraege"));
  assert.ok(links.eventCancelUrl("e1", "tok").endsWith("/anlaesse/e1/abmelden?token=tok"));
});

test("validation: Bausteine", () => {
  assert.equal(val.emailSchema.parse("  Max@Example.ORG "), "max@example.org");
  assert.throws(() => val.emailSchema.parse("a b@c.ch"));
  assert.equal(val.chfInputSchema.parse("1'234.50"), 123450);
  assert.equal(val.chfInputSchema.parse(500), 500);
  assert.throws(() => val.chfInputSchema.parse("abc"));
  assert.throws(() => val.chfInputSchema.parse(-5));
  assert.equal(val.dateOnlySchema.parse("5.11.2026").toISOString(), "2026-11-05T12:00:00.000Z");
  assert.throws(() => val.dateOnlySchema.parse("32.1.2026"));
  assert.equal(val.optionalDateOnlySchema.parse(""), null);
  assert.equal(val.optionalDateOnlySchema.parse(undefined), null);
  assert.equal(val.dateTimeSchema.parse("2026-11-05T19:30").toISOString(), "2026-11-05T18:30:00.000Z");
  assert.equal(val.boolSchema.parse("on"), true);
  assert.equal(val.boolSchema.parse("false"), false);
  assert.equal(val.countrySchema.parse("ch"), "CH");
  assert.throws(() => val.countrySchema.parse("Schweiz"));
  assert.throws(() => val.phoneSchema.parse("abc"));
  assert.equal(val.phoneSchema.parse("+41 78 322 21 39"), "+41 78 322 21 39");
  assert.throws(() => val.idSchema.parse("a b"));
  assert.throws(() => val.positiveRappenSchema.parse(0));
});
