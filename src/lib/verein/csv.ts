// CSV-Export für Excel in der Schweiz: Semikolon als Trennzeichen, UTF-8 mit BOM, CRLF (RFC 4180: Felder mit Trennzeichen,
// Anführungszeichen oder Zeilenumbruch stehen in "…", Anführungszeichen werden verdoppelt).
//
// Schutz vor Formel-Injektion: Texte, die mit = + - @ (oder Tabulator / Wagenrücklauf) beginnen, würden in Excel/Calc als Formel
// ausgeführt. Sie werden mit einem vorangestellten ' neutralisiert. Zahlen dürfen nur über csvNumber/csvMoney laufen (geprüft, kein Text).
import { formatDateCh, formatDateTimeCh } from "./dates";
import { toDecimalString } from "./money";

export const CSV_SEPARATOR = ";";
export const CSV_BOM = "﻿";

/** Bereits geprüfter Zahlenwert (z. B. «1234.50»); wird nicht neutralisiert. */
export type CsvNumber = { readonly csvNumber: string };
export type CsvCell = string | number | boolean | Date | null | undefined | CsvNumber;

/** Zahl für CSV: nur endliche Zahlen, mit Punkt als Dezimalzeichen. */
export function csvNumber(value: number): CsvNumber {
  if (!Number.isFinite(value)) throw new RangeError("CSV: Zahl ist nicht endlich.");
  return { csvNumber: String(value) };
}

/** Rappen als Betrag «1234.50» (ohne Tausendertrenner, damit Excel ihn als Zahl liest). */
export function csvMoney(rappen: number): CsvNumber {
  return { csvNumber: toDecimalString(rappen) };
}

const FORMULA_START = /^[=+\-@\t\r]/;

/** Neutralisiert Formel-Auslöser am Zellanfang mit einem vorangestellten '. */
export function neutralizeFormula(text: string): string {
  return FORMULA_START.test(text) ? `'${text}` : text;
}

function isCsvNumber(v: unknown): v is CsvNumber {
  return typeof v === "object" && v !== null && "csvNumber" in v && typeof (v as CsvNumber).csvNumber === "string";
}

/** Eine Zelle als sicherer Feldtext (mit Anführungszeichen, wenn nötig). */
export function csvField(cell: CsvCell): string {
  let text: string;
  if (cell === null || cell === undefined) text = "";
  else if (typeof cell === "string") text = neutralizeFormula(cell);
  else if (typeof cell === "number") text = Number.isFinite(cell) ? String(cell) : "";
  else if (typeof cell === "boolean") text = cell ? "Ja" : "Nein";
  else if (cell instanceof Date) text = Number.isNaN(cell.getTime()) ? "" : formatDateCh(cell);
  else if (isCsvNumber(cell)) text = /^-?\d+(\.\d+)?$/.test(cell.csvNumber) ? cell.csvNumber : "";
  else text = "";
  if (/[";\r\n]/.test(text) || /^\s|\s$/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

/** Zeitpunkt als Zelle («5.11.2026, 19:30 Uhr»). */
export const csvDateTime = (d: Date): string => formatDateTimeCh(d);

/** Vollständiger CSV-Text mit BOM, Kopfzeile und CRLF. */
export function toCsv(headers: readonly string[], rows: ReadonlyArray<readonly CsvCell[]>): string {
  const lines = [headers.map((h) => csvField(h)).join(CSV_SEPARATOR), ...rows.map((r) => r.map(csvField).join(CSV_SEPARATOR))];
  return CSV_BOM + lines.join("\r\n") + "\r\n";
}

/** Dateiname für den Download: nur Buchstaben, Ziffern, Punkt, Bindestrich, Unterstrich. */
export function safeDownloadName(name: string, fallback = "export"): string {
  const base = name
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/Ä/g, "Ae")
    .replace(/Ö/g, "Oe")
    .replace(/Ü/g, "Ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "_")
    .replace(/^[._]+|_+$/g, "")
    .slice(0, 100);
  return base || fallback;
}

/** Download-Antwort für einen CSV-Export (nie cachen, Typ nicht erraten lassen). Der Dateiname bekommt ".csv", falls es fehlt. */
export function csvResponse(fileName: string, headers: readonly string[], rows: ReadonlyArray<readonly CsvCell[]>): Response {
  const name = safeDownloadName(fileName.replace(/\.csv$/i, "")) + ".csv";
  return new Response(toCsv(headers, rows), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
