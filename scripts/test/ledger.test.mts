// Tests für die Fachlogik der Kasse (src/lib/verein/ledger-*.ts): Salden, Jahresrechnung, Monatsbilanz, Budget, Abschluss, Rechte, CSV.
// Aufruf:  npx tsx scripts/test/ledger.test.mts
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

// "server-only" wirft ausserhalb von Next.js; für den Test durch ein leeres Modul ersetzen.
const require = createRequire(import.meta.url);
const serverOnlyPath = require.resolve("server-only");
require.cache[serverOnlyPath] = { id: serverOnlyPath, filename: serverOnlyPath, loaded: true, exports: {}, children: [], paths: [] } as unknown as NodeJS.Module;

const lib = await import("../../src/lib/verein/ledger-lib.ts");
const exp = await import("../../src/lib/verein/ledger-export.ts");
const schemas = await import("../../src/lib/verein/ledger-schemas.ts");
const csv = await import("../../src/lib/verein/csv.ts");
const dates = await import("../../src/lib/verein/dates.ts");

type Account = Parameters<typeof lib.buildAnnualStatement>[0][number];
const acc = (id: string, kind: string, number: string, name: string, opening = 0, extra: Partial<Account> = {}): Account => ({ id, kind, number, name, openingBalanceRappen: opening, active: true, sortOrder: 0, ...extra });

const accounts: Account[] = [
  acc("bank", "VERMOEGEN", "V01", "Bank", 100000),
  acc("kasse", "VERMOEGEN", "V02", "Kasse", 5000),
  acc("beitr", "EINNAHMEN", "E01", "Mitgliederbeiträge"),
  acc("spend", "EINNAHMEN", "E02", "Spenden"),
  acc("host", "AUSGABEN", "A01", "Hosting"),
  acc("verw", "AUSGABEN", "A02", "Verwaltung"),
];

type Entry = Parameters<typeof lib.entryDeltas>[0];
const e = (direction: string, amountRappen: number, categoryId: string, counterAccountId: string | null, fiscalYear = 2026, reversal = false): Entry => ({ direction, amountRappen, categoryId, counterAccountId, fiscalYear, reversal });

test("entryDeltas: Einnahme, Ausgabe, Umbuchung und Gegenbuchung", () => {
  assert.deepEqual(lib.entryDeltas(e("EINNAHME", 5000, "beitr", "bank")), [{ accountId: "beitr", delta: 5000 }, { accountId: "bank", delta: 5000 }]);
  assert.deepEqual(lib.entryDeltas(e("AUSGABE", 3000, "host", "bank")), [{ accountId: "host", delta: 3000 }, { accountId: "bank", delta: -3000 }]);
  assert.deepEqual(lib.entryDeltas(e("UMBUCHUNG", 1000, "bank", "kasse")), [{ accountId: "bank", delta: -1000 }, { accountId: "kasse", delta: 1000 }]);
  assert.deepEqual(lib.entryDeltas(e("AUSGABE", 3000, "host", "bank", 2026, true)), [{ accountId: "host", delta: -3000 }, { accountId: "bank", delta: 3000 }]);
  assert.deepEqual(lib.entryDeltas(e("EINNAHME", 100, "beitr", null)), [{ accountId: "beitr", delta: 100 }]);
  assert.deepEqual(lib.entryDeltas(e("UNBEKANNT", 100, "beitr", "bank")), []);
});

test("cashEffect: Einnahme plus, Ausgabe minus, Umbuchung null, Storno kehrt um", () => {
  assert.equal(lib.cashEffect({ direction: "EINNAHME", amountRappen: 700, reversal: false }), 700);
  assert.equal(lib.cashEffect({ direction: "AUSGABE", amountRappen: 700, reversal: false }), -700);
  assert.equal(lib.cashEffect({ direction: "AUSGABE", amountRappen: 700, reversal: true }), 700);
  assert.equal(lib.cashEffect({ direction: "UMBUCHUNG", amountRappen: 700, reversal: false }), 0);
});

const entries: Entry[] = [
  // 2025 (Vorjahr): Bank +20000 Einnahmen, -4000 Ausgabe
  e("EINNAHME", 20000, "beitr", "bank", 2025),
  e("AUSGABE", 4000, "host", "bank", 2025),
  // 2026
  e("EINNAHME", 15000, "beitr", "bank"),
  e("EINNAHME", 2500, "spend", "kasse"),
  e("AUSGABE", 6000, "host", "bank"),
  e("AUSGABE", 1200, "verw", "kasse"),
  e("UMBUCHUNG", 3000, "bank", "kasse"),
  // Fehlbuchung und Gegenbuchung
  e("AUSGABE", 999, "verw", "bank"),
  e("AUSGABE", 999, "verw", "bank", 2026, true),
  // 2027 (wird für 2026 ignoriert)
  e("EINNAHME", 777, "beitr", "bank", 2027),
];

test("buildAnnualStatement: Einnahmen, Ausgaben, Ergebnis und Vermögen", () => {
  const s = lib.buildAnnualStatement(accounts, entries, 2026);
  assert.equal(s.totalIncomeRappen, 17500);
  assert.equal(s.totalExpenseRappen, 7200);
  assert.equal(s.resultRappen, 10300);
  // Anfangsbestand 2026: Bank 100000 + 20000 - 4000 = 116000, Kasse 5000
  const bank = s.assets.find((r) => r.account.id === "bank")!;
  const kasse = s.assets.find((r) => r.account.id === "kasse")!;
  assert.equal(bank.startRappen, 116000);
  assert.equal(bank.changeRappen, 15000 - 6000 - 3000);
  assert.equal(bank.endRappen, 122000);
  assert.equal(kasse.startRappen, 5000);
  assert.equal(kasse.changeRappen, 2500 - 1200 + 3000);
  assert.equal(s.assetStartRappen, 121000);
  assert.equal(s.assetChangeRappen, s.resultRappen);
  assert.equal(s.assetEndRappen, 121000 + 10300);
  assert.equal(s.unallocatedRappen, 0);
  // Gegenbuchung hebt die Fehlbuchung auf
  assert.equal(s.expense.find((r) => r.account.id === "verw")!.amountRappen, 1200);
});

test("buildAnnualStatement: Anfangsbestand des Folgejahres = Endbestand des Vorjahres", () => {
  const y26 = lib.buildAnnualStatement(accounts, entries, 2026);
  const y27 = lib.buildAnnualStatement(accounts, entries, 2027);
  assert.equal(y27.assetStartRappen, y26.assetEndRappen);
  assert.equal(y27.resultRappen, 777);
});

test("buildAnnualStatement: Jahr ohne Buchungen, Einnahmen ohne Gegenkonto, inaktive Konten", () => {
  const empty = lib.buildAnnualStatement(accounts, [], 2026);
  assert.equal(empty.resultRappen, 0);
  assert.equal(empty.assetEndRappen, 105000);
  const loose = lib.buildAnnualStatement(accounts, [e("EINNAHME", 400, "beitr", null)], 2026);
  assert.equal(loose.resultRappen, 400);
  assert.equal(loose.assetChangeRappen, 0);
  assert.equal(loose.unallocatedRappen, 400);
  const inactive = [...accounts, acc("alt", "AUSGABEN", "A99", "Altes Konto", 0, { active: false })];
  assert.ok(!lib.buildAnnualStatement(inactive, [], 2026).expense.some((r) => r.account.id === "alt"));
  assert.ok(lib.buildAnnualStatement(inactive, [e("AUSGABE", 100, "alt", "bank")], 2026).expense.some((r) => r.account.id === "alt"));
});

test("fiscalMonths und monthIndexOf: Kalenderjahr und abweichendes Geschäftsjahr", () => {
  const cal = lib.fiscalMonths(2026, { month: 1, day: 1 });
  assert.equal(cal.length, 12);
  assert.equal(cal[0]!.key, "2026-01");
  assert.equal(cal[11]!.key, "2026-12");
  const odd = lib.fiscalMonths(2026, { month: 7, day: 1 });
  assert.equal(odd[0]!.key, "2026-07");
  assert.equal(odd[6]!.key, "2027-01");
  assert.equal(odd[11]!.key, "2027-06");
  assert.equal(lib.monthIndexOf(dates.dateOnly(2026, 7, 1), 2026, { month: 7, day: 1 }), 0);
  assert.equal(lib.monthIndexOf(dates.dateOnly(2027, 6, 30), 2026, { month: 7, day: 1 }), 11);
  assert.equal(lib.monthIndexOf(dates.dateOnly(2027, 7, 1), 2026, { month: 7, day: 1 }), null);
  assert.equal(lib.monthIndexOf(dates.dateOnly(2026, 6, 30), 2026, { month: 7, day: 1 }), null);
});

test("monthlySeries: Monatswerte und laufender Bestand", () => {
  const start = { month: 1, day: 1 };
  const dated = [
    { ...e("EINNAHME", 15000, "beitr", "bank"), bookingDate: dates.dateOnly(2026, 1, 15) },
    { ...e("AUSGABE", 6000, "host", "bank"), bookingDate: dates.dateOnly(2026, 1, 31) },
    { ...e("EINNAHME", 2500, "spend", "kasse"), bookingDate: dates.dateOnly(2026, 3, 1) },
    { ...e("AUSGABE", 999, "verw", "bank"), bookingDate: dates.dateOnly(2026, 3, 2) },
    { ...e("AUSGABE", 999, "verw", "bank", 2026, true), bookingDate: dates.dateOnly(2026, 3, 9) },
    { ...e("UMBUCHUNG", 3000, "bank", "kasse"), bookingDate: dates.dateOnly(2026, 4, 1) },
    { ...e("EINNAHME", 50, "beitr", "bank", 2025), bookingDate: dates.dateOnly(2025, 12, 31) },
  ];
  const rows = lib.monthlySeries(accounts, dated, 2026, start, 121000);
  assert.equal(rows.length, 12);
  assert.equal(rows[0]!.incomeRappen, 15000);
  assert.equal(rows[0]!.expenseRappen, 6000);
  assert.equal(rows[0]!.assetsEndRappen, 121000 + 9000);
  assert.equal(rows[1]!.assetsEndRappen, 130000);
  assert.equal(rows[2]!.incomeRappen, 2500);
  assert.equal(rows[2]!.expenseRappen, 0);
  assert.equal(rows[2]!.assetsEndRappen, 132500);
  // Umbuchung ändert das Gesamtvermögen nicht
  assert.equal(rows[3]!.assetsEndRappen, 132500);
  assert.equal(rows[11]!.assetsEndRappen, 132500);
  assert.equal(rows.reduce((a, r) => a + r.resultRappen, 0), 11500);
});

test("budgetComparison: Ausgaben (verfügbar), Einnahmen (Soll/Ist), Stufen", () => {
  const budgets = new Map<string, number>([
    ["host", 6000],
    ["verw", 10000],
    ["beitr", 20000],
  ]);
  const b = lib.budgetComparison(accounts, budgets, entries, 2026);
  const host = b.expense.find((r) => r.account.id === "host")!;
  assert.equal(host.actualRappen, 6000);
  assert.equal(host.diffRappen, 0);
  assert.equal(host.percent, 100);
  assert.equal(host.level, "warn");
  const verw = b.expense.find((r) => r.account.id === "verw")!;
  assert.equal(verw.actualRappen, 1200);
  assert.equal(verw.diffRappen, 8800);
  assert.equal(verw.level, "ok");
  const beitr = b.income.find((r) => r.account.id === "beitr")!;
  assert.equal(beitr.actualRappen, 15000);
  assert.equal(beitr.diffRappen, -5000);
  assert.equal(beitr.level, "warn");
  const spend = b.income.find((r) => r.account.id === "spend")!;
  assert.equal(spend.budgetRappen, null);
  assert.equal(spend.diffRappen, null);
  assert.equal(spend.level, "none");
  assert.equal(b.budgetIncomeRappen, 20000);
  assert.equal(b.budgetExpenseRappen, 16000);
  assert.equal(b.budgetResultRappen, 4000);
  assert.equal(b.actualResultRappen, 17500 - 7200);
});

test("budgetLevel: Überschreitung und Budget 0", () => {
  assert.equal(lib.budgetLevel("AUSGABEN", 1000, 1001), "over");
  assert.equal(lib.budgetLevel("AUSGABEN", 1000, 899), "ok");
  assert.equal(lib.budgetLevel("AUSGABEN", 1000, 900), "warn");
  assert.equal(lib.budgetLevel("AUSGABEN", 0, 0), "ok");
  assert.equal(lib.budgetLevel("AUSGABEN", 0, 1), "over");
  assert.equal(lib.budgetLevel("AUSGABEN", null, 500), "none");
  assert.equal(lib.budgetLevel("EINNAHMEN", 1000, 1000), "ok");
  assert.equal(lib.budgetLevel("EINNAHMEN", 1000, 999), "warn");
});

test("validateBookingAccounts: Kontenarten, Gegenkonto, aktive Konten", () => {
  const ref = (id: string, kind: string, active = true) => ({ id, kind, active, name: id });
  assert.equal(lib.validateBookingAccounts("EINNAHME", ref("beitr", "EINNAHMEN"), ref("bank", "VERMOEGEN")), null);
  assert.equal(lib.validateBookingAccounts("AUSGABE", ref("host", "AUSGABEN"), ref("bank", "VERMOEGEN")), null);
  assert.equal(lib.validateBookingAccounts("UMBUCHUNG", ref("bank", "VERMOEGEN"), ref("kasse", "VERMOEGEN")), null);
  assert.equal(lib.validateBookingAccounts("EINNAHME", ref("host", "AUSGABEN"), ref("bank", "VERMOEGEN"))?.field, "categoryId");
  assert.equal(lib.validateBookingAccounts("AUSGABE", ref("beitr", "EINNAHMEN"), ref("bank", "VERMOEGEN"))?.field, "categoryId");
  assert.equal(lib.validateBookingAccounts("EINNAHME", ref("beitr", "EINNAHMEN"), null)?.field, "counterAccountId");
  assert.equal(lib.validateBookingAccounts("EINNAHME", ref("beitr", "EINNAHMEN"), ref("spend", "EINNAHMEN"))?.field, "counterAccountId");
  assert.equal(lib.validateBookingAccounts("UMBUCHUNG", ref("bank", "VERMOEGEN"), ref("bank", "VERMOEGEN"))?.field, "counterAccountId");
  assert.equal(lib.validateBookingAccounts("UMBUCHUNG", ref("host", "AUSGABEN"), ref("bank", "VERMOEGEN"))?.field, "categoryId");
  assert.equal(lib.validateBookingAccounts("EINNAHME", ref("beitr", "EINNAHMEN", false), ref("bank", "VERMOEGEN"))?.field, "categoryId");
  assert.equal(lib.validateBookingAccounts("EINNAHME", ref("beitr", "EINNAHMEN", false), ref("bank", "VERMOEGEN"), { checkActive: { category: false, counter: true } }), null);
  assert.equal(lib.validateBookingAccounts("EINNAHME", null, ref("bank", "VERMOEGEN"))?.field, "categoryId");
  assert.equal(lib.validateBookingAccounts("QUATSCH", ref("beitr", "EINNAHMEN"), ref("bank", "VERMOEGEN"))?.field, "categoryId");
});

test("Bearbeiten und Stornieren: Sperrgründe", () => {
  const base = { source: "MANUELL", reversed: false, isReversal: false, locked: false };
  assert.equal(lib.editBlockReason(base), null);
  assert.ok(lib.editBlockReason({ ...base, locked: true }));
  assert.ok(lib.editBlockReason({ ...base, reversed: true }));
  assert.ok(lib.editBlockReason({ ...base, isReversal: true }));
  assert.ok(lib.editBlockReason({ ...base, source: "ZAHLUNG" }));
  assert.equal(lib.reverseBlockReason(base), null);
  assert.equal(lib.reverseBlockReason({ ...base, locked: true }), null);
  assert.ok(lib.reverseBlockReason({ ...base, reversed: true }));
  assert.ok(lib.reverseBlockReason({ ...base, isReversal: true }));
  assert.equal(lib.transactionState(base), "AKTIV");
  assert.equal(lib.transactionState({ reversed: true, isReversal: false }), "STORNIERT");
  assert.equal(lib.transactionState({ reversed: false, isReversal: true }), "STORNO");
  assert.ok(lib.receiptRemoveBlockReason(true));
  assert.equal(lib.receiptRemoveBlockReason(false), null);
});

test("reversalText: Beleg, Original und Grund, gekürzt auf 200 Zeichen", () => {
  assert.equal(lib.reversalText({ voucherNo: "B-2026-0007", text: "Hosting" }, "Doppelt gebucht"), "Storno B-2026-0007: Hosting (Doppelt gebucht)");
  assert.ok(lib.reversalText({ voucherNo: "B-2026-0007", text: "x".repeat(300) }, "Grund").length <= 200);
});

test("Rechte: Schreiben Kassier, Präsident (Voreinstellung) und Inhaber/Administration, Abschluss über das Einzelrecht", () => {
  assert.equal(lib.canWriteLedger(["KASSIER"]), true);
  assert.equal(lib.canWriteLedger(["ADMIN"]), true);
  assert.equal(lib.canWriteLedger(["PRAESIDENT"]), true);
  assert.equal(lib.canWriteLedger(["REVISOR"]), false);
  assert.equal(lib.canWriteLedger(["VIZEPRAESIDENT"]), false);
  assert.equal(lib.canCloseFiscalYear(["KASSIER"]), true);
  assert.equal(lib.canCloseFiscalYear(["PRAESIDENT"]), true);
  assert.equal(lib.canCloseFiscalYear(["VIZEPRAESIDENT", "KASSIER"]), true);
  assert.equal(lib.canCloseFiscalYear(["REVISOR"]), false);
  assert.equal(lib.canCloseFiscalYear(["VIZEPRAESIDENT"]), false);
  assert.equal(lib.canCloseFiscalYear(["AKTUAR"]), false);
  assert.equal(lib.canCloseFiscalYear(["EDITOR"]), false);
  assert.equal(lib.canCloseFiscalYear([]), false);
});

test("lockBlockReason: Jahr muss zu Ende sein, frühere Jahre zuerst", () => {
  const fiscal = { month: 1, day: 1 };
  const base = { year: 2026, fiscal, today: dates.dateOnly(2027, 1, 10), alreadyLocked: false, earlierOpenYears: [] as number[] };
  assert.equal(lib.lockBlockReason(base), null);
  assert.ok(lib.lockBlockReason({ ...base, today: dates.dateOnly(2026, 12, 31) })?.includes("läuft noch bis 31.12.2026"));
  assert.ok(lib.lockBlockReason({ ...base, alreadyLocked: true })?.includes("bereits abgeschlossen"));
  assert.ok(lib.lockBlockReason({ ...base, earlierOpenYears: [2025, 2024] })?.includes("2024, 2025"));
  // abweichendes Geschäftsjahr: 1.7.2026 bis 30.6.2027
  const odd = { month: 7, day: 1 };
  assert.ok(lib.lockBlockReason({ ...base, fiscal: odd, today: dates.dateOnly(2027, 1, 10) }));
  assert.equal(lib.lockBlockReason({ ...base, fiscal: odd, today: dates.dateOnly(2027, 7, 1) }), null);
});

test("unlockBlockReason: nur abgeschlossene Jahre, spätere zuerst öffnen", () => {
  assert.equal(lib.unlockBlockReason({ year: 2026, locked: true, laterLockedYears: [] }), null);
  assert.ok(lib.unlockBlockReason({ year: 2026, locked: false, laterLockedYears: [] }));
  assert.ok(lib.unlockBlockReason({ year: 2026, locked: true, laterLockedYears: [2027] })?.includes("2027"));
});

test("planStandardAccounts: Vorlage, Idempotenz, freie Nummern", () => {
  const first = lib.planStandardAccounts([]);
  assert.equal(first.length, lib.STANDARD_ACCOUNT_TEMPLATE.length);
  assert.equal(new Set(first.map((p) => p.number.toLowerCase())).size, first.length);
  assert.ok(first.some((p) => p.name === "Mitgliederbeiträge" && p.kind === "EINNAHMEN"));
  assert.ok(first.some((p) => p.name === "Bankspesen" && p.kind === "AUSGABEN"));
  assert.ok(first.some((p) => p.name === "Bankkonto" && p.kind === "VERMOEGEN"));
  // zweiter Lauf legt nichts mehr an
  assert.equal(lib.planStandardAccounts(first.map((p) => ({ ...p }))).length, 0);
  // belegte Nummer wird übersprungen, vorhandener Name (gross/klein) wird nicht doppelt angelegt
  const some = lib.planStandardAccounts([
    { kind: "EINNAHMEN", number: "E01", name: "spenden", sortOrder: 5 },
    { kind: "AUSGABEN", number: "A01", name: "Eigenes Konto", sortOrder: 0 },
  ]);
  assert.ok(!some.some((p) => p.kind === "EINNAHMEN" && p.name === "Spenden"));
  assert.ok(!some.some((p) => p.number.toLowerCase() === "e01" || p.number.toLowerCase() === "a01"));
  assert.ok(some.find((p) => p.name === "Mitgliederbeiträge")!.sortOrder > 5);
});

test("niceCeiling: runde Obergrenzen für Diagramme", () => {
  assert.equal(lib.niceCeiling(0), 10000);
  assert.equal(lib.niceCeiling(9999), 10000);
  assert.equal(lib.niceCeiling(10001), 20000);
  assert.equal(lib.niceCeiling(134000), 200000);
  assert.equal(lib.niceCeiling(210000), 250000);
  assert.equal(lib.niceCeiling(260000), 500000);
  assert.equal(lib.niceCeiling(520000), 1000000);
  assert.equal(lib.niceCeiling(-5), 10000);
});

test("yearChoices und fiscalYearLabel", () => {
  assert.deepEqual(lib.yearChoices([2024, 2026, 2026, 1], 2026), [2026, 2024]);
  assert.deepEqual(lib.yearChoices([], 2026), [2026]);
  assert.equal(lib.fiscalYearLabel(2026, { month: 1, day: 1 }), "2026");
  assert.equal(lib.fiscalYearLabel(2026, { month: 7, day: 1 }), "2026/27");
});

test("Schemas: Buchung, Konto, Budget, Abschluss", () => {
  const ok = schemas.transactionCreateSchema.parse({ bookingDate: "2026-11-05", direction: "AUSGABE", amount: "1'234.50", categoryId: "abc", counterAccountId: "def", text: "Server" });
  assert.equal(ok.amount, 123450);
  assert.equal(ok.voucherRef, "");
  assert.equal(ok.bookingDate.toISOString(), "2026-11-05T12:00:00.000Z");
  assert.throws(() => schemas.transactionCreateSchema.parse({ bookingDate: "2026-11-05", direction: "AUSGABE", amount: "0", categoryId: "a", counterAccountId: "b", text: "x" }));
  assert.throws(() => schemas.transactionCreateSchema.parse({ bookingDate: "2026-11-05", direction: "AUSGABE", amount: "-5", categoryId: "a", counterAccountId: "b", text: "x" }));
  assert.throws(() => schemas.transactionCreateSchema.parse({ bookingDate: "kein Datum", direction: "AUSGABE", amount: "5", categoryId: "a", counterAccountId: "b", text: "x" }));
  assert.throws(() => schemas.transactionCreateSchema.parse({ bookingDate: "2026-11-05", direction: "ANDERS", amount: "5", categoryId: "a", counterAccountId: "b", text: "x" }));
  assert.throws(() => schemas.transactionCreateSchema.parse({ bookingDate: "2026-11-05", direction: "AUSGABE", amount: "5", categoryId: "../x", counterAccountId: "b", text: "x" }));
  const acct = schemas.accountSchema.parse({ kind: "VERMOEGEN", number: "V01", name: "Bank", openingBalance: "-250.00" });
  assert.equal(acct.openingBalance, -25000);
  assert.throws(() => schemas.accountSchema.parse({ kind: "VERMOEGEN", number: "=cmd", name: "Bank" }));
  assert.throws(() => schemas.accountSchema.parse({ kind: "SONSTIGES", number: "V01", name: "Bank" }));
  const budget = schemas.budgetSchema.parse({ year: "2026", items: [{ categoryId: "a", amount: "1'000.00" }, { categoryId: "b", amount: "" }, { categoryId: "c", amount: null }] });
  assert.deepEqual(budget.items.map((i) => i.amount), [100000, null, null]);
  assert.throws(() => schemas.budgetSchema.parse({ year: 2026, items: [{ categoryId: "a", amount: "-1" }] }));
  assert.throws(() => schemas.budgetSchema.parse({ year: 1800, items: [] }));
  assert.equal(schemas.fiscalActionSchema.parse({ action: "lock" }).confirmUnbooked, false);
  assert.throws(() => schemas.fiscalActionSchema.parse({ action: "loeschen" }));
  assert.throws(() => schemas.reverseSchema.parse({ reason: "" }));
});

test("parseLedgerFilters: Jahr, Richtung, Quelle, Konto", () => {
  const f = schemas.parseLedgerFilters(new URLSearchParams("year=2025&direction=AUSGABE&source=ZAHLUNG&q=%20Server%20&account=ab-12&noReceipt=1"), 2026);
  assert.equal(f.year, 2025);
  assert.equal(f.direction, "AUSGABE");
  assert.equal(f.source, "ZAHLUNG");
  assert.equal(f.q, "Server");
  assert.equal(f.accountId, "ab-12");
  assert.equal(f.noReceipt, true);
  assert.equal(schemas.parseLedgerFilters(new URLSearchParams(""), 2026).year, 2026);
  assert.equal(schemas.parseLedgerFilters(new URLSearchParams("year=alle"), 2026).year, null);
  const bad = schemas.parseLedgerFilters(new URLSearchParams("direction=X&source=Y&account=a%27b"), null);
  assert.equal(bad.direction, "");
  assert.equal(bad.source, "");
  assert.equal(bad.accountId, "ab");
  assert.equal(schemas.parseYearParam(new URLSearchParams("year=abc"), 2026), 2026);
  assert.equal(schemas.parseYearParam(new URLSearchParams("year=9999"), 2026), 2100);
});

test("CSV: Buchungen mit negativer Gegenbuchung und Formel-Schutz", () => {
  const rows = exp.transactionCsvRows([
    {
      bookingDate: dates.dateOnly(2026, 11, 5),
      fiscalYear: 2026,
      voucherNo: "B-2026-0001",
      direction: "AUSGABE",
      amountRappen: 123450,
      text: "=HYPERLINK(\"http://x\")",
      voucherRef: "+41",
      source: "MANUELL",
      reversalOfVoucherNo: "",
      category: { number: "A01", name: "Hosting" },
      counterAccount: { number: "V01", name: "Bank" },
      receiptCount: 1,
      createdByName: "@Kassier",
    },
    {
      bookingDate: dates.dateOnly(2026, 11, 6),
      fiscalYear: 2026,
      voucherNo: "B-2026-0002",
      direction: "AUSGABE",
      amountRappen: 500,
      text: "Storno",
      voucherRef: "",
      source: "STORNO",
      reversalOfVoucherNo: "B-2026-0001",
      category: { number: "A01", name: "Hosting" },
      counterAccount: null,
      receiptCount: 0,
      createdByName: "Kassier",
    },
  ]);
  const text = csv.toCsv(exp.TRANSACTION_CSV_HEADERS, rows);
  const lines = text.split("\r\n");
  assert.equal(lines.length, 4);
  assert.ok(lines[1]!.startsWith(`5.11.2026;2026;B-2026-0001;Ausgabe;A01;Hosting;V01;Bank;"'=HYPERLINK`));
  assert.ok(lines[1]!.includes(";1234.50;"));
  assert.ok(lines[1]!.includes(";'+41;"));
  assert.ok(lines[1]!.endsWith(";'@Kassier"));
  assert.ok(lines[2]!.includes(";-5.00;Gegenbuchung;B-2026-0001;"));
  assert.equal(exp.ledgerExportName("Buchungen", 2026), "Kassen-Buchungen-2026");
  assert.equal(exp.ledgerExportName("Buchungen", null), "Kassen-Buchungen");
});

test("CSV: Jahresrechnung enthält Summen und Vermögen", () => {
  const s = lib.buildAnnualStatement(accounts, entries, 2026);
  const rows = exp.annualCsvRows(s);
  const text = csv.toCsv(exp.ANNUAL_CSV_HEADERS, rows);
  assert.ok(text.includes("Einnahmen total;;;;;175.00"));
  assert.ok(text.includes("Ausgaben total;;;;;72.00"));
  assert.ok(text.includes("Ertragsüberschuss;;;;;103.00"));
  assert.ok(text.includes("Vermögen total;;;1210.00;103.00;1313.00"));
  const negative = lib.buildAnnualStatement(accounts, [e("AUSGABE", 100, "host", "bank")], 2026);
  assert.ok(csv.toCsv(exp.ANNUAL_CSV_HEADERS, exp.annualCsvRows(negative)).includes("Aufwandüberschuss;;;;;-1.00"));
});

test("CSV: Budget", () => {
  const b = lib.budgetComparison(accounts, new Map([["host", 6000]]), entries, 2026);
  const text = csv.toCsv(exp.BUDGET_CSV_HEADERS, exp.budgetCsvRows(b));
  assert.ok(text.includes("Ausgaben;A01;Hosting;60.00;60.00;0.00"));
  assert.ok(text.includes("Einnahmen;E01;Mitgliederbeiträge;;150.00;"));
});
