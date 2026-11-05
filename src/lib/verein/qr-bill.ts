// Schweizer QR-Rechnung (QR-bill) nach den Swiss Payment Standards / Implementation Guidelines QR-bill (Datenstruktur Version 0200).
// Reine Funktionen ohne Seiteneffekte: Prüfung der Eingaben, Aufbau des QR-Codes-Inhalts («Payload»), Referenzen, Darstellungstexte.
// Die Erzeugung der QR-Grafik steht in ./qr-bill-svg.ts, die Druckansicht in components/verein/qr-bill-slip.tsx.
//
// Aufbau der Payload (jede Zeile ein Element, Trennzeichen LF):
//   Header:        «SPC», «0200», Coding «1»
//   Konto:         IBAN bzw. QR-IBAN (CH/LI, 21 Zeichen, ohne Leerzeichen)
//   Zahlungsempfänger: Adresstyp «S» (strukturiert), Name, Strasse, Hausnummer, PLZ, Ort, Land
//   Endgültiger Zahlungsempfänger: 7 leere Elemente (in der heutigen Version nicht zu verwenden)
//   Zahlungsbetrag: Betrag mit zwei Nachkommastellen (leer = offener Betrag), Währung CHF oder EUR
//   Zahlungspflichtiger: Adresstyp «S», Name, Strasse, Hausnummer, PLZ, Ort, Land (alle 7 Elemente leer, wenn nicht angegeben)
//   Referenz:      Typ QRR (QR-Referenz, nur mit QR-IBAN), SCOR (Creditor Reference ISO 11649, nur mit normaler IBAN) oder NON
//   Zusätzliche Informationen: Zahlungszweck (unstrukturierte Mitteilung), Trailer «EPD», Rechnungsinformation
// Die kombinierte Adresse (Typ «K») ist nicht mehr zulässig und wird hier nicht unterstützt.
import {
  buildCreditorReference,
  buildQrReference,
  formatIban,
  formatQrReference,
  isQrIban,
  isValidCreditorReference,
  isValidQrReference,
  isValidSwissIban,
  normalizeIban,
} from "./iban";
import { formatChf, toDecimalString } from "./money";

export { buildCreditorReference, buildQrReference, formatIban, formatQrReference, isQrIban, isValidCreditorReference, isValidQrReference, isValidSwissIban, normalizeIban };
export { isValidIban, mod10Recursive } from "./iban";

export const QR_BILL_HEADER = "SPC";
export const QR_BILL_VERSION = "0200";
export const QR_BILL_CODING = "1";
export const QR_BILL_TRAILER = "EPD";
/** Grösste zulässige Länge des QR-Code-Inhalts in Zeichen. */
export const QR_BILL_MAX_PAYLOAD = 997;
/** Höchste zulässige QR-Code-Version (Version 25, 117 × 117 Module). */
export const QR_BILL_MAX_VERSION = 25;

export const QR_BILL_CURRENCIES = ["CHF", "EUR"] as const;
export type QrBillCurrency = (typeof QR_BILL_CURRENCIES)[number];
export type QrBillReferenceType = "QRR" | "SCOR" | "NON";

/** Längengrenzen der Elemente (Spezifikation). */
export const QR_BILL_LIMITS = {
  name: 70,
  street: 70,
  houseNo: 16,
  zip: 16,
  town: 35,
  country: 2,
  message: 140,
  billInformation: 140,
  /** Zahlungszweck und Rechnungsinformation zusammen */
  messageAndBillInformation: 140,
  scor: 25,
  qrr: 27,
  minAmountRappen: 1,
  maxAmountRappen: 99_999_999_999,
} as const;

/** Layout des Zahlteils in Millimetern (210 × 105 mm: Empfangsschein 62 mm, Zahlteil 148 mm). */
export const QR_BILL_LAYOUT = {
  widthMm: 210,
  heightMm: 105,
  receiptWidthMm: 62,
  paymentPartWidthMm: 148,
  marginMm: 5,
  qrSizeMm: 46,
  crossSizeMm: 7,
  fonts: {
    /** Titel «Empfangsschein» / «Zahlteil» */
    titlePt: 11,
    receiptHeadingPt: 6,
    receiptValuePt: 8,
    paymentHeadingPt: 8,
    paymentValuePt: 10,
    furtherInfoPt: 7,
  },
} as const;

export type QrBillAddress = {
  name: string;
  street?: string;
  houseNo?: string;
  zip: string;
  town: string;
  /** ISO-Ländercode mit zwei Grossbuchstaben, z. B. «CH» */
  country: string;
};

export type QrBillInput = {
  /** IBAN (CH/LI) oder QR-IBAN */
  account: string;
  creditor: QrBillAddress;
  /** Betrag in Rappen; null/undefined = offener Betrag (Betrag wird bei der Zahlung eingetragen) */
  amountRappen?: number | null;
  currency?: QrBillCurrency;
  debtor?: QrBillAddress | null;
  referenceType: QrBillReferenceType;
  reference?: string;
  /** Zahlungszweck (unstrukturierte Mitteilung) */
  message?: string;
  /** Rechnungsinformation (strukturiert, z. B. «//S1/10/10201409»); wird gemeinsam mit dem Zahlungszweck auf 140 Zeichen begrenzt */
  billInformation?: string;
};

export type QrBillIssue = { field: string; message: string };

export class QrBillError extends Error {
  constructor(public issues: QrBillIssue[]) {
    super(`QR-Rechnung ungültig: ${issues.map((i) => i.message).join(" ")}`);
    this.name = "QrBillError";
  }
}

// ---- Zeichensatz --------------------------------------------------------------------------------------------------

/**
 * Zulässige Zeichen in Textfeldern: konservative Teilmenge des Latin-Zeichensatzes der Spezifikation
 * (Basic Latin U+0020–U+007E und die Buchstaben von Latin-1: À–ÿ ohne × und ÷).
 * Was hier erlaubt ist, ist in der Spezifikation erlaubt. Seltene Sonderzeichen werden vorsichtshalber ersetzt (siehe toQrBillText).
 */
export function isQrBillChar(ch: string): boolean {
  const cp = ch.codePointAt(0);
  if (cp === undefined) return false;
  if (cp >= 0x20 && cp <= 0x7e) return true;
  if (cp >= 0xc0 && cp <= 0xff && cp !== 0xd7 && cp !== 0xf7) return true;
  return false;
}

/** Enthält der Text nur zulässige Zeichen (und keine Zeilenumbrüche)? */
export function isQrBillText(text: string): boolean {
  for (const ch of text) if (!isQrBillChar(ch)) return false;
  return true;
}

const TRANSLITERATION: Record<string, string> = {
  "‘": "'",
  "’": "'",
  "‚": ",",
  "“": '"',
  "”": '"',
  "„": '"',
  "«": '"',
  "»": '"',
  "‹": "'",
  "›": "'",
  "–": "-",
  "—": "-",
  "‐": "-",
  "−": "-",
  "…": "...",
  "€": "EUR",
  " ": " ",
  " ": " ",
  " ": " ",
  "ẞ": "SS",
  "Œ": "OE",
  "œ": "oe",
  "Ł": "L",
  "ł": "l",
  "Đ": "D",
  "đ": "d",
  "ı": "i",
};

/**
 * Macht einen beliebigen Text QR-Rechnungs-tauglich: ersetzt typografische Zeichen, entfernt Akzente ausserhalb von Latin-1,
 * wirft nicht darstellbare Zeichen weg, fasst Leerraum zusammen und kürzt auf `maxLength`.
 */
export function toQrBillText(input: string, maxLength = 140): string {
  let out = "";
  for (const ch of input) {
    if (isQrBillChar(ch)) {
      out += ch;
      continue;
    }
    const mapped = TRANSLITERATION[ch];
    if (mapped !== undefined) {
      out += mapped;
      continue;
    }
    if (/[\r\n\t  ]/.test(ch)) {
      out += " ";
      continue;
    }
    // Akzente/Buchstaben ausserhalb von Latin-1 (č → c): zerlegen und nur Basiszeichen behalten
    const base = ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
    for (const b of base) if (isQrBillChar(b)) out += b;
  }
  const trimmed = out.replace(/ {2,}/g, " ").trim();
  return [...trimmed].slice(0, maxLength).join("").trim();
}

// ---- Referenzen -----------------------------------------------------------------------------------------------------

const pad = (n: number, len: number) => String(n).padStart(len, "0");

/** Ziffernfolge der QR-Referenz einer Rechnung: Jahr (4) + laufende Nummer (8) = 12 Stellen, links bis 26 aufgefüllt. */
export function invoiceReferenceBase(year: number, seq: number): string {
  if (!Number.isInteger(year) || year < 1000 || year > 9999) throw new RangeError("Ungültiges Jahr.");
  if (!Number.isInteger(seq) || seq < 1 || seq > 99_999_999) throw new RangeError("Ungültige laufende Nummer.");
  return `${year}${pad(seq, 8)}`;
}

/** QR-Referenz (27 Stellen) einer Rechnung. */
export function buildInvoiceQrReference(year: number, seq: number): string {
  return buildQrReference(invoiceReferenceBase(year, seq));
}

/** Creditor Reference (RF…) einer Rechnung: «RF» + Prüfziffern + Jahr + laufende Nummer (mindestens 4 Stellen). */
export function buildInvoiceScorReference(year: number, seq: number): string {
  if (!Number.isInteger(year) || year < 1000 || year > 9999) throw new RangeError("Ungültiges Jahr.");
  if (!Number.isInteger(seq) || seq < 1 || seq > 99_999_999) throw new RangeError("Ungültige laufende Nummer.");
  return buildCreditorReference(`${year}${pad(seq, 4)}`);
}

/** Erkennt den Typ einer gespeicherten Referenz: QRR, SCOR oder null (unbekannt/ungültig). */
export function referenceTypeOf(reference: string): "QRR" | "SCOR" | null {
  const ref = reference.replace(/\s/g, "");
  if (isValidQrReference(ref)) return "QRR";
  if (isValidCreditorReference(ref)) return "SCOR";
  return null;
}

/** Liest Jahr und laufende Nummer aus einer von uns erzeugten Referenz (QRR oder SCOR); null bei fremden Referenzen. */
export function parseInvoiceReference(reference: string): { year: number; seq: number } | null {
  const ref = reference.replace(/\s/g, "").toUpperCase();
  const type = referenceTypeOf(ref);
  let digits: string;
  if (type === "QRR") digits = ref.slice(0, 26).replace(/^0+/, "");
  else if (type === "SCOR") digits = ref.slice(4);
  else return null;
  if (!/^\d{9,12}$/.test(digits)) return null;
  const year = Number(digits.slice(0, 4));
  const seq = Number(digits.slice(4));
  if (year < 1900 || year > 2999 || seq < 1) return null;
  if (type === "QRR" && digits.length !== 12) return null;
  return { year, seq };
}

// ---- Prüfung ------------------------------------------------------------------------------------------------------

function checkText(issues: QrBillIssue[], field: string, label: string, value: string | undefined, max: number, required = false): void {
  const v = value ?? "";
  if (required && v.trim() === "") {
    issues.push({ field, message: `${label} fehlt.` });
    return;
  }
  if ([...v].length > max) issues.push({ field, message: `${label} ist zu lang (höchstens ${max} Zeichen).` });
  if (v !== v.trim()) issues.push({ field, message: `${label} darf nicht mit Leerzeichen beginnen oder enden.` });
  if (!isQrBillText(v)) issues.push({ field, message: `${label} enthält Zeichen, die in der QR-Rechnung nicht erlaubt sind.` });
}

function checkAddress(issues: QrBillIssue[], prefix: "creditor" | "debtor", label: string, a: QrBillAddress): void {
  checkText(issues, `${prefix}.name`, `${label}: Name`, a.name, QR_BILL_LIMITS.name, true);
  checkText(issues, `${prefix}.street`, `${label}: Strasse`, a.street, QR_BILL_LIMITS.street);
  checkText(issues, `${prefix}.houseNo`, `${label}: Hausnummer`, a.houseNo, QR_BILL_LIMITS.houseNo);
  checkText(issues, `${prefix}.zip`, `${label}: Postleitzahl`, a.zip, QR_BILL_LIMITS.zip, true);
  checkText(issues, `${prefix}.town`, `${label}: Ort`, a.town, QR_BILL_LIMITS.town, true);
  if (!/^[A-Z]{2}$/.test(a.country)) issues.push({ field: `${prefix}.country`, message: `${label}: Land muss ein Ländercode mit zwei Grossbuchstaben sein (z. B. CH).` });
}

/** Prüft alle Angaben nach der Spezifikation. Leere Liste = gültig. */
export function validateQrBill(input: QrBillInput): QrBillIssue[] {
  const issues: QrBillIssue[] = [];
  const account = normalizeIban(input.account);
  const accountOk = isValidSwissIban(account);
  if (!accountOk) issues.push({ field: "account", message: "Die IBAN muss eine gültige Schweizer oder liechtensteinische IBAN sein (CH/LI, 21 Zeichen, korrekte Prüfziffer)." });

  checkAddress(issues, "creditor", "Zahlbar an", input.creditor);
  if (input.debtor) checkAddress(issues, "debtor", "Zahlbar durch", input.debtor);

  const currency = input.currency ?? "CHF";
  if (!QR_BILL_CURRENCIES.includes(currency)) issues.push({ field: "currency", message: "Die Währung muss CHF oder EUR sein." });

  if (input.amountRappen !== null && input.amountRappen !== undefined) {
    const a = input.amountRappen;
    if (!Number.isSafeInteger(a) || a < QR_BILL_LIMITS.minAmountRappen || a > QR_BILL_LIMITS.maxAmountRappen) {
      issues.push({ field: "amount", message: "Der Betrag muss zwischen 0.01 und 999999999.99 liegen." });
    }
  }

  const reference = (input.reference ?? "").replace(/\s/g, "");
  if (input.referenceType === "QRR") {
    if (accountOk && !isQrIban(account)) issues.push({ field: "referenceType", message: "Eine QR-Referenz braucht eine QR-IBAN (Institutskennung 30000–31999)." });
    if (!isValidQrReference(reference)) issues.push({ field: "reference", message: "Die QR-Referenz muss aus 27 Ziffern mit korrekter Prüfziffer bestehen." });
  } else if (input.referenceType === "SCOR") {
    if (accountOk && isQrIban(account)) issues.push({ field: "referenceType", message: "Mit einer QR-IBAN ist nur die QR-Referenz zulässig." });
    if (reference.length > QR_BILL_LIMITS.scor || !isValidCreditorReference(reference)) {
      issues.push({ field: "reference", message: "Die Creditor Reference muss mit «RF» beginnen, höchstens 25 Zeichen lang sein und eine korrekte Prüfziffer haben." });
    }
  } else if (input.referenceType === "NON") {
    if (accountOk && isQrIban(account)) issues.push({ field: "referenceType", message: "Mit einer QR-IBAN ist eine QR-Referenz zwingend." });
    if (reference !== "") issues.push({ field: "reference", message: "Ohne Referenztyp darf keine Referenz angegeben werden." });
  } else {
    issues.push({ field: "referenceType", message: "Unbekannter Referenztyp." });
  }

  checkText(issues, "message", "Zahlungszweck", input.message, QR_BILL_LIMITS.message);
  checkText(issues, "billInformation", "Rechnungsinformation", input.billInformation, QR_BILL_LIMITS.billInformation);
  if ([...(input.message ?? "")].length + [...(input.billInformation ?? "")].length > QR_BILL_LIMITS.messageAndBillInformation) {
    issues.push({ field: "message", message: "Zahlungszweck und Rechnungsinformation zusammen dürfen höchstens 140 Zeichen lang sein." });
  }
  return issues;
}

// ---- Payload ------------------------------------------------------------------------------------------------------

function addressLines(a: QrBillAddress | null | undefined): string[] {
  if (!a) return ["", "", "", "", "", "", ""];
  return ["S", a.name, a.street ?? "", a.houseNo ?? "", a.zip, a.town, a.country];
}

/** Baut den Inhalt des QR-Codes. Wirft QrBillError, wenn eine Angabe die Spezifikation verletzt. */
export function buildQrBillPayload(input: QrBillInput): string {
  const issues = validateQrBill(input);
  if (issues.length > 0) throw new QrBillError(issues);
  const reference = (input.reference ?? "").replace(/\s/g, "");
  const amount = input.amountRappen === null || input.amountRappen === undefined ? "" : toDecimalString(input.amountRappen);
  const lines = [
    QR_BILL_HEADER,
    QR_BILL_VERSION,
    QR_BILL_CODING,
    normalizeIban(input.account),
    ...addressLines(input.creditor),
    ...addressLines(null), // endgültiger Zahlungsempfänger: nicht verwenden
    amount,
    input.currency ?? "CHF",
    ...addressLines(input.debtor),
    input.referenceType,
    input.referenceType === "NON" ? "" : reference,
    input.message ?? "",
    QR_BILL_TRAILER,
  ];
  if (input.billInformation) lines.push(input.billInformation);
  const payload = lines.join("\n");
  if ([...payload].length > QR_BILL_MAX_PAYLOAD) throw new QrBillError([{ field: "payload", message: "Der QR-Code-Inhalt ist zu lang (höchstens 997 Zeichen)." }]);
  return payload;
}

/** Zerlegt eine Payload wieder in ihre Zeilen (Prüfung/Tests). */
export function splitQrBillPayload(payload: string): string[] {
  return payload.split(/\r?\n/);
}

// ---- Darstellung (Empfangsschein und Zahlteil) --------------------------------------------------------------------

export type QrBillDisplay = {
  /** «CH44 3199 9123 0008 8901 2» */
  account: string;
  creditorLines: string[];
  /** Referenz in Gruppen oder null (NON) */
  reference: string | null;
  message: string;
  billInformation: string;
  currency: QrBillCurrency;
  /** «1 234.50» (Leerzeichen als Tausendertrenner, wie auf dem Zahlteil üblich) oder null (offener Betrag) */
  amount: string | null;
  debtorLines: string[] | null;
};

/** Zeilen einer Adresse: Name, «Strasse Nr.», «PLZ Ort» (Land nur, wenn nicht CH/LI, mit Ländercode vor der PLZ). */
export function addressDisplayLines(a: QrBillAddress): string[] {
  const street = [a.street, a.houseNo].filter((p): p is string => Boolean(p && p.trim())).join(" ");
  const foreign = a.country !== "CH" && a.country !== "LI";
  const place = `${foreign ? `${a.country}-` : ""}${a.zip} ${a.town}`;
  return [a.name, street, place].filter((l) => l.trim() !== "");
}

/** Betrag für den Zahlteil: «1 234.50» (geschütztes Leerzeichen). */
export function formatSlipAmount(rappen: number): string {
  return formatChf(rappen).replace(/’/g, " ");
}

export function describeQrBill(input: QrBillInput): QrBillDisplay {
  const reference = (input.reference ?? "").replace(/\s/g, "");
  let shownReference: string | null = null;
  if (input.referenceType === "QRR") shownReference = formatQrReference(reference);
  else if (input.referenceType === "SCOR") shownReference = reference.replace(/(.{4})/g, "$1 ").trim();
  return {
    account: formatIban(input.account),
    creditorLines: addressDisplayLines(input.creditor),
    reference: shownReference,
    message: input.message ?? "",
    billInformation: input.billInformation ?? "",
    currency: input.currency ?? "CHF",
    amount: input.amountRappen === null || input.amountRappen === undefined ? null : formatSlipAmount(input.amountRappen),
    debtorLines: input.debtor ? addressDisplayLines(input.debtor) : null,
  };
}

// ---- Adressen aus Freitext ------------------------------------------------------------------------------------------

/** Trennt «Schützengasse 13» in Strasse und Hausnummer. Ohne erkennbare Nummer steht alles in der Strasse. */
export function splitStreet(line: string): { street: string; houseNo: string } {
  const t = line.trim().replace(/\s+/g, " ");
  const m = /^(.*?[^\d\s,])[\s,]+(\d+[a-zA-Z]?(?:\s?[-/]\s?\d+[a-zA-Z]?)?)$/.exec(t);
  if (m) return { street: m[1]!.trim(), houseNo: m[2]!.replace(/\s/g, "") };
  return { street: t, houseNo: "" };
}

/** Trennt «9410 Heiden» in PLZ und Ort; null, wenn kein Muster «PLZ Ort» erkennbar ist. */
export function splitZipTown(line: string): { zip: string; town: string } | null {
  const m = /^(?:[A-Z]{1,2}[- ])?(\d{3,10})\s+(.+)$/.exec(line.trim().replace(/\s+/g, " "));
  if (!m) return null;
  return { zip: m[1]!, town: m[2]!.trim() };
}

/**
 * Liest eine mehrzeilige Anschrift im Format der Rechnung (Zeile 1 Strasse und Nummer, Zeile 2 «PLZ Ort», optional Zeile 3 Ländercode)
 * als strukturierte Adresse. null, wenn die Anschrift unvollständig ist (dann entfällt der Zahlungspflichtige in der QR-Rechnung).
 */
export function parseAddressBlock(name: string, block: string): QrBillAddress | null {
  const lines = block
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return null;
  const zt = splitZipTown(lines[1]!);
  if (!zt) return null;
  const countryRaw = (lines[2] ?? "CH").toUpperCase();
  const country = /^[A-Z]{2}$/.test(countryRaw) ? countryRaw : "CH";
  const { street, houseNo } = splitStreet(lines[0]!);
  const address: QrBillAddress = {
    name: toQrBillText(name, QR_BILL_LIMITS.name),
    street: toQrBillText(street, QR_BILL_LIMITS.street),
    houseNo: toQrBillText(houseNo, QR_BILL_LIMITS.houseNo),
    zip: toQrBillText(zt.zip, QR_BILL_LIMITS.zip),
    town: toQrBillText(zt.town, QR_BILL_LIMITS.town),
    country,
  };
  return address.name && address.zip && address.town ? address : null;
}
