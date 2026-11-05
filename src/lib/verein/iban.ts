// IBAN- und Referenzprüfung für Schweizer Zahlungen (reine Funktionen).
//  - IBAN: Prüfsumme nach ISO 13616 (mod 97). Schweiz/Liechtenstein: «CH»/«LI» + 19 Stellen = 21 Zeichen.
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

/** Gültige IBAN (Format und Prüfsumme)? Ohne Länderprüfung, ausser dass die Länge 15–34 betragen muss. */
export function isValidIban(input: string): boolean {
  const iban = normalizeIban(input);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  return mod97(lettersToDigits(iban.slice(4) + iban.slice(0, 4))) === 1;
}

/** Gültige Schweizer oder liechtensteinische IBAN (CH/LI, 21 Zeichen)? */
export function isValidSwissIban(input: string): boolean {
  const iban = normalizeIban(input);
  return /^(CH|LI)\d{2}[A-Z0-9]{17}$/.test(iban) && isValidIban(iban);
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
