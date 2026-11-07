// IBAN- und Referenzprüfung für Schweizer Zahlungen (reine Funktionen).
//  - IBAN: Prüfsumme nach ISO 13616 (mod 97) und Länge je Land (IBAN-Register). Schweiz/Liechtenstein: «CH»/«LI» + 19 Stellen = 21 Zeichen.
//    Jede gültige IBAN ist als Konto des Vereins zulässig; die Schweizer QR-Rechnung gibt es aber nur mit CH/LI-IBAN.
//  - BIC/SWIFT: 8 oder 11 Zeichen (Bank, Land, Ort, optional Filiale).
//  - QR-IBAN: IBAN, deren Institutskennung (Stellen 5–9) im Bereich 30000–31999 liegt; sie wird nur mit QR-Referenz verwendet.
//  - QR-Referenz: 27 Ziffern, letzte Stelle = Prüfziffer nach Modulo 10, rekursiv.
//  - Creditor Reference (SCOR, ISO 11649): «RF» + 2 Prüfziffern + bis zu 21 Zeichen.

/** Grossbuchstaben, ohne Leerzeichen. */
export function normalizeIban(input: string): string {
  return input.replace(/[\s ]/g, "").toUpperCase();
}

/** In Vierergruppen: «CH93 0076 2011 6238 5295 7». */
export function formatIban(input: string): string {
  return normalizeIban(input).replace(/(.{4})/g, "$1 ").trim();
}

function mod97(numeric: string): number {
  let rest = 0;
  for (const ch of numeric) rest = (rest * 10 + Number(ch)) % 97;
  return rest;
}

/** Wandelt Buchstaben in Zahlen (A = 10 … Z = 35) für die Prüfsumme. */
function lettersToDigits(s: string): string {
  return [...s].map((c) => (/[A-Z]/.test(c) ? String(c.charCodeAt(0) - 55) : c)).join("");
}

/**
 * Länge der IBAN je Land (Gesamtzahl der Zeichen) nach dem IBAN-Register (SWIFT). Länder, die hier fehlen, werden mit der
 * allgemeinen Regel (15 bis 34 Zeichen) geprüft.
 */
export const IBAN_LENGTHS: Readonly<Record<string, number>> = {
  AD: 24, AE: 23, AL: 28, AT: 20, AZ: 28, BA: 20, BE: 16, BG: 22, BH: 22, BR: 29, BY: 28, CH: 21, CR: 22, CY: 28, CZ: 24, DE: 22,
  DK: 18, DO: 28, EE: 20, EG: 29, ES: 24, FI: 18, FO: 18, FR: 27, GB: 22, GE: 22, GI: 23, GL: 18, GR: 27, GT: 28, HR: 21, HU: 28,
  IE: 22, IL: 23, IQ: 23, IS: 26, IT: 27, JO: 30, KW: 30, KZ: 20, LB: 28, LC: 32, LI: 21, LT: 20, LU: 20, LV: 21, MC: 27, MD: 24,
  ME: 22, MK: 19, MR: 27, MT: 31, MU: 30, NL: 18, NO: 15, PK: 24, PL: 28, PS: 29, PT: 25, QA: 29, RO: 24, RS: 22, SA: 24, SC: 31,
  SE: 24, SI: 19, SK: 24, SM: 27, ST: 25, SV: 28, TL: 23, TN: 24, TR: 26, UA: 29, VA: 22, VG: 24, XK: 20,
};

/** Länderkürzel einer IBAN («IE»), leer, wenn die Eingabe nicht mit zwei Buchstaben beginnt. */
export function ibanCountryOf(input: string): string {
  const m = /^[A-Z]{2}/.exec(normalizeIban(input));
  return m ? m[0] : "";
}

/**
 * Warum ist die IBAN ungültig? Meldung oder null, wenn sie gültig ist (Format, Länge je Land, Prüfsumme).
 * Leerzeichen und Kleinschreibung werden toleriert.
 */
export function ibanProblem(input: string): string | null {
  const iban = normalizeIban(input);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(iban)) return "Das ist keine gültige IBAN: Sie beginnt mit dem Länderkürzel (z. B. CH oder IE), dann folgen zwei Prüfziffern und die Kontonummer.";
  const country = iban.slice(0, 2);
  const expected = IBAN_LENGTHS[country];
  if (expected !== undefined && iban.length !== expected) return `Eine IBAN aus ${country} hat ${expected} Zeichen, die Eingabe hat ${iban.length}.`;
  if (expected === undefined && (iban.length < 15 || iban.length > 34)) return "Eine IBAN hat 15 bis 34 Zeichen.";
  if (mod97(lettersToDigits(iban.slice(4) + iban.slice(0, 4))) !== 1) return "Die Prüfziffern stimmen nicht. Bitte prüfe die IBAN auf Tippfehler.";
  return null;
}

/** Gültige IBAN (Format, Länge je Land und Prüfsumme nach mod 97)? Für unbekannte Länder gilt 15 bis 34 Zeichen. */
export function isValidIban(input: string): boolean {
  return ibanProblem(input) === null;
}

/** Gültige Schweizer oder liechtensteinische IBAN (CH/LI, 21 Zeichen)? */
export function isValidSwissIban(input: string): boolean {
  const iban = normalizeIban(input);
  return /^(CH|LI)\d{2}[A-Z0-9]{17}$/.test(iban) && isValidIban(iban);
}

/** Gültige IBAN eines anderen Landes als CH/LI (keine Schweizer QR-Rechnung möglich)? */
export function isForeignIban(input: string): boolean {
  const iban = normalizeIban(input);
  return isValidIban(iban) && !isValidSwissIban(iban);
}

/** BIC/SWIFT ohne Leerzeichen, Grossbuchstaben. */
export function normalizeBic(input: string): string {
  return input.replace(/[\s ]/g, "").toUpperCase();
}

/** Gültiger BIC/SWIFT: 4 Buchstaben (Bank), 2 Buchstaben (Land), 2 Zeichen (Ort), optional 3 Zeichen (Filiale): 8 oder 11 Zeichen. */
export function isValidBic(input: string): boolean {
  return /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?$/.test(normalizeBic(input));
}

/** Art eines Kontos für Rechnungen. */
export type IbanKind = "SWISS" | "QR" | "FOREIGN";

/** Art der IBAN: Schweizer/liechtensteinische IBAN, QR-IBAN, ausländische IBAN; null, wenn ungültig. */
export function ibanKindOf(input: string): IbanKind | null {
  const iban = normalizeIban(input);
  if (!isValidIban(iban)) return null;
  if (!isValidSwissIban(iban)) return "FOREIGN";
  return isQrIban(iban) ? "QR" : "SWISS";
}

/** Rückmeldung zur Eingabe einer IBAN (Formular, Live-Anzeige). Dieselbe Prüfung wie auf dem Server. */
export type IbanFeedback = { state: "empty" } | { state: "invalid"; message: string } | { state: "valid"; kind: IbanKind; country: string; label: string; formatted: string };

export function describeIban(input: string): IbanFeedback {
  const iban = normalizeIban(input);
  if (iban === "") return { state: "empty" };
  const problem = ibanProblem(iban);
  if (problem) return { state: "invalid", message: problem };
  const kind = ibanKindOf(iban)!;
  const country = ibanCountryOf(iban);
  const label =
    kind === "FOREIGN"
      ? `Ausländische IBAN (${country}) – keine Schweizer QR-Rechnung möglich`
      : kind === "QR"
        ? "QR-IBAN"
        : country === "LI"
          ? "Liechtensteinische IBAN (LI)"
          : "Schweizer IBAN";
  return { state: "valid", kind, country, label, formatted: formatIban(iban) };
}

/** QR-IBAN: Schweizer IBAN mit Institutskennung 30000–31999. */
export function isQrIban(input: string): boolean {
  const iban = normalizeIban(input);
  if (!isValidSwissIban(iban)) return false;
  const iid = Number(iban.slice(4, 9));
  return Number.isInteger(iid) && iid >= 30000 && iid <= 31999;
}

const MOD10_TABLE = [0, 9, 4, 6, 8, 2, 7, 1, 3, 5];

/** Prüfziffer (Modulo 10, rekursiv) zu einer Ziffernfolge. */
export function mod10Recursive(digits: string): number {
  if (!/^\d+$/.test(digits)) throw new RangeError("Nur Ziffern erlaubt.");
  let carry = 0;
  for (const d of digits) carry = MOD10_TABLE[(carry + Number(d)) % 10]!;
  return (10 - carry) % 10;
}

/** Baut eine QR-Referenz (27 Ziffern) aus einem Ziffern-Grundstück von höchstens 26 Stellen (links mit Nullen aufgefüllt). */
export function buildQrReference(base: string): string {
  const digits = base.replace(/\s/g, "");
  if (!/^\d{1,26}$/.test(digits)) throw new RangeError("Die Referenzbasis muss aus 1 bis 26 Ziffern bestehen.");
  const padded = digits.padStart(26, "0");
  return padded + String(mod10Recursive(padded));
}

/** Gültige QR-Referenz (27 Ziffern mit korrekter Prüfziffer)? Leerzeichen werden ignoriert. */
export function isValidQrReference(input: string): boolean {
  const ref = input.replace(/\s/g, "");
  if (!/^\d{27}$/.test(ref)) return false;
  return mod10Recursive(ref.slice(0, 26)) === Number(ref[26]);
}

/** Darstellung in Fünfergruppen von rechts: «21 00000 00003 13947 14300 09017». */
export function formatQrReference(input: string): string {
  const ref = input.replace(/\s/g, "");
  const head = ref.slice(0, 2);
  const rest = ref.slice(2).match(/.{1,5}/g) ?? [];
  return [head, ...rest].join(" ").trim();
}

/** Creditor Reference (ISO 11649): «RF» + Prüfziffern + Referenz (nur A–Z, 0–9). */
export function buildCreditorReference(reference: string): string {
  const ref = reference.replace(/\s/g, "").toUpperCase();
  if (!/^[A-Z0-9]{1,21}$/.test(ref)) throw new RangeError("Die Referenz darf 1 bis 21 Zeichen (A–Z, 0–9) lang sein.");
  const check = 98 - mod97(lettersToDigits(`${ref}RF00`));
  return `RF${String(check).padStart(2, "0")}${ref}`;
}

export function isValidCreditorReference(input: string): boolean {
  const ref = input.replace(/\s/g, "").toUpperCase();
  if (!/^RF\d{2}[A-Z0-9]{1,21}$/.test(ref)) return false;
  return mod97(lettersToDigits(ref.slice(4) + ref.slice(0, 4))) === 1;
}
