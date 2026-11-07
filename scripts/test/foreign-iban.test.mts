// Tests: ausländische IBAN als Hauptkonto (z. B. IE-IBAN bei SumUp): IBAN- und BIC-Prüfung, Einstellungen, Fallunterscheidung
// QR-Rechnung / Einzahlungsangaben, Mailtexte und Zahlungsabgleich ohne Schweizer Annahmen (rein, ohne Datenbank).
// Aufruf:  npx tsx scripts/test/foreign-iban.test.mts
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

// "server-only" wirft ausserhalb von Next.js; für den Test durch ein leeres Modul ersetzen.
const require = createRequire(import.meta.url);
const serverOnlyPath = require.resolve("server-only");
require.cache[serverOnlyPath] = { id: serverOnlyPath, filename: serverOnlyPath, loaded: true, exports: {}, children: [], paths: [] } as unknown as NodeJS.Module;

const iban = await import("../../src/lib/verein/iban.ts");
const qr = await import("../../src/lib/verein/qr-bill.ts");
const calc = await import("../../src/lib/verein/fees-calc.ts");
const bill = await import("../../src/lib/verein/fees-bill.ts");
const rem = await import("../../src/lib/verein/fees-reminders.ts");
const mailText = await import("../../src/lib/verein/fees-mail-text.ts");
const imp = await import("../../src/lib/verein/fees-import.ts");
const sett = await import("../../src/lib/verein/settings-schema.ts");
const forms = await import("../../src/lib/verein/settings-forms.ts");
const overview = await import("../../src/lib/verein/overview-lib.ts");
const audit = await import("../../src/lib/verein/audit-view.ts");
const money = await import("../../src/lib/verein/money.ts");

const IE = "IE29AIBK93115212345678"; // Beispiel-IBAN aus dem IBAN-Register
const CH = "CH9300762011623852957";
const QR_IBAN = "CH4431999123000889012";

/** Berechnet die Prüfziffern selbst (mod 97) und baut eine IBAN aus Land und Kontonummer (BBAN). */
function makeIban(country: string, bban: string): string {
  const numeric = (s: string) => [...s].map((c) => (/[A-Z]/.test(c) ? String(c.charCodeAt(0) - 55) : c)).join("");
  let rest = 0;
  for (const ch of numeric(`${bban}${country}00`)) rest = (rest * 10 + Number(ch)) % 97;
  return `${country}${String(98 - rest).padStart(2, "0")}${bban}`;
}

// ---- IBAN ----------------------------------------------------------------------------------------------------------------
test("iban: Registerbeispiele und selbst berechnete IBAN sind gültig", () => {
  const registry = [
    "CH9300762011623852957", "LI21088100002324013AA", IE, "DE89370400440532013000", "AT611904300234573201", "FR1420041010050500013M02606",
    "IT60X0542811101000000123456", "ES9121000418450200051332", "NL91ABNA0417164300", "BE68539007547034", "LU280019400644750000",
    "GB82WEST12345698765432", "PT50000201231234567890154", "DK5000400440116243", "SE4550000000058398257466", "NO9386011117947",
    "PL61109010140000071219812874", "CZ6508000000192000145399",
  ];
  for (const v of registry) assert.equal(iban.isValidIban(v), true, v);
  // jedes Land der Liste: Länge laut Register, selbst berechnete Prüfziffern
  const lengths: Record<string, number> = { CH: 21, LI: 21, IE: 22, DE: 22, AT: 20, FR: 27, IT: 27, ES: 24, NL: 18, BE: 16, LU: 20, GB: 22, PT: 25, DK: 18, SE: 24, NO: 15, PL: 28, CZ: 24 };
  for (const [cc, len] of Object.entries(lengths)) {
    assert.equal(iban.IBAN_LENGTHS[cc], len, cc);
    const made = makeIban(cc, "1234567890".repeat(4).slice(0, len - 4));
    assert.equal(made.length, len);
    assert.equal(iban.isValidIban(made), true, made);
    assert.equal(iban.isValidIban(made.slice(0, -1)), false, `${cc} zu kurz`);
    assert.equal(iban.isValidIban(`${made}0`), false, `${cc} zu lang`);
  }
  // erfundene IE-IBAN mit eigener Prüfziffer
  const own = makeIban("IE", "SUMU99000011112222");
  assert.equal(iban.isValidIban(own), true);
  assert.equal(iban.ibanCountryOf(own), "IE");
});

test("iban: Leerzeichen und Kleinschreibung werden toleriert, falsche Prüfsumme und Länge abgelehnt", () => {
  assert.equal(iban.isValidIban("IE29 AIBK 9311 5212 3456 78"), true);
  assert.equal(iban.isValidIban("ie29aibk93115212345678"), true);
  assert.equal(iban.normalizeIban(" ie29 aibk 9311 5212 3456 78 "), IE);
  assert.equal(iban.formatIban("ie29aibk93115212345678"), "IE29 AIBK 9311 5212 3456 78");
  assert.equal(iban.isValidIban("IE29AIBK93115212345679"), false); // Prüfsumme
  assert.match(iban.ibanProblem("IE29AIBK93115212345679") ?? "", /Prüfziffern/);
  assert.equal(iban.isValidIban("IE29AIBK9311521234567"), false); // IE: 22 Zeichen
  assert.match(iban.ibanProblem("IE29AIBK9311521234567") ?? "", /IE hat 22 Zeichen/);
  assert.equal(iban.isValidIban("DE8937040044053201300"), false); // DE: 22 Zeichen
  assert.equal(iban.isValidIban("CH93007620116238529"), false);
  assert.equal(iban.isValidIban("abc"), false);
  assert.equal(iban.isValidIban(""), false);
  assert.equal(iban.isValidIban("1E29AIBK93115212345678"), false); // Land muss mit Buchstaben beginnen
  // unbekanntes Land: allgemeine Regel 15 bis 34 Zeichen und Prüfsumme
  const unknown = makeIban("ZZ", "ABCD1234567890");
  assert.equal(iban.IBAN_LENGTHS.ZZ, undefined);
  assert.equal(iban.isValidIban(unknown), true);
  assert.equal(iban.isValidIban(makeIban("ZZ", "ABC")), false); // zu kurz (unter 15)
  assert.equal(iban.isValidIban(makeIban("ZZ", "A".repeat(31))), false); // zu lang (über 34)
  assert.equal(iban.isValidIban(makeIban("ZZ", "A".repeat(30))), true); // 34 Zeichen
});

test("iban: Art der IBAN (Schweiz, QR-IBAN, Ausland) und Rückmeldung im Formular", () => {
  assert.equal(iban.ibanKindOf(CH), "SWISS");
  assert.equal(iban.ibanKindOf("LI21088100002324013AA"), "SWISS");
  assert.equal(iban.ibanKindOf(QR_IBAN), "QR");
  assert.equal(iban.ibanKindOf(IE), "FOREIGN");
  assert.equal(iban.ibanKindOf("IE29AIBK93115212345679"), null);
  assert.equal(iban.isValidSwissIban(IE), false);
  assert.equal(iban.isForeignIban(IE), true);
  assert.equal(iban.isForeignIban(CH), false);
  assert.equal(iban.isForeignIban("IE00"), false);
  assert.deepEqual(iban.describeIban(""), { state: "empty" });
  const f = iban.describeIban("ie29 aibk 9311 5212 3456 78");
  assert.ok(f.state === "valid" && f.kind === "FOREIGN" && f.country === "IE" && f.formatted === "IE29 AIBK 9311 5212 3456 78");
  assert.ok(f.state === "valid" && f.label === "Ausländische IBAN (IE) – keine Schweizer QR-Rechnung möglich");
  const c = iban.describeIban(CH);
  assert.ok(c.state === "valid" && c.label === "Schweizer IBAN");
  const bad = iban.describeIban("IE29AIBK93115212345679");
  assert.ok(bad.state === "invalid" && /Prüfziffern/.test(bad.message));
});

test("iban: BIC/SWIFT (8 oder 11 Zeichen, Format)", () => {
  for (const ok of ["AIBKIE2D", "aibkie2d", "AIBK IE2D", "AIBKIE2DXXX", "SUMUIE22XXX", "UBSWCHZH80A", "DEUTDEFF500"]) assert.equal(iban.isValidBic(ok), true, ok);
  for (const bad of ["", "AIBKIE2", "AIBKIE2DX", "AIBKIE2DXX", "AIBKIE2DXXXX", "1IBKIE2D", "AIBK1E2D", "AIBKIE2D-XX", "AIB_IE2D"]) assert.equal(iban.isValidBic(bad), false, bad);
  assert.equal(iban.normalizeBic(" aibk ie2d "), "AIBKIE2D");
});

// ---- Einstellungen ---------------------------------------------------------------------------------------------------------
test("settings: ausländische IBAN, BIC, Bank und Zahlungsempfänger im Schema; alte Werte bleiben gültig", () => {
  const base = { ...sett.DEFAULT_VEREIN_SETTINGS };
  assert.equal(base.bic, "");
  assert.equal(base.payeeName, "");
  const ok = sett.vereinSettingsSchema.safeParse({ ...base, iban: "ie29 aibk 9311 5212 3456 78", bic: "aibk ie2d", bank: "SumUp Payments Limited", payeeName: "Verein Muster" });
  assert.equal(ok.success, true);
  if (ok.success) {
    assert.equal(ok.data.iban, IE, "IBAN wird normalisiert gespeichert");
    assert.equal(ok.data.bic, "AIBKIE2D");
  }
  const message = (input: Record<string, unknown>) => {
    const r = sett.vereinSettingsSchema.safeParse({ ...base, ...input });
    return r.success ? null : r.error.issues.map((i) => i.message).join(" ");
  };
  assert.match(message({ iban: "IE29AIBK93115212345679" }) ?? "", /Prüfziffern/);
  assert.match(message({ iban: "IE29AIBK9311521234567" }) ?? "", /22 Zeichen/);
  assert.match(message({ bic: "AIBKIE2" }) ?? "", /BIC/);
  assert.match(message({ payeeName: "x".repeat(71) }) ?? "", /70/);
  assert.match(message({ bank: "x".repeat(71) }) ?? "", /70/);
  assert.equal(message({ bic: "" }), null);
  // bisherige Werte bleiben gültig (nur Schweizer Konto, ohne die neuen Felder)
  assert.equal(sett.vereinSettingsSchema.safeParse({ ...base, iban: CH, qrIban: QR_IBAN, bank: "Raiffeisen" }).success, true);
  assert.equal(sett.vereinSettingsSchema.safeParse({ ...base, iban: QR_IBAN }).success, false); // QR-IBAN gehört in qrIban
  assert.equal(sett.vereinSettingsSchema.safeParse({ ...base, qrIban: IE }).success, false); // QR-IBAN nur Schweiz
  const parsed = sett.parseVereinSettings({ "verein.account.iban": CH, "verein.account.holder": "Verein", "verein.fees.paymentDays": "30" });
  assert.equal(parsed.iban, CH);
  assert.equal(parsed.bic, "");
  // Key/Value
  const s = sett.parseVereinSettings({ "verein.account.iban": IE, "verein.account.bic": "AIBKIE2D", "verein.account.bank": "SumUp", "verein.account.payeeName": "Muster Verein" });
  assert.deepEqual([s.iban, s.bic, s.bank, s.payeeName], [IE, "AIBKIE2D", "SumUp", "Muster Verein"]);
  assert.deepEqual(sett.serializeVereinSettings({ iban: IE, bic: "AIBKIE2D", payeeName: "" }), { "verein.account.iban": IE, "verein.account.bic": "AIBKIE2D", "verein.account.payeeName": "" });
  // ungültiger gespeicherter Wert fällt auf die Voreinstellung zurück
  assert.equal(sett.parseVereinSettings({ "verein.account.bic": "kaputt" }).bic, "");
  // Vollständigkeit: ausländische IBAN ist kein Fehler
  const complete = { ...base, accountHolder: "Verein Muster", iban: IE, paymentDays: 30 };
  assert.deepEqual(sett.missingForInvoicing(complete), []);
  assert.equal(sett.missingForInvoicing(base).some((m) => m.field === "iban"), true);
});

test("settings: Finanzeinstellungen nehmen die neuen Felder, QR-IBAN schliesst sich mit ausländischer IBAN aus", () => {
  for (const f of ["bic", "payeeName", "bank", "iban", "qrIban"]) assert.ok((forms.FINANCE_SETTING_FIELDS as readonly string[]).includes(f), f);
  assert.equal(forms.GENERAL_SETTING_FIELDS.length + forms.FINANCE_SETTING_FIELDS.length, Object.keys(sett.VEREIN_SETTING_KEYS).length);
  const ok = forms.financeSettingsInputSchema.safeParse({ settings: { iban: "IE29 AIBK 9311 5212 3456 78", bic: "aibkie2d", bank: "SumUp Payments Limited", payeeName: "" } });
  assert.equal(ok.success, true);
  if (ok.success) assert.deepEqual([ok.data.settings.iban, ok.data.settings.bic], [IE, "AIBKIE2D"]);
  assert.equal(forms.generalSettingsInputSchema.safeParse({ settings: { bic: "AIBKIE2D" } }).success, false);
  assert.equal(forms.financeSettingsInputSchema.safeParse({ settings: { iban: "IE29AIBK93115212345679" } }).success, false);
  // feldübergreifend
  assert.deepEqual(sett.accountConflicts({ iban: IE, qrIban: "" }), {});
  assert.deepEqual(sett.accountConflicts({ iban: CH, qrIban: QR_IBAN }), {});
  assert.deepEqual(sett.accountConflicts({ iban: "", qrIban: QR_IBAN }), {});
  assert.ok(sett.accountConflicts({ iban: IE, qrIban: QR_IBAN }).qrIban);
  // Übersicht und Protokoll kennen die Felder
  assert.equal(overview.settingsHrefFor("bic"), "/admin/verein/finanzen");
  assert.equal(overview.settingsHrefFor("payeeName"), "/admin/verein/finanzen");
  assert.equal(audit.AUDIT_FIELD_LABEL.bic, "BIC/SWIFT");
  assert.ok(audit.AUDIT_FIELD_LABEL.payeeName);
  assert.equal(audit.AUDIT_FIELD_LABEL.iban, "IBAN");
});

// ---- Rechnung: Fallunterscheidung ----------------------------------------------------------------------------------------
const legal = { street: "Musterstrasse 1", zipCity: "9000 Musterort", country: "Schweiz" };
const base = { accountHolder: "Muster Verein", iban: IE, qrIban: "", bic: "AIBKIE2D", bank: "SumUp Payments Limited", legal };
const inv = { number: "2026-0001", year: 2026, seq: 1, totalRappen: 5000, paidRappen: 1000, paymentReference: "", recipientName: "Anna Beispiel", recipientAddress: "Beispielweg 7\n8000 Zürich" };

test("fees-bill: ausländische IBAN ergibt Einzahlungsangaben, keine QR-Rechnung und keine QR-Daten", () => {
  const b = bill.composeInvoiceBill(base, inv);
  assert.ok(b.ok && b.mode === "DETAILS");
  if (!b.ok || b.mode !== "DETAILS") return;
  assert.equal("payload" in b, false);
  assert.equal("input" in b, false);
  const d = b.details;
  assert.deepEqual(d.payeeLines, ["Muster Verein", "Musterstrasse 1", "9000 Musterort"]);
  assert.equal(d.iban, "IE29 AIBK 9311 5212 3456 78");
  assert.equal(d.ibanCountry, "IE");
  assert.equal(d.bic, "AIBKIE2D");
  assert.equal(d.bank, "SumUp Payments Limited");
  assert.equal(d.currency, "CHF");
  assert.equal(d.amount, "40.00"); // offener Betrag
  assert.match(d.reference.replace(/ /g, ""), /^RF\d{2}20260001$/);
  assert.equal(d.reference, d.reference.replace(/ /g, "").replace(/(.{4})/g, "$1 ").trim());
  assert.equal(iban.isValidCreditorReference(d.reference), true);
  assert.equal(d.message, "Rechnung 2026-0001");
  assert.equal(bill.billReferenceOf(b), d.reference);
  // die Swiss-QR-Rechnung selbst lehnt die ausländische IBAN ab
  const direct = qr.validateQrBill({ account: IE, creditor: { name: "Muster Verein", zip: "9000", town: "Musterort", country: "CH" }, referenceType: "SCOR", reference: "RF18539007547034" });
  assert.ok(direct.some((i) => i.field === "account"));
  assert.throws(() => qr.buildQrBillPayload({ account: IE, creditor: { name: "Muster Verein", zip: "9000", town: "Musterort", country: "CH" }, referenceType: "SCOR", reference: "RF18539007547034" }), qr.QrBillError);
});

test("fees-bill: optionale Angaben fehlen (kein BIC, keine Bank), abweichender Zahlungsempfänger", () => {
  const minimal = bill.composeInvoiceBill({ accountHolder: "Muster Verein", iban: IE, qrIban: "", legal }, inv);
  assert.ok(minimal.ok && minimal.mode === "DETAILS" && minimal.details.bic === null && minimal.details.bank === null);
  const other = bill.composeInvoiceBill({ ...base, payeeName: "Muster Verein c/o SumUp" }, inv);
  assert.ok(other.ok && other.mode === "DETAILS" && other.details.payeeLines[0] === "Muster Verein c/o SumUp");
  assert.equal(bill.payeeNameOf({ accountHolder: "A", payeeName: "  " }), "A");
  assert.equal(bill.payeeNameOf({ accountHolder: "A", payeeName: "B" }), "B");
  // offener Betrag kann entfallen
  const open = bill.composeInvoiceBill(base, inv, null);
  assert.ok(open.ok && open.mode === "DETAILS" && open.details.amount === null);
  // ungültiger BIC wird nicht angezeigt
  const badBic = bill.composeInvoiceBill({ ...base, bic: "xx" }, inv);
  assert.ok(badBic.ok && badBic.mode === "DETAILS" && badBic.details.bic === null);
});

test("fees-bill: Schweizer Konto bleibt QR-Rechnung (IBAN mit Creditor Reference, QR-IBAN mit QR-Referenz)", () => {
  const ch = bill.composeInvoiceBill({ ...base, iban: CH, bic: "", bank: "" }, inv);
  assert.ok(ch.ok && ch.mode === "QR_BILL");
  if (ch.ok && ch.mode === "QR_BILL") {
    assert.equal(ch.input.referenceType, "SCOR");
    assert.equal(ch.input.account, CH);
    assert.ok(ch.payload.startsWith("SPC\n0200\n1\n"));
  }
  const withQr = bill.composeInvoiceBill({ ...base, iban: CH, qrIban: QR_IBAN }, inv);
  assert.ok(withQr.ok && withQr.mode === "QR_BILL");
  if (withQr.ok && withQr.mode === "QR_BILL") {
    assert.equal(withQr.input.referenceType, "QRR");
    assert.equal(withQr.input.account, QR_IBAN);
    assert.equal(withQr.input.reference, qr.buildInvoiceQrReference(2026, 1));
  }
  const onlyQr = bill.composeInvoiceBill({ ...base, iban: "", qrIban: QR_IBAN }, inv);
  assert.ok(onlyQr.ok && onlyQr.mode === "QR_BILL");
  // Liechtenstein bleibt QR-Rechnung
  const li = bill.composeInvoiceBill({ ...base, iban: makeIban("LI", "088100002324013AA") }, inv);
  assert.ok(li.ok && li.mode === "QR_BILL");
});

test("fees-calc: keine QR-Referenz bei ausländischer IBAN, ein Hauptkonto", () => {
  const a = calc.chooseBillAccount({ iban: IE, qrIban: "" }, { year: 2026, seq: 7, paymentReference: "" });
  assert.ok(a && a.mode === "DETAILS" && a.referenceType === "SCOR" && a.account === IE);
  assert.match(a!.reference, /^RF\d{2}20260007$/);
  // gespeicherte QR-Referenz (früheres Schweizer Konto): bei ausländischer IBAN gibt es die Creditor Reference, nie QRR
  const storedQr = qr.buildInvoiceQrReference(2026, 7);
  const b = calc.chooseBillAccount({ iban: IE, qrIban: "" }, { year: 2026, seq: 7, paymentReference: storedQr });
  assert.ok(b && b.referenceType === "SCOR" && b.reference === a!.reference);
  // gespeicherte Creditor Reference bleibt
  const c = calc.chooseBillAccount({ iban: IE, qrIban: "" }, { year: 2026, seq: 7, paymentReference: a!.reference });
  assert.equal(c!.reference, a!.reference);
  // widersprüchliche Einstellungen (ausländische IBAN und QR-IBAN): die ausländische IBAN ist das Hauptkonto, nie eine QR-Referenz
  const d = calc.chooseBillAccount({ iban: IE, qrIban: QR_IBAN }, { year: 2026, seq: 7, paymentReference: "" });
  assert.ok(d && d.mode === "DETAILS" && d.referenceType === "SCOR");
  assert.equal(calc.chooseBillAccount({ iban: CH, qrIban: QR_IBAN }, { year: 2026, seq: 7, paymentReference: "" })!.referenceType, "QRR");
  assert.equal(calc.billModeOf({ iban: IE, qrIban: "" }), "DETAILS");
  assert.equal(calc.billModeOf({ iban: CH, qrIban: "" }), "QR_BILL");
  assert.equal(calc.billModeOf({ iban: "", qrIban: QR_IBAN }), "QR_BILL");
  assert.equal(calc.billModeOf({ iban: "", qrIban: "" }), null);
  assert.match(calc.referenceForNewInvoice({ iban: IE, qrIban: "" }, 2026, 12), /^RF\d{2}20260012$/);
  assert.equal(calc.referenceForNewInvoice({ iban: "", qrIban: "" }, 2026, 12), "");
});

test("fees-bill: Pflichtangaben (Anschrift, IBAN) und Land der Anschrift hängt nicht vom IBAN-Land ab", () => {
  const noAddr = bill.composeInvoiceBill({ ...base, legal: { street: "", zipCity: "", country: "" } }, inv);
  assert.ok(!noAddr.ok && noAddr.mode === "DETAILS" && noAddr.problems.some((p) => p.includes("Anschrift")));
  const noName = bill.composeInvoiceBill({ ...base, accountHolder: "" }, inv);
  assert.ok(!noName.ok && noName.problems.some((p) => p.includes("Kontoinhaber")));
  const paid = bill.composeInvoiceBill(base, { ...inv, paidRappen: 5000 });
  assert.ok(!paid.ok && paid.problems.some((p) => p.includes("kein Betrag")));
  const none = bill.composeInvoiceBill({ ...base, iban: "" }, inv);
  assert.ok(!none.ok && none.problems.some((p) => p.includes("IBAN")));
  // ausländische IBAN ist kein Fehler; die Anschrift bleibt Schweiz (auch ohne Länderangabe in den Rechtlichen Einstellungen)
  for (const country of ["Schweiz", "", "CH"]) {
    const { address, problems } = bill.creditorFrom({ ...base, legal: { ...legal, country } });
    assert.deepEqual(problems, []);
    assert.equal(address?.country, "CH", `Land der Anschrift bei «${country}»`);
  }
  assert.equal(bill.creditorFrom({ ...base, legal: { ...legal, country: "Liechtenstein" } }).address?.country, "LI");
  assert.equal(bill.creditorFrom({ ...base, iban: CH, legal: { ...legal, country: "" } }).address?.country, "CH");
  assert.equal(bill.countryCodeOf("", "CH"), "CH");
  assert.equal(bill.billUnavailableMessage("DETAILS"), "Die Einzahlungsangaben können noch nicht erstellt werden");
  assert.equal(bill.billUnavailableMessage("QR_BILL"), "Die QR-Rechnung kann noch nicht erstellt werden");
});

// ---- Mailtexte ---------------------------------------------------------------------------------------------------------------
const facts = { number: "2026-0001", subject: "Mitgliederbeitrag 2026", totalRappen: 5000, paidRappen: 0, dueDate: new Date("2026-12-05T00:00:00Z") };
const target = { to: "anna@example.org", firstName: "Anna" };
const flatten = (c: ReturnType<typeof mailText.invoiceMailContent>) => [c.subject, c.heading, c.preheader ?? "", ...c.paragraphs, ...(c.details ?? []).flat(), c.cta?.label ?? "", c.footerNote ?? ""].join("\n");

test("fees-mail-text: Rechnungsmail mit Einzahlungsangaben, ohne QR-Begriffe", () => {
  const b = bill.composeInvoiceBill(base, { ...inv, paidRappen: 0 });
  const c = mailText.invoiceMailContent(target, facts, "https://example.org/rechnung/t", "", b);
  const text = flatten(c);
  assert.ok(!/QR|Zahlteil|scannen|einlesen/i.test(text), text);
  assert.match(text, /Einzahlungsangaben/);
  const detail = Object.fromEntries(c.details ?? []);
  assert.equal(detail["IBAN"], "IE29 AIBK 9311 5212 3456 78");
  assert.equal(detail["BIC/SWIFT"], "AIBKIE2D");
  assert.equal(detail["Bank"], "SumUp Payments Limited");
  assert.match(detail["Zahlungsreferenz"] ?? "", /^RF\d{2} /);
  assert.equal(detail["Betrag"], money.formatChfWithCurrency(5000));
  assert.match(detail["Zahlungsempfänger"] ?? "", /Muster Verein/);
  assert.equal(c.cta?.label, "Rechnung mit Einzahlungsangaben ansehen");
  assert.ok(c.paragraphs.some((p) => p.includes("im Ausland") && p.includes("IE") && p.includes("CHF")));
  assert.equal(c.paragraphs[0], "Hallo Anna,");
});

test("fees-mail-text: Rechnungsmail bei Schweizer Konto wie bisher (QR-Zahlteil)", () => {
  const b = bill.composeInvoiceBill({ ...base, iban: CH }, { ...inv, paidRappen: 0 });
  const c = mailText.invoiceMailContent(target, facts, "https://example.org/rechnung/t", "Eigene Einleitung", b);
  const text = flatten(c);
  assert.match(text, /QR-Rechnung/);
  assert.match(text, /Zahlteil/);
  assert.equal(c.cta?.label, "Rechnung mit Zahlteil ansehen");
  assert.equal(c.paragraphs[1], "Eigene Einleitung");
  assert.ok(!(c.details ?? []).some(([l]) => l === "IBAN"));
  assert.ok(!c.paragraphs.some((p) => p.includes("im Ausland")));
  // ohne Angabe (Zusammenstellung nicht möglich) gilt der bisherige Text
  assert.equal(mailText.invoiceMailContent(target, facts, "u", "", null).cta?.label, "Rechnung mit Zahlteil ansehen");
  assert.ok(rem.defaultInvoiceParagraphs({ invoiceNumber: "1", subject: "", totalText: "CHF 1.00", dueDateText: "1.1.2027" }).join(" ").includes("QR"));
  assert.ok(!/QR|Zahlteil/.test(rem.defaultInvoiceParagraphs({ invoiceNumber: "1", subject: "", totalText: "CHF 1.00", dueDateText: "1.1.2027", mode: "DETAILS" }).join(" ")));
});

test("fees-mail-text: Mahnung mit Einzahlungsangaben bzw. Zahlteil", () => {
  const reminder = { level: 2, dueDate: new Date("2027-01-10T00:00:00Z"), feeRappen: 500 };
  const foreign = mailText.reminderMailContent(target, facts, reminder, "https://example.org/rechnung/t", "", bill.composeInvoiceBill(base, inv));
  const text = [foreign.subject, foreign.heading, ...foreign.paragraphs, ...(foreign.details ?? []).flat(), foreign.cta?.label ?? ""].join("\n");
  assert.ok(!/QR|Zahlteil|scannen/i.test(text), text);
  assert.equal(foreign.subject, "2. Mahnung zur Rechnung 2026-0001");
  assert.equal(Object.fromEntries(foreign.details ?? [])["IBAN"], "IE29 AIBK 9311 5212 3456 78");
  assert.equal(foreign.cta?.label, "Rechnung mit Einzahlungsangaben ansehen");
  const swiss = mailText.reminderMailContent(target, facts, reminder, "u", "", bill.composeInvoiceBill({ ...base, iban: CH }, inv));
  assert.equal(swiss.cta?.label, "Rechnung mit Zahlteil ansehen");
  assert.ok(!(swiss.details ?? []).some(([l]) => l === "IBAN"));
  assert.ok(!/Betreibung|Verzugszins|rechtlich/i.test(foreign.paragraphs.join(" ")));
});

// ---- Zahlungseingang ---------------------------------------------------------------------------------------------------------
const scorA = qr.buildInvoiceScorReference(2026, 1);
const invA = { id: "A", number: "2026-0001", year: 2026, seq: 1, status: "OFFEN", totalRappen: 5000, paidRappen: 0, paymentReference: scorA, memberName: "Anna Beispiel" };
const byKey = new Map([["2026-1", invA]]);
const byRef = new Map([[scorA.toUpperCase(), invA]]);
const grouped = scorA.replace(/(.{4})/g, "$1 ").trim();

test("fees-import: Zuordnung über Creditor Reference oder Rechnungsnummer im Verwendungszweck (ausländischer Anbieter)", () => {
  assert.deepEqual(imp.creditorReferencesIn(`Zahlung ${grouped} Anna Beispiel`), [scorA]);
  assert.deepEqual(imp.creditorReferencesIn(`ref ${scorA.toLowerCase()}`), [scorA]);
  assert.deepEqual(imp.creditorReferencesIn("RF00 1234 kein gueltiger Wert"), []);
  assert.deepEqual(imp.creditorReferencesIn("Rechnung 2026-0001"), []);

  // CSV eines ausländischen Anbieters: nur Datum, Verwendungszweck, Betrag (keine Spalte «Referenz»)
  const csv = `Date;Description;Amount\n2026-11-05;"${grouped} Mitgliederbeitrag";40.00\n2026-11-06;Beitrag 2026-0001 Anna;50.00\n2026-11-07;Spende;10.00\n`;
  const parsed = imp.parseBankCsv(csv);
  assert.equal(parsed.error, null);
  assert.equal(parsed.rows.length, 3);
  assert.equal(parsed.rows[0]!.reference, "");
  assert.equal(parsed.rows[0]!.amountRappen, 4000);
  const dup = () => false;
  const r0 = imp.matchRow(parsed.rows[0]!, byRef, byKey, dup);
  assert.ok(r0.kind === "MATCH" && r0.invoice.id === "A");
  const r1 = imp.matchRow(parsed.rows[1]!, byRef, byKey, dup);
  assert.ok(r1.kind === "MATCH" && r1.invoice.id === "A");
  assert.equal(imp.matchRow(parsed.rows[2]!, byRef, byKey, dup).kind, "NO_REFERENCE");
  // Creditor Reference im Text, Rechnung nur über Jahr und Nummer bekannt (Referenz nicht gespeichert)
  const viaKey = imp.matchRow({ line: 2, reference: "", amountRappen: 4000, date: null, text: `Zahlung ${grouped}`, error: "" }, new Map(), byKey, dup);
  assert.ok(viaKey.kind === "MATCH" && viaKey.invoice.id === "A");
  // Verwendungszweck «Verwendungszweck» (deutsche Kopfzeile) funktioniert ebenso
  const de = imp.parseBankCsv("Buchungsdatum;Verwendungszweck;Betrag\n5.11.2026;RF18 5390 0754 7034 x;12.50\n");
  assert.equal(de.error, null);
  assert.equal(de.rows[0]!.text.startsWith("RF18"), true);
  // die bisherige Kopfzeile mit Referenz und Betrag funktioniert unverändert, ohne Betrag nicht
  assert.equal(imp.parseBankCsv("Referenz;Betrag\nRF18539007547034;12.50\n").rows[0]!.reference, "RF18539007547034");
  assert.match(imp.parseBankCsv("Referenz;Text\nx;y\n").error ?? "", /Betrag/);
  assert.match(imp.parseBankCsv("Name;Wert\na;1\n").error ?? "", /Referenz/);
});
