// Zahlungsabgleich per CSV (rein, ohne Datenbank): liest eine Liste mit Referenz und Betrag (z. B. aus dem E-Banking) und ordnet
// die Zeilen anhand der Referenz den Rechnungen zu. Die Datei wird nie ausgeführt, nur gelesen; Zellen werden als Text behandelt.
import { parseDateOnly } from "./dates";
import { parseChf } from "./money";
import { parseInvoiceReference } from "./qr-bill";

export const IMPORT_MAX_ROWS = 2000;
export const IMPORT_MAX_CHARS = 1_000_000;

export type ImportRow = {
  /** Zeilennummer in der Datei (Kopfzeile = 1) */
  line: number;
  reference: string;
  amountRappen: number | null;
  date: Date | null;
  text: string;
  /** Fehler beim Lesen dieser Zeile (leer = lesbar) */
  error: string;
};

/** Trennzeichen erkennen: Semikolon, Tabulator oder Komma (nach Häufigkeit in der Kopfzeile). */
export function detectDelimiter(headerLine: string): ";" | "\t" | "," {
  const counts: Array<[";" | "\t" | ",", number]> = [
    [";", (headerLine.match(/;/g) ?? []).length],
    ["\t", (headerLine.match(/\t/g) ?? []).length],
    [",", (headerLine.match(/,/g) ?? []).length],
  ];
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0]![1] > 0 ? counts[0]![0] : ";";
}

/** Zerlegt CSV-Text in Zeilen und Zellen (Anführungszeichen mit Verdoppelung, Zeilenumbruch in Zellen). */
export function parseCsvRows(input: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const text = input.replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
const REF_HEADERS = ["referenz", "zahlungsreferenz", "reference", "referenznummer", "esr", "qrreferenz", "referenzNummer"].map(norm);
const AMOUNT_HEADERS = ["betrag", "amount", "gutschrift", "betragchf", "chf", "kredit", "credit"].map(norm);
const DATE_HEADERS = ["datum", "valuta", "buchungsdatum", "date", "valutadatum", "gutschriftsdatum"].map(norm);
const TEXT_HEADERS = ["text", "buchungstext", "mitteilung", "verwendungszweck", "zahlungszweck", "details", "beschreibung", "notiz"].map(norm);

function columnIndex(headers: string[], names: string[]): number {
  const h = headers.map(norm);
  for (const n of names) {
    const i = h.indexOf(n);
    if (i >= 0) return i;
  }
  return -1;
}

export type ParsedImport = { rows: ImportRow[]; error: string | null };

/**
 * Liest eine Zahlungsliste. Erwartet eine Kopfzeile mit mindestens den Spalten «Referenz» und «Betrag»;
 * optional «Datum» (Valuta) und «Text». Lesbare Zeilen haben einen positiven Betrag (Gutschrift).
 */
export function parseBankCsv(input: string): ParsedImport {
  if (input.length > IMPORT_MAX_CHARS) return { rows: [], error: "Die Datei ist zu gross (höchstens 1 MB)." };
  const firstLine = input.replace(/^﻿/, "").split(/\r?\n/, 1)[0] ?? "";
  const all = parseCsvRows(input, detectDelimiter(firstLine));
  if (all.length < 2) return { rows: [], error: "Die Datei enthält keine Zahlungen. Erwartet wird eine Kopfzeile und mindestens eine Zeile." };
  if (all.length - 1 > IMPORT_MAX_ROWS) return { rows: [], error: `Zu viele Zeilen (höchstens ${IMPORT_MAX_ROWS}).` };
  const headers = all[0]!;
  const ref = columnIndex(headers, REF_HEADERS);
  const amount = columnIndex(headers, AMOUNT_HEADERS);
  const date = columnIndex(headers, DATE_HEADERS);
  const text = columnIndex(headers, TEXT_HEADERS);
  if (ref < 0 || amount < 0) return { rows: [], error: "Die Kopfzeile braucht die Spalten «Referenz» und «Betrag» (optional «Datum» und «Text»)." };

  const rows: ImportRow[] = all.slice(1).map((cells, i) => {
    const line = i + 2;
    const reference = (cells[ref] ?? "").replace(/\s/g, "").slice(0, 60);
    const rawAmount = (cells[amount] ?? "").trim();
    const parsedAmount = rawAmount === "" ? null : parseChf(rawAmount);
    const rawDate = date >= 0 ? (cells[date] ?? "").trim() : "";
    const parsedDate = rawDate ? parseDateOnly(rawDate.slice(0, 10)) : null;
    let error = "";
    if (parsedAmount === null) error = "Betrag nicht lesbar.";
    else if (parsedAmount <= 0) error = "Keine Gutschrift (Betrag nicht positiv).";
    else if (rawDate && !parsedDate) error = "Datum nicht lesbar (erwartet 5.11.2026 oder 2026-11-05).";
    return { line, reference, amountRappen: parsedAmount, date: parsedDate, text: text >= 0 ? (cells[text] ?? "").trim().slice(0, 200) : "", error };
  });
  return { rows, error: null };
}

// ---- Zuordnung ------------------------------------------------------------------------------------------------------

export type MatchInvoice = { id: string; number: string; year: number; seq: number; status: string; totalRappen: number; paidRappen: number; paymentReference: string; memberName: string };

export type MatchResult =
  | { kind: "MATCH"; invoice: MatchInvoice; amountRappen: number; note: string }
  | { kind: "NO_REFERENCE" | "UNKNOWN" | "NOT_PAYABLE" | "INVALID" | "DUPLICATE"; message: string };

/** Findet die Rechnung zu einer Referenz: zuerst die gespeicherte Referenz, dann Jahr/Nummer aus einer von uns erzeugten Referenz, zuletzt die Rechnungsnummer im Text. */
export function findInvoiceForReference(reference: string, text: string, byReference: ReadonlyMap<string, MatchInvoice>, byKey: ReadonlyMap<string, MatchInvoice>): MatchInvoice | null {
  const ref = reference.replace(/\s/g, "").toUpperCase();
  if (ref) {
    const hit = byReference.get(ref);
    if (hit) return hit;
    const parsed = parseInvoiceReference(ref);
    if (parsed) {
      const viaKey = byKey.get(`${parsed.year}-${parsed.seq}`);
      if (viaKey) return viaKey;
    }
  }
  const num = /\b(\d{4})-(\d{4,})\b/.exec(text);
  if (num) return byKey.get(`${Number(num[1])}-${Number(num[2])}`) ?? null;
  return null;
}

/** Ordnet eine gelesene Zeile einer Rechnung zu und beurteilt, ob die Zahlung gebucht werden kann. */
export function matchRow(
  row: ImportRow,
  byReference: ReadonlyMap<string, MatchInvoice>,
  byKey: ReadonlyMap<string, MatchInvoice>,
  isDuplicate: (invoiceId: string, row: ImportRow) => boolean,
): MatchResult {
  if (row.error || row.amountRappen === null) return { kind: "INVALID", message: row.error || "Zeile nicht lesbar." };
  if (!row.reference && !/\b\d{4}-\d{4,}\b/.test(row.text)) return { kind: "NO_REFERENCE", message: "Keine Referenz angegeben." };
  const invoice = findInvoiceForReference(row.reference, row.text, byReference, byKey);
  if (!invoice) return { kind: "UNKNOWN", message: "Keine Rechnung zu dieser Referenz gefunden." };
  if (invoice.status !== "OFFEN" && invoice.status !== "BEZAHLT") {
    return { kind: "NOT_PAYABLE", message: invoice.status === "ENTWURF" ? "Die Rechnung ist noch ein Entwurf." : "Die Rechnung ist storniert." };
  }
  if (isDuplicate(invoice.id, row)) return { kind: "DUPLICATE", message: "Diese Zahlung ist bereits erfasst (gleiche Rechnung, Betrag und Datum)." };
  const open = Math.max(0, invoice.totalRappen - invoice.paidRappen);
  let note = "Deckt den offenen Betrag.";
  if (invoice.status === "BEZAHLT" || open === 0) note = "Rechnung ist schon bezahlt: wäre eine Überzahlung.";
  else if (row.amountRappen < open) note = "Teilzahlung.";
  else if (row.amountRappen > open) note = "Überzahlung.";
  return { kind: "MATCH", invoice, amountRappen: row.amountRappen, note };
}
