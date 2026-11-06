// Geldbeträge: Die Datenbank speichert Integer in Rappen (CHF 12.50 = 1250). Es wird nie mit Fliesskommazahlen gerechnet.
// Anzeige: 1’234.50 (Schweizer Format, typografischer Apostroph als Tausendertrenner). Eingabe: «1'234.50», «1234,5», «CHF 12» u. ä.

/** Typografischer Apostroph als Tausendertrenner. */
export const THOUSANDS_SEPARATOR = "’";

/** Grösster zulässiger Betrag in Rappen (CHF 20’000’000.00): passt in eine 32-Bit-Ganzzahl der Datenbank (PostgreSQL) und schützt vor Tippfehlern. */
export const MAX_RAPPEN = 2_000_000_000;

/** Ist der Wert ein sicherer Rappen-Betrag (ganze Zahl, höchstens MAX_RAPPEN)? */
export function isRappen(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && Math.abs(value) <= MAX_RAPPEN;
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, THOUSANDS_SEPARATOR);
}

/** «1’234.50» (immer zwei Nachkommastellen). Negative Beträge mit «-» davor. */
export function formatChf(rappen: number): string {
  if (!Number.isSafeInteger(rappen)) throw new RangeError("Rappen muss eine ganze Zahl sein.");
  const negative = rappen < 0;
  const abs = Math.abs(rappen);
  const francs = Math.trunc(abs / 100);
  const cents = abs % 100;
  return `${negative ? "-" : ""}${groupThousands(String(francs))}.${String(cents).padStart(2, "0")}`;
}

/** «CHF 1’234.50» */
export function formatChfWithCurrency(rappen: number): string {
  return `CHF ${formatChf(rappen)}`;
}

/** «1234.50» ohne Tausendertrenner: für CSV, QR-Rechnung und Maschinenformate. */
export function toDecimalString(rappen: number): string {
  if (!Number.isSafeInteger(rappen)) throw new RangeError("Rappen muss eine ganze Zahl sein.");
  const negative = rappen < 0;
  const abs = Math.abs(rappen);
  return `${negative ? "-" : ""}${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/**
 * Liest einen vom Menschen eingegebenen Betrag in Rappen. Erlaubt: «1234», «1234.5», «1234,50», «1'234.50», «1’234.50», «1 234,50»,
 * «CHF 12.–», «Fr. 12.50», «-5.00». Liefert null, wenn der Betrag nicht eindeutig lesbar ist (mehr als zwei Nachkommastellen,
 * mehrdeutiger Punkt wie «1.234», Buchstaben) oder MAX_RAPPEN übersteigt.
 */
export function parseChf(input: string): number | null {
  let s = input.normalize("NFKC").trim();
  if (s === "") return null;
  s = s.replace(/^(?:CHF|Fr\.?|SFr\.?)\s*/i, "").replace(/\s*(?:CHF|Fr\.?)$/i, "");
  let negative = false;
  if (/^[-−]/.test(s)) {
    negative = true;
    s = s.slice(1).trim();
  }
  s = s.replace(/[.,]\s*[-–—]+$/, ""); // «12.–» / «12.-»
  s = s.replace(/['’‘´`\s ]/g, ""); // Tausendertrenner und Leerzeichen
  if (!/^[\d.,]+$/.test(s)) return null;

  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  let intPart: string;
  let fracPart = "";
  if (lastDot >= 0 && lastComma >= 0) {
    // Beide Zeichen: das letzte ist das Dezimalzeichen, das andere trennt Tausender.
    const decimalAt = Math.max(lastDot, lastComma);
    const thousandsChar = lastDot > lastComma ? "," : ".";
    intPart = s.slice(0, decimalAt);
    fracPart = s.slice(decimalAt + 1);
    if (intPart.includes(s[decimalAt]!)) return null;
    if (!isGrouped(intPart, thousandsChar)) return null;
    intPart = intPart.split(thousandsChar).join("");
  } else if (lastDot >= 0 || lastComma >= 0) {
    const ch = lastDot >= 0 ? "." : ",";
    const parts = s.split(ch);
    if (parts.length > 2) {
      // «1.234.567»: nur als Tausendergruppen zulässig
      if (!isGrouped(s, ch)) return null;
      intPart = parts.join("");
    } else {
      intPart = parts[0]!;
      fracPart = parts[1]!;
      // «1.234» ist mehrdeutig (Tausender oder Dezimal): ablehnen
      if (fracPart.length === 3) return null;
    }
  } else {
    intPart = s;
  }
  if (intPart === "") intPart = "0";
  if (!/^\d+$/.test(intPart) || (fracPart !== "" && !/^\d{1,2}$/.test(fracPart))) return null;
  if (intPart.length > 12) return null;
  const rappen = Number(intPart) * 100 + Number(fracPart.padEnd(2, "0") || "0");
  if (!Number.isSafeInteger(rappen) || rappen > MAX_RAPPEN) return null;
  return negative ? -rappen : rappen;
}

/** «1.234.567» bzw. «1,234,567»: erste Gruppe 1–3 Ziffern, danach jeweils genau 3. */
function isGrouped(value: string, sep: string): boolean {
  const groups = value.split(sep);
  if (groups.length === 1) return /^\d+$/.test(value);
  return /^\d{1,3}$/.test(groups[0]!) && groups.slice(1).every((g) => /^\d{3}$/.test(g));
}

/** Rundet auf 5 Rappen (Schweizer Rundung, halbe Werte nach oben; negativ symmetrisch). */
export function roundToFiveRappen(rappen: number): number {
  const sign = rappen < 0 ? -1 : 1;
  return sign * Math.floor((Math.abs(rappen) + 2.5) / 5) * 5;
}

/** Summe von Rappen-Beträgen. */
export const sumRappen = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0);

/** Menge × Einzelpreis in Rappen. */
export function lineTotal(quantity: number, unitRappen: number): number {
  if (!Number.isInteger(quantity) || !Number.isInteger(unitRappen)) throw new RangeError("Menge und Preis müssen ganze Zahlen sein.");
  return quantity * unitRappen;
}

/**
 * Anteiliger Jahresbeitrag für `months` volle Monate (0–12), auf ganze Rappen kaufmännisch gerundet (halbe Werte nach oben).
 * Ob und wie unterjährig anteilig abgerechnet wird, bestimmen die Statuten bzw. der Vorstand.
 */
export function prorateAnnual(annualRappen: number, months: number): number {
  if (!Number.isInteger(months) || months < 0 || months > 12) throw new RangeError("Monate müssen zwischen 0 und 12 liegen.");
  if (!Number.isSafeInteger(annualRappen)) throw new RangeError("Rappen muss eine ganze Zahl sein.");
  return Math.floor((annualRappen * months * 2 + 12) / 24);
}

/** Noch offener Betrag einer Rechnung (nie negativ). */
export const openAmount = (totalRappen: number, paidRappen: number): number => Math.max(0, totalRappen - paidRappen);
