// Tests der Beitrags- und Rechnungslogik sowie der Schweizer QR-Rechnung (rein, ohne Datenbank).
// Aufruf:  npx tsx scripts/test/fees.test.mts
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

// "server-only" wirft ausserhalb von Next.js; für den Test durch ein leeres Modul ersetzen.
const require = createRequire(import.meta.url);
const serverOnlyPath = require.resolve("server-only");
require.cache[serverOnlyPath] = { id: serverOnlyPath, filename: serverOnlyPath, loaded: true, exports: {}, children: [], paths: [] } as unknown as NodeJS.Module;

const qr = await import("../../src/lib/verein/qr-bill.ts");
const svg = await import("../../src/lib/verein/qr-bill-svg.ts");
const calc = await import("../../src/lib/verein/fees-calc.ts");
const bill = await import("../../src/lib/verein/fees-bill.ts");
const rem = await import("../../src/lib/verein/fees-reminders.ts");
const imp = await import("../../src/lib/verein/fees-import.ts");
const dates = await import("../../src/lib/verein/dates.ts");
const sch = await import("../../src/lib/verein/fees-schemas.ts");
const sett = await import("../../src/lib/verein/settings-schema.ts");
const csv = await import("../../src/lib/verein/csv.ts");

// Bekannte Prüfsummenbeispiele (öffentliche Beispiele der Standards)
const IBAN = "CH9300762011623852957"; // Beispiel-IBAN, normale IBAN (Institut 00762)
const QR_IBAN = "CH4431999123000889012"; // Beispiel der Swiss Payment Standards, Institutskennung 31999
const QR_REF = "210000000003139471430009017"; // Beispiel der Implementation Guidelines
const SCOR = "RF18539007547034"; // Beispiel aus ISO 11649

const creditor = { name: "Muster Verein", street: "Musterstrasse", houseNo: "1", zip: "9000", town: "Musterort", country: "CH" };
const debtor = { name: "Anna Beispiel", street: "Beispielweg", houseNo: "7", zip: "8000", town: "Zürich", country: "CH" };

const dateOnly = dates.dateOnly;

// ---- IBAN und Referenzen -------------------------------------------------------------------------------------------
test("qr-bill: IBAN-Prüfung (Modulo 97) mit bekannten Beispielen", () => {
  assert.equal(qr.isValidIban(IBAN), true);
  assert.equal(qr.isValidSwissIban(IBAN), true);
  assert.equal(qr.isValidSwissIban("CH93 0076 2011 6238 5295 7"), true); // mit Leerzeichen
  assert.equal(qr.isValidSwissIban("CH9300762011623852958"), false); // falsche Prüfziffer
  assert.equal(qr.isValidSwissIban("DE89370400440532013000"), false); // gültig, aber nicht CH/LI
  assert.equal(qr.isValidIban("DE89370400440532013000"), true);
  assert.equal(qr.isValidSwissIban("CH93007620116238529"), false); // zu kurz
  assert.equal(qr.isQrIban(QR_IBAN), true);
  assert.equal(qr.isQrIban(IBAN), false);
  assert.equal(qr.isValidSwissIban(QR_IBAN), true);
});

test("qr-bill: QR-Referenz (Modulo 10 rekursiv) und Creditor Reference (Modulo 97)", () => {
  assert.equal(qr.isValidQrReference(QR_REF), true);
  assert.equal(qr.isValidQrReference("21 00000 00003 13947 14300 09017"), true);
  assert.equal(qr.isValidQrReference("210000000003139471430009018"), false);
  assert.equal(qr.isValidQrReference("21000000000313947143000901"), false);
  assert.equal(qr.buildQrReference("21000000000313947143000901"), QR_REF);
  assert.equal(qr.buildQrReference("1").length, 27);
  assert.equal(qr.formatQrReference(QR_REF), "21 00000 00003 13947 14300 09017");
  assert.equal(qr.isValidCreditorReference(SCOR), true);
  assert.equal(qr.isValidCreditorReference("RF19539007547034"), false);
  assert.equal(qr.buildCreditorReference("539007547034"), SCOR);
});

test("qr-bill: Referenz einer Rechnung (erzeugen und zurücklesen)", () => {
  const q = qr.buildInvoiceQrReference(2026, 1);
  assert.equal(q.length, 27);
  assert.equal(qr.isValidQrReference(q), true);
  assert.equal(qr.referenceTypeOf(q), "QRR");
  assert.deepEqual(qr.parseInvoiceReference(q), { year: 2026, seq: 1 });
  assert.deepEqual(qr.parseInvoiceReference(qr.buildInvoiceQrReference(2027, 12345)), { year: 2027, seq: 12345 });
  const s = qr.buildInvoiceScorReference(2026, 1);
  assert.match(s, /^RF\d{2}20260001$/);
  assert.equal(qr.isValidCreditorReference(s), true);
  assert.deepEqual(qr.parseInvoiceReference(s), { year: 2026, seq: 1 });
  assert.deepEqual(qr.parseInvoiceReference(qr.buildInvoiceScorReference(2026, 123456)), { year: 2026, seq: 123456 });
  assert.equal(qr.parseInvoiceReference(QR_REF), null); // fremde Referenz
  assert.equal(qr.parseInvoiceReference("hallo"), null);
  assert.throws(() => qr.buildInvoiceQrReference(2026, 0));
  // verschiedene Rechnungen → verschiedene Referenzen
  assert.notEqual(qr.buildInvoiceQrReference(2026, 1), qr.buildInvoiceQrReference(2026, 2));
});

// ---- Zeichensatz ----------------------------------------------------------------------------------------------------
test("qr-bill: Zeichensatz und Bereinigung", () => {
  assert.equal(qr.isQrBillText("Müller & Söhne AG, Zürich 1/2"), true);
  assert.equal(qr.isQrBillText("Café Crème"), true);
  assert.equal(qr.isQrBillText("Preis in €"), false);
  assert.equal(qr.isQrBillText("Zeile\nzwei"), false);
  assert.equal(qr.isQrBillText("日本"), false);
  assert.equal(qr.toQrBillText("Preis in € – «günstig»"), 'Preis in EUR - "günstig"');
  assert.equal(qr.toQrBillText("Łukasz Čech"), "Lukasz Cech");
  assert.equal(qr.toQrBillText("  a\n\tb  "), "a b");
  assert.equal(qr.toQrBillText("abcdef", 3), "abc");
  assert.equal(qr.toQrBillText("日本"), "");
});

// ---- Payload --------------------------------------------------------------------------------------------------------
test("qr-bill: Payload mit QR-IBAN und QR-Referenz hat den vorgeschriebenen Aufbau", () => {
  const payload = qr.buildQrBillPayload({
    account: QR_IBAN,
    creditor,
    amountRappen: 123450,
    currency: "CHF",
    debtor,
    referenceType: "QRR",
    reference: QR_REF,
    message: "Rechnung 2026-0001",
  });
  const lines = qr.splitQrBillPayload(payload);
  assert.equal(lines.length, 31);
  assert.deepEqual(lines.slice(0, 4), ["SPC", "0200", "1", QR_IBAN]);
  assert.deepEqual(lines.slice(4, 11), ["S", "Muster Verein", "Musterstrasse", "1", "9000", "Musterort", "CH"]);
  assert.deepEqual(lines.slice(11, 18), ["", "", "", "", "", "", ""]); // endgültiger Zahlungsempfänger leer
  assert.equal(lines[18], "1234.50");
  assert.equal(lines[19], "CHF");
  assert.deepEqual(lines.slice(20, 27), ["S", "Anna Beispiel", "Beispielweg", "7", "8000", "Zürich", "CH"]);
  assert.deepEqual(lines.slice(27), ["QRR", QR_REF, "Rechnung 2026-0001", "EPD"]);
  assert.ok(!payload.includes("\r"));
});

test("qr-bill: Payload mit IBAN und SCOR, ohne Betrag und ohne Zahlungspflichtigen", () => {
  const payload = qr.buildQrBillPayload({ account: IBAN, creditor, referenceType: "SCOR", reference: "RF18 5390 0754 7034" });
  const lines = qr.splitQrBillPayload(payload);
  assert.equal(lines[18], ""); // Betrag offen
  assert.equal(lines[19], "CHF");
  assert.deepEqual(lines.slice(20, 27), ["", "", "", "", "", "", ""]);
  assert.deepEqual(lines.slice(27), ["SCOR", SCOR, "", "EPD"]);
  const non = qr.splitQrBillPayload(qr.buildQrBillPayload({ account: IBAN, creditor, referenceType: "NON", amountRappen: 5 }));
  assert.equal(non[18], "0.05");
  assert.deepEqual(non.slice(27, 29), ["NON", ""]);
});

test("qr-bill: Rechnungsinformation folgt nach dem Trailer", () => {
  const lines = qr.splitQrBillPayload(qr.buildQrBillPayload({ account: IBAN, creditor, referenceType: "NON", message: "Zweck", billInformation: "//S1/10/10201409" }));
  assert.deepEqual(lines.slice(-3), ["Zweck", "EPD", "//S1/10/10201409"]);
});

test("qr-bill: Regeln zu Konto und Referenztyp", () => {
  const base = { creditor, amountRappen: 100 };
  assert.throws(() => qr.buildQrBillPayload({ ...base, account: IBAN, referenceType: "QRR", reference: QR_REF }), qr.QrBillError);
  assert.throws(() => qr.buildQrBillPayload({ ...base, account: QR_IBAN, referenceType: "SCOR", reference: SCOR }), qr.QrBillError);
  assert.throws(() => qr.buildQrBillPayload({ ...base, account: QR_IBAN, referenceType: "NON" }), qr.QrBillError);
  assert.throws(() => qr.buildQrBillPayload({ ...base, account: IBAN, referenceType: "NON", reference: SCOR }), qr.QrBillError);
  assert.throws(() => qr.buildQrBillPayload({ ...base, account: QR_IBAN, referenceType: "QRR", reference: "210000000003139471430009018" }), qr.QrBillError);
  assert.throws(() => qr.buildQrBillPayload({ ...base, account: "DE89370400440532013000", referenceType: "NON" }), qr.QrBillError);
  assert.equal(qr.validateQrBill({ ...base, account: QR_IBAN, referenceType: "QRR", reference: QR_REF }).length, 0);
});

test("qr-bill: Längenlimits, Betrag, Währung und Adressen", () => {
  const ok = { account: IBAN, creditor, referenceType: "NON" as const };
  const fields = (input: Parameters<typeof qr.validateQrBill>[0]) => qr.validateQrBill(input).map((i) => i.field);
  assert.ok(fields({ ...ok, creditor: { ...creditor, name: "x".repeat(71) } }).includes("creditor.name"));
  assert.equal(fields({ ...ok, creditor: { ...creditor, name: "x".repeat(70) } }).length, 0);
  assert.ok(fields({ ...ok, creditor: { ...creditor, town: "x".repeat(36) } }).includes("creditor.town"));
  assert.ok(fields({ ...ok, creditor: { ...creditor, houseNo: "1".repeat(17) } }).includes("creditor.houseNo"));
  assert.ok(fields({ ...ok, creditor: { ...creditor, zip: "" } }).includes("creditor.zip"));
  assert.ok(fields({ ...ok, creditor: { ...creditor, country: "Schweiz" } }).includes("creditor.country"));
  assert.ok(fields({ ...ok, creditor: { ...creditor, country: "ch" } }).includes("creditor.country"));
  assert.ok(fields({ ...ok, debtor: { ...debtor, name: "" } }).includes("debtor.name"));
  assert.ok(fields({ ...ok, message: "x".repeat(141) }).includes("message"));
  assert.ok(fields({ ...ok, message: "x".repeat(100), billInformation: "y".repeat(41) }).includes("message"));
  assert.equal(fields({ ...ok, message: "x".repeat(100), billInformation: "y".repeat(40) }).length, 0);
  assert.ok(fields({ ...ok, amountRappen: 0 }).includes("amount"));
  assert.ok(fields({ ...ok, amountRappen: 100_000_000_000 }).includes("amount"));
  assert.ok(fields({ ...ok, amountRappen: 1.5 }).includes("amount"));
  assert.equal(fields({ ...ok, amountRappen: 99_999_999_999 }).length, 0);
  assert.ok(fields({ ...ok, currency: "USD" as unknown as "CHF" }).includes("currency"));
  assert.equal(fields({ ...ok, currency: "EUR" }).length, 0);
  assert.ok(fields({ ...ok, message: "Preis €" }).includes("message"));
  assert.ok(fields({ ...ok, creditor: { ...creditor, name: " Muster" } }).includes("creditor.name"));
});

test("qr-bill: Darstellungstexte", () => {
  const d = qr.describeQrBill({ account: QR_IBAN, creditor, amountRappen: 123450, debtor, referenceType: "QRR", reference: QR_REF, message: "Rechnung 2026-0001" });
  assert.equal(d.account, "CH44 3199 9123 0008 8901 2");
  assert.deepEqual(d.creditorLines, ["Muster Verein", "Musterstrasse 1", "9000 Musterort"]);
  assert.equal(d.reference, "21 00000 00003 13947 14300 09017");
  assert.equal(d.amount, "1 234.50");
  assert.equal(d.currency, "CHF");
  assert.deepEqual(d.debtorLines, ["Anna Beispiel", "Beispielweg 7", "8000 Zürich"]);
  const open = qr.describeQrBill({ account: IBAN, creditor: { ...creditor, country: "LI" }, referenceType: "SCOR", reference: SCOR });
  assert.equal(open.amount, null);
  assert.equal(open.debtorLines, null);
  assert.equal(open.reference, "RF18 5390 0754 7034");
  assert.deepEqual(qr.addressDisplayLines({ ...debtor, country: "DE", zip: "10115", town: "Berlin" }).at(-1), "DE-10115 Berlin");
});

test("qr-bill: Adressen aus Freitext lesen", () => {
  assert.deepEqual(qr.splitStreet("Schützengasse 13"), { street: "Schützengasse", houseNo: "13" });
  assert.deepEqual(qr.splitStreet("Rue du Lac 12a"), { street: "Rue du Lac", houseNo: "12a" });
  assert.deepEqual(qr.splitStreet("Hauptstrasse"), { street: "Hauptstrasse", houseNo: "" });
  assert.deepEqual(qr.splitStreet("Bahnhofstrasse 5-7"), { street: "Bahnhofstrasse", houseNo: "5-7" });
  assert.deepEqual(qr.splitZipTown("9410 Heiden"), { zip: "9410", town: "Heiden" });
  assert.deepEqual(qr.splitZipTown("1202 Genève"), { zip: "1202", town: "Genève" });
  assert.equal(qr.splitZipTown("Heiden"), null);
  const a = qr.parseAddressBlock("Anna Beispiel", "Beispielweg 7\n8000 Zürich");
  assert.deepEqual(a, { name: "Anna Beispiel", street: "Beispielweg", houseNo: "7", zip: "8000", town: "Zürich", country: "CH" });
  assert.equal(qr.parseAddressBlock("X", "nur eine Zeile"), null);
  assert.equal(qr.parseAddressBlock("X", "Weg 1\nohne PLZ"), null);
  assert.equal(qr.parseAddressBlock("X", "Weg 1\n10115 Berlin\nDE")?.country, "DE");
});

// ---- QR-Grafik --------------------------------------------------------------------------------------------------------
test("qr-bill-svg: Geometrie, Schweizer Kreuz, Grenzen", () => {
  const payload = qr.buildQrBillPayload({ account: QR_IBAN, creditor, amountRappen: 123450, debtor, referenceType: "QRR", reference: QR_REF, message: "Rechnung 2026-0001" });
  const g = svg.qrBillQrGeometry(payload);
  assert.ok(g.version <= 25 && g.version >= 1);
  assert.equal(g.modules, 17 + 4 * g.version);
  assert.ok(g.pathD.startsWith("M"));
  // Kreuz: 7 mm von 46 mm, mittig
  assert.ok(Math.abs(g.cross.size - (7 * g.modules) / 46) < 1e-9);
  assert.ok(Math.abs(g.cross.x * 2 + g.cross.size - g.modules) < 1e-9);
  const out = svg.qrBillQrSvg(payload);
  assert.match(out, /^<svg [^>]*width="46mm" height="46mm"/);
  assert.ok(out.includes('fill="#000"') && out.includes('fill="#fff"'));
  assert.ok(!/<script|javascript:/i.test(out));
  // zu langer Inhalt passt nicht in Version 25
  assert.throws(() => svg.qrBillQrGeometry("x".repeat(1400)), qr.QrBillError);
  // Layoutwerte der Spezifikation
  assert.equal(qr.QR_BILL_LAYOUT.receiptWidthMm + qr.QR_BILL_LAYOUT.paymentPartWidthMm, qr.QR_BILL_LAYOUT.widthMm);
  assert.equal(qr.QR_BILL_LAYOUT.heightMm, 105);
});

// ---- Rechnung → QR-Rechnung ---------------------------------------------------------------------------------------------
const ctxQr = { accountHolder: "Muster Verein", iban: IBAN, qrIban: QR_IBAN, legal: { street: "Musterstrasse 1", zipCity: "9000 Musterort", country: "Schweiz" } };
const invBase = { number: "2026-0001", year: 2026, seq: 1, totalRappen: 5000, paidRappen: 0, paymentReference: "", recipientName: "Anna Beispiel", recipientAddress: "Beispielweg 7\n8000 Zürich" };

test("fees-bill: QR-IBAN wird bevorzugt, Betrag ist der offene Betrag", () => {
  const b = bill.composeInvoiceBill(ctxQr, { ...invBase, paidRappen: 1000 });
  assert.ok(b.ok);
  if (!b.ok) return;
  assert.equal(b.input.referenceType, "QRR");
  assert.equal(b.input.account, QR_IBAN);
  assert.equal(b.input.amountRappen, 4000);
  assert.equal(b.input.reference, qr.buildInvoiceQrReference(2026, 1));
  assert.equal(b.display.amount, "40.00");
  assert.ok(b.payload.startsWith("SPC\n0200\n1\n"));
  assert.equal(b.input.debtor?.town, "Zürich");
});

test("fees-bill: ohne QR-IBAN gilt die IBAN mit Creditor Reference", () => {
  const b = bill.composeInvoiceBill({ ...ctxQr, qrIban: "" }, invBase);
  assert.ok(b.ok);
  if (!b.ok) return;
  assert.equal(b.input.referenceType, "SCOR");
  assert.equal(b.input.account, IBAN);
  assert.match(b.input.reference ?? "", /^RF\d{2}20260001$/);
});

test("fees-bill: gespeicherte Referenz bleibt, solange sie zum Konto passt", () => {
  const stored = qr.buildInvoiceQrReference(2026, 1);
  const b = bill.composeInvoiceBill(ctxQr, { ...invBase, paymentReference: stored });
  assert.ok(b.ok && b.input.reference === stored);
  // gespeicherte QR-Referenz, aber nur noch normale IBAN → neue SCOR-Referenz statt ungültiger Kombination
  const c = bill.composeInvoiceBill({ ...ctxQr, qrIban: "" }, { ...invBase, paymentReference: stored });
  assert.ok(c.ok && c.input.referenceType === "SCOR");
});

test("fees-bill: fehlende Angaben ergeben klare Meldungen statt einer ungültigen QR-Rechnung", () => {
  const none = bill.composeInvoiceBill({ ...ctxQr, iban: "", qrIban: "" }, invBase);
  assert.ok(!none.ok && none.problems.some((p) => p.includes("IBAN")));
  const noAddr = bill.composeInvoiceBill({ ...ctxQr, legal: { street: "", zipCity: "", country: "" } }, invBase);
  assert.ok(!noAddr.ok && noAddr.problems.some((p) => p.includes("Anschrift")));
  const noName = bill.composeInvoiceBill({ ...ctxQr, accountHolder: "" }, invBase);
  assert.ok(!noName.ok && noName.problems.some((p) => p.includes("Kontoinhaber")));
  const paid = bill.composeInvoiceBill(ctxQr, { ...invBase, paidRappen: 5000 });
  assert.ok(!paid.ok && paid.problems.some((p) => p.includes("kein Betrag")));
  // unvollständige Anschrift des Empfängers: Rechnung bleibt gültig, nur ohne Zahlungspflichtigen
  const nodebtor = bill.composeInvoiceBill(ctxQr, { ...invBase, recipientAddress: "" });
  assert.ok(nodebtor.ok && nodebtor.input.debtor === null);
  assert.equal(bill.countryCodeOf("Schweiz", "CH"), "CH");
  assert.equal(bill.countryCodeOf("Liechtenstein", "CH"), "LI");
  assert.equal(bill.countryCodeOf("", "LI"), "LI");
});

// ---- Status und Zahlungen --------------------------------------------------------------------------------------------------
test("fees-calc: Statuslogik mit Teil- und Überzahlung", () => {
  const inv = { status: "OFFEN" as const, totalRappen: 5000, paidRappen: 0 };
  assert.equal(calc.settleStatus("ENTWURF", { totalRappen: 5000, paidRappen: 5000 }), "ENTWURF");
  assert.equal(calc.settleStatus("STORNIERT", { totalRappen: 5000, paidRappen: 5000 }), "STORNIERT");
  const part = calc.applyPayment(inv, 2000);
  assert.deepEqual([part.status, part.openRappen, part.overpaidRappen, part.becamePaid], ["OFFEN", 3000, 0, false]);
  const full = calc.applyPayment({ ...inv, paidRappen: 2000 }, 3000);
  assert.deepEqual([full.status, full.openRappen, full.becamePaid], ["BEZAHLT", 0, true]);
  const over = calc.applyPayment(inv, 6000);
  assert.deepEqual([over.status, over.overpaidRappen, over.becamePaid], ["BEZAHLT", 1000, true]);
  const again = calc.applyPayment({ status: "BEZAHLT", totalRappen: 5000, paidRappen: 5000 }, 100);
  assert.deepEqual([again.status, again.overpaidRappen, again.becamePaid], ["BEZAHLT", 100, false]);
  // Zahlung entfernt → wieder offen
  assert.equal(calc.settleStatus("BEZAHLT", { totalRappen: 5000, paidRappen: 3000 }), "OFFEN");
  // Rechnung über 0 ist nie «bezahlt»
  assert.equal(calc.settleStatus("OFFEN", { totalRappen: 0, paidRappen: 0 }), "OFFEN");
  assert.ok(calc.paymentBlockedReason("ENTWURF"));
  assert.ok(calc.paymentBlockedReason("STORNIERT"));
  assert.equal(calc.paymentBlockedReason("OFFEN"), null);
  assert.equal(calc.paymentBlockedReason("BEZAHLT"), null);
  assert.equal(calc.paymentStateLabel({ status: "OFFEN", totalRappen: 100, paidRappen: 40 }), "Teilzahlung");
  assert.equal(calc.paymentStateLabel({ status: "OFFEN", totalRappen: 100, paidRappen: 140 }), "Überzahlung");
  assert.equal(calc.itemsTotal([{ description: "a", quantity: 2, unitRappen: 1250 }, { description: "b", quantity: 1, unitRappen: 5 }]), 2505);
});

// ---- Rechnungslauf ----------------------------------------------------------------------------------------------------------
const period = { startsOn: dateOnly(2026, 1, 1), endsOn: dateOnly(2026, 12, 31) };
const mem = (id: string, extra: Partial<{ status: string; joinedAt: Date | null; membershipTypeId: string | null }> = {}) => ({
  id,
  status: "AKTIV",
  joinedAt: dateOnly(2020, 5, 1),
  membershipTypeId: "aktiv",
  ...extra,
});

test("fees-calc: Rechnungslauf plant nach Mitgliedschaftsart und überspringt mit Grund", () => {
  const rates = new Map([["aktiv", 6000], ["passiv", 2500], ["frei", 0]]);
  const plan = calc.planInvoiceRun(
    [mem("a"), mem("b", { membershipTypeId: "passiv" }), mem("c", { membershipTypeId: "frei" }), mem("d", { membershipTypeId: null }), mem("e", { membershipTypeId: "unbekannt" }), mem("f", { status: "AUSGETRETEN" }), mem("g"), mem("h", { joinedAt: dateOnly(2027, 2, 1) })],
    rates,
    new Set(["g"]),
    period,
    { prorate: false, roundToFive: false },
  );
  assert.deepEqual(plan.entries.map((e) => [e.memberId, e.amountRappen]), [["a", 6000], ["b", 2500]]);
  assert.equal(plan.totalRappen, 8500);
  const reasons = Object.fromEntries(plan.skipped.map((s) => [s.memberId, s.reason]));
  assert.deepEqual(reasons, { c: "BEITRAG_NULL", d: "KEINE_ART", e: "KEIN_BEITRAG", f: "NICHT_AKTIV", g: "BEREITS_RECHNUNG", h: "EINTRITT_NACH_PERIODE" });
});

test("fees-calc: anteiliger Beitrag im Eintrittsjahr (optional, Eintrittsmonat zählt voll)", () => {
  assert.equal(calc.monthsInPeriod(dateOnly(2026, 1, 15), period.startsOn), 12);
  assert.equal(calc.monthsInPeriod(dateOnly(2026, 7, 1), period.startsOn), 6);
  assert.equal(calc.monthsInPeriod(dateOnly(2026, 12, 31), period.startsOn), 1);
  assert.equal(calc.monthsInPeriod(dateOnly(2025, 3, 1), period.startsOn), 12);
  const rates = new Map([["aktiv", 6000]]);
  const joined = mem("n", { joinedAt: dateOnly(2026, 7, 10) });
  const off = calc.planInvoiceRun([joined], rates, new Set(), period, { prorate: false, roundToFive: false });
  assert.equal(off.entries[0]!.amountRappen, 6000);
  assert.equal(off.entries[0]!.months, null);
  const on = calc.planInvoiceRun([joined], rates, new Set(), period, { prorate: true, roundToFive: false });
  assert.deepEqual([on.entries[0]!.amountRappen, on.entries[0]!.months], [3000, 6]);
  // Rundung auf 5 Rappen: 1000 Rappen × 7/12 = 583.33 → 583 → 585
  const odd = calc.planInvoiceRun([mem("o", { joinedAt: dateOnly(2026, 6, 1) })], new Map([["aktiv", 1000]]), new Set(), period, { prorate: true, roundToFive: true });
  assert.equal(odd.entries[0]!.amountRappen, 585);
  // Eintritt vor Beginn des Jahres: voller Beitrag
  const old = calc.planInvoiceRun([mem("p")], rates, new Set(), period, { prorate: true, roundToFive: false });
  assert.equal(old.entries[0]!.amountRappen, 6000);
  assert.equal(calc.feeItemDescription("", 2026, null), "Mitgliederbeitrag 2026");
  assert.equal(calc.feeItemDescription("Jahresbeitrag", 2026, 6), "Jahresbeitrag (anteilig, 6 Monate)");
  assert.equal(calc.feeItemDescription("Jahresbeitrag", 2026, 1), "Jahresbeitrag (anteilig, 1 Monat)");
});

test("fees-calc: Anschrift und Empfänger", () => {
  assert.equal(calc.addressBlockOf({ street: "Beispielweg", houseNumber: "7", zip: "8000", city: "Zürich", country: "CH" }), "Beispielweg 7\n8000 Zürich");
  assert.equal(calc.addressBlockOf({ street: "Weg", houseNumber: "", zip: "10115", city: "Berlin", country: "de" }), "Weg\n10115 Berlin\nDE");
  assert.equal(calc.addressBlockOf({ street: "", houseNumber: "", zip: "", city: "", country: "CH" }), "");
  assert.equal(calc.recipientNameOf({ firstName: " Anna ", lastName: "Beispiel " }), "Anna Beispiel");
});

test("fees-calc: offene Posten nach Altersgruppen", () => {
  const today = dateOnly(2026, 11, 5);
  assert.equal(calc.agingBucketOf(dateOnly(2026, 11, 5), today), "NOT_DUE");
  assert.equal(calc.agingBucketOf(dateOnly(2026, 11, 4), today), "D0_30");
  assert.equal(calc.agingBucketOf(dateOnly(2026, 10, 6), today), "D0_30");
  assert.equal(calc.agingBucketOf(dateOnly(2026, 10, 5), today), "D31_60");
  assert.equal(calc.agingBucketOf(dateOnly(2026, 8, 7), today), "D61_90");
  assert.equal(calc.agingBucketOf(dateOnly(2026, 8, 6), today), "D90_PLUS");
  const sum = calc.agingSummary(
    [
      { id: "1", dueDate: dateOnly(2026, 12, 1), totalRappen: 1000, paidRappen: 0, status: "OFFEN" },
      { id: "2", dueDate: dateOnly(2026, 10, 20), totalRappen: 2000, paidRappen: 500, status: "OFFEN" },
      { id: "3", dueDate: dateOnly(2026, 1, 1), totalRappen: 3000, paidRappen: 0, status: "OFFEN" },
      { id: "4", dueDate: dateOnly(2026, 1, 1), totalRappen: 3000, paidRappen: 3000, status: "OFFEN" },
      { id: "5", dueDate: dateOnly(2026, 1, 1), totalRappen: 3000, paidRappen: 0, status: "BEZAHLT" },
    ],
    today,
  );
  assert.equal(sum.count, 3);
  assert.equal(sum.rappen, 1000 + 1500 + 3000);
  assert.equal(sum.overdueRappen, 4500);
  assert.equal(sum.buckets.find((b) => b.id === "D90_PLUS")!.count, 1);
});

// ---- Mahnwesen ----------------------------------------------------------------------------------------------------------------
const rs = { reminderAfterDays: 10, reminderDays1: 14, reminderDays2: 10, reminderDays3: 7, reminderFee1Rappen: null, reminderFee2Rappen: 500, reminderFee3Rappen: 1000 };
const open = { status: "OFFEN", dueDate: dateOnly(2026, 10, 1), totalRappen: 5000, paidRappen: 0, reminderLevel: 0, lastReminderDueDate: null };

test("fees-reminders: Mahnstufen und Fristen", () => {
  const today = dateOnly(2026, 10, 11);
  assert.equal(rem.reminderStateOf({ ...open, status: "ENTWURF" }, rs, today).state, "NONE");
  assert.equal(rem.reminderStateOf({ ...open, paidRappen: 5000 }, rs, today).state, "NONE");
  assert.equal(rem.reminderStateOf(open, rs, dateOnly(2026, 10, 1)).state, "NOT_DUE"); // am Fälligkeitstag
  assert.equal(rem.reminderStateOf(open, rs, dateOnly(2026, 10, 10)).state, "NOT_DUE"); // Karenzzeit
  const r1 = rem.reminderStateOf(open, rs, today);
  assert.deepEqual(r1.state === "READY" && [r1.nextLevel, r1.daysOverdue], [1, 10]);
  assert.equal(rem.reminderStateOf(open, { ...rs, reminderAfterDays: null }, today).state, "NOT_DUE");
  // nach der 1. Mahnung: erst nach Ablauf ihrer Frist
  const lvl1 = { ...open, reminderLevel: 1, lastReminderDueDate: dateOnly(2026, 10, 25) };
  assert.equal(rem.reminderStateOf(lvl1, rs, dateOnly(2026, 10, 25)).state, "WAITING");
  const r2 = rem.reminderStateOf(lvl1, rs, dateOnly(2026, 10, 26));
  assert.deepEqual(r2.state === "READY" && r2.nextLevel, 2);
  const lvl2 = { ...open, reminderLevel: 2, lastReminderDueDate: dateOnly(2026, 11, 5) };
  const r3 = rem.reminderStateOf(lvl2, rs, dateOnly(2026, 11, 6));
  assert.deepEqual(r3.state === "READY" && r3.nextLevel, 3);
  // nach der 3. Mahnung: keine weitere Stufe, Hinweis auf den Vorstand
  const fin = rem.reminderStateOf({ ...open, reminderLevel: 3, lastReminderDueDate: dateOnly(2026, 11, 12) }, rs, dateOnly(2027, 1, 1));
  assert.equal(fin.state, "FINAL");
  // neue Frist
  assert.equal(dates.formatDateCh(rem.dueDateForLevel(rs, 1, dateOnly(2026, 10, 11))!), "25.10.2026");
  assert.equal(rem.dueDateForLevel({ ...rs, reminderDays2: null }, 2, dateOnly(2026, 10, 11)), null);
  assert.equal(sett.reminderFeeFor({ ...sett.DEFAULT_VEREIN_SETTINGS, ...rs }, 1), 0);
  assert.equal(sett.reminderFeeFor({ ...sett.DEFAULT_VEREIN_SETTINGS, ...rs }, 3), 1000);
});

test("fees-reminders: Standardtexte machen keine Rechtsaussage", () => {
  const ctx = { level: 2, invoiceNumber: "2026-0001", dueDateText: "1.10.2026", newDueDateText: "25.10.2026", openAmountText: "CHF 55.00", feeText: "CHF 5.00" };
  const text = rem.defaultReminderParagraphs(ctx).join(" ");
  assert.ok(text.includes("2026-0001") && text.includes("25.10.2026") && text.includes("Mahngebühr"));
  assert.ok(!/Betreibung|Verzugszins|rechtlich|gerichtlich/i.test(text));
  assert.ok(rem.defaultReminderParagraphs({ ...ctx, level: 1, feeText: null }).join(" ").includes("Zahlungseingang"));
  assert.ok(rem.defaultInvoiceParagraphs({ invoiceNumber: "2026-0001", subject: "Beitrag", totalText: "CHF 60.00", dueDateText: "5.12.2026" }).join(" ").includes("QR"));
});

// ---- Zahlungsabgleich -----------------------------------------------------------------------------------------------------------
const refQ = qr.buildInvoiceQrReference(2026, 1);
const invA = { id: "A", number: "2026-0001", year: 2026, seq: 1, status: "OFFEN", totalRappen: 6000, paidRappen: 0, paymentReference: refQ, memberName: "Anna Beispiel" };
const invB = { id: "B", number: "2026-0002", year: 2026, seq: 2, status: "ENTWURF", totalRappen: 6000, paidRappen: 0, paymentReference: "", memberName: "Ben" };
const invC = { id: "C", number: "2026-0003", year: 2026, seq: 3, status: "BEZAHLT", totalRappen: 6000, paidRappen: 6000, paymentReference: "", memberName: "Cora" };
const byRef = new Map([[refQ, invA]]);
const byKey = new Map([["2026-1", invA], ["2026-2", invB], ["2026-3", invC]]);

test("fees-import: CSV lesen (Trennzeichen, Kopfzeile, Beträge, Daten)", () => {
  const text = `Datum;Referenz;Betrag;Text\r\n5.11.2026;${refQ.replace(/(.{5})/g, "$1 ")};60.00;Beitrag\r\n2026-11-06;;"1'234.50";"Spende; gross"\r\n7.11.2026;X;-5.00;Belastung\r\n8.11.2026;Y;abc;kaputt\r\n`;
  const parsed = imp.parseBankCsv(text);
  assert.equal(parsed.error, null);
  assert.equal(parsed.rows.length, 4);
  assert.equal(parsed.rows[0]!.reference, refQ);
  assert.equal(parsed.rows[0]!.amountRappen, 6000);
  assert.equal(dates.formatDateCh(parsed.rows[0]!.date!), "5.11.2026");
  assert.equal(parsed.rows[1]!.amountRappen, 123450);
  assert.equal(parsed.rows[1]!.text, "Spende; gross");
  assert.match(parsed.rows[2]!.error, /Gutschrift/);
  assert.match(parsed.rows[3]!.error, /Betrag/);
  assert.equal(imp.detectDelimiter("a,b,c"), ",");
  assert.equal(imp.detectDelimiter("a\tb\tc"), "\t");
  assert.equal(imp.parseBankCsv("Referenz;Betrag\n").error !== null, true);
  assert.match(imp.parseBankCsv("Name;Wert\na;1\n").error ?? "", /Referenz/);
  const comma = imp.parseBankCsv('Referenz,Betrag\nRF18539007547034,"12,50"\n');
  assert.equal(comma.rows[0]!.amountRappen, 1250);
});

test("fees-import: Zuordnung zu Rechnungen", () => {
  const row = (reference: string, amountRappen: number | null, text = "", error = ""): Parameters<typeof imp.matchRow>[0] => ({ line: 2, reference, amountRappen, date: null, text, error });
  const dup = () => false;
  const exact = imp.matchRow(row(refQ, 6000), byRef, byKey, dup);
  assert.ok(exact.kind === "MATCH" && exact.invoice.id === "A" && exact.note === "Deckt den offenen Betrag.");
  assert.ok(imp.matchRow(row(refQ, 2000), byRef, byKey, dup).kind === "MATCH");
  assert.match((imp.matchRow(row(refQ, 2000), byRef, byKey, dup) as { note: string }).note, /Teilzahlung/);
  assert.match((imp.matchRow(row(refQ, 9000), byRef, byKey, dup) as { note: string }).note, /Überzahlung/);
  // Referenz nicht gespeichert, aber von uns erzeugt → über Jahr und Nummer gefunden
  const viaKey = imp.matchRow(row(qr.buildInvoiceScorReference(2026, 1), 6000), new Map(), byKey, dup);
  assert.ok(viaKey.kind === "MATCH" && viaKey.invoice.id === "A");
  // Rechnungsnummer im Text
  assert.ok(imp.matchRow(row("", 6000, "Beitrag 2026-0001 Anna"), new Map(), byKey, dup).kind === "MATCH");
  assert.equal(imp.matchRow(row("", 6000), byRef, byKey, dup).kind, "NO_REFERENCE");
  assert.equal(imp.matchRow(row("12345", 6000), byRef, byKey, dup).kind, "UNKNOWN");
  assert.equal(imp.matchRow(row(qr.buildInvoiceScorReference(2026, 2), 6000), new Map(), byKey, dup).kind, "NOT_PAYABLE"); // Entwurf
  assert.ok(imp.matchRow(row("", 100, "2026-0003"), new Map(), byKey, dup).kind === "MATCH"); // bezahlte Rechnung: Überzahlung möglich, wird angezeigt
  assert.equal(imp.matchRow(row(refQ, null, "", "Betrag nicht lesbar."), byRef, byKey, dup).kind, "INVALID");
  assert.equal(imp.matchRow(row(refQ, 6000), byRef, byKey, () => true).kind, "DUPLICATE");
});

// ---- Schemas und Export ------------------------------------------------------------------------------------------------------------
test("fees-schemas: Positionen und Zahlungen werden streng geprüft", () => {
  const item = { description: "Beitrag", quantity: 1, unit: "60.00" };
  assert.equal(sch.invoiceItemSchema.parse(item).unit, 6000);
  assert.equal(sch.invoiceItemSchema.parse({ ...item, unit: "1'234.50" }).unit, 123450);
  assert.ok(!sch.invoiceItemSchema.safeParse({ ...item, quantity: 0 }).success);
  assert.ok(!sch.invoiceItemSchema.safeParse({ ...item, quantity: 1.5 }).success);
  assert.ok(!sch.invoiceItemSchema.safeParse({ ...item, description: "" }).success);
  assert.ok(!sch.invoiceItemSchema.safeParse({ ...item, unit: "abc" }).success);
  assert.ok(!sch.invoiceCreateSchema.safeParse({ memberId: "m1", items: [] }).success);
  const p = sch.paymentCreateSchema.parse({ invoiceId: "i1", receivedAt: "5.11.2026", amount: "60.00" });
  assert.equal(p.amount, 6000);
  assert.equal(p.method, "UEBERWEISUNG");
  assert.ok(!sch.paymentCreateSchema.safeParse({ receivedAt: "5.11.2026", amount: "0" }).success);
  assert.ok(!sch.paymentCreateSchema.safeParse({ receivedAt: "5.11.2026", amount: "-5" }).success);
  assert.ok(!sch.paymentCreateSchema.safeParse({ receivedAt: "32.13.2026", amount: "5" }).success);
  assert.ok(!sch.paymentCreateSchema.safeParse({ receivedAt: "5.11.2026", amount: "5", method: "BITCOIN" }).success);
  assert.ok(!sch.invoiceCancelSchema.safeParse({ reason: "" }).success);
});

test("Export: Formel-Injektion in Namen und Betreff wird neutralisiert", () => {
  const out = csv.toCsv(["Nummer", "Name", "Betreff"], [["2026-0001", "=HYPERLINK(\"http://x\")", "+cmd|' /C calc'!A0"]]);
  assert.ok(out.includes("'=HYPERLINK"));
  assert.ok(out.includes("'+cmd"));
  assert.ok(out.includes("2026-0001"));
});
