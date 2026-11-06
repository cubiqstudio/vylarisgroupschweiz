// CSV-Zeilen der Kasse (rein). Texte laufen später durch csv.ts (Schutz vor Formel-Injektion), Beträge nur über csvMoney.
import { csvMoney, type CsvCell } from "./csv";
import { TRANSACTION_DIRECTION_LABEL, TRANSACTION_SOURCE_LABEL, ACCOUNT_KIND_LABEL, type TransactionDirection, type TransactionSource } from "./constants";
import { entrySign, type AnnualStatement, type BudgetComparison } from "./ledger-lib";

export type ExportTransaction = {
  bookingDate: Date;
  fiscalYear: number;
  voucherNo: string;
  direction: string;
  amountRappen: number;
  text: string;
  voucherRef: string;
  source: string;
  reversalOfVoucherNo: string;
  category: { number: string; name: string };
  counterAccount: { number: string; name: string } | null;
  receiptCount: number;
  createdByName: string;
};

export const TRANSACTION_CSV_HEADERS = [
  "Datum",
  "Geschäftsjahr",
  "Beleg-Nr.",
  "Art",
  "Konto Nr.",
  "Konto",
  "Gegenkonto Nr.",
  "Gegenkonto",
  "Text",
  "Beleg-Referenz",
  "Betrag CHF",
  "Quelle",
  "Storno zu",
  "Belege",
  "Erfasst von",
] as const;

/** Gegenbuchungen erscheinen mit negativem Betrag, damit die Spaltensumme stimmt. */
export function transactionCsvRows(rows: readonly ExportTransaction[]): CsvCell[][] {
  return rows.map((t) => [
    t.bookingDate,
    t.fiscalYear,
    t.voucherNo,
    TRANSACTION_DIRECTION_LABEL[t.direction as TransactionDirection] ?? t.direction,
    t.category.number,
    t.category.name,
    t.counterAccount?.number ?? "",
    t.counterAccount?.name ?? "",
    t.text,
    t.voucherRef,
    csvMoney(t.amountRappen * entrySign({ reversal: t.source === "STORNO" })),
    TRANSACTION_SOURCE_LABEL[t.source as TransactionSource] ?? t.source,
    t.reversalOfVoucherNo,
    t.receiptCount,
    t.createdByName,
  ]);
}

export const ANNUAL_CSV_HEADERS = ["Bereich", "Konto Nr.", "Konto", "Anfang CHF", "Veränderung CHF", "Betrag CHF"] as const;

/** Jahresrechnung als Tabelle: Einnahmen, Ausgaben, Ergebnis, Vermögen (Anfang, Veränderung, Ende). */
export function annualCsvRows(s: AnnualStatement): CsvCell[][] {
  const rows: CsvCell[][] = [];
  for (const r of s.income) rows.push([ACCOUNT_KIND_LABEL.EINNAHMEN, r.account.number, r.account.name, "", "", csvMoney(r.amountRappen)]);
  rows.push(["Einnahmen total", "", "", "", "", csvMoney(s.totalIncomeRappen)]);
  for (const r of s.expense) rows.push([ACCOUNT_KIND_LABEL.AUSGABEN, r.account.number, r.account.name, "", "", csvMoney(r.amountRappen)]);
  rows.push(["Ausgaben total", "", "", "", "", csvMoney(s.totalExpenseRappen)]);
  rows.push([s.resultRappen >= 0 ? "Ertragsüberschuss" : "Aufwandüberschuss", "", "", "", "", csvMoney(s.resultRappen)]);
  for (const r of s.assets) rows.push([ACCOUNT_KIND_LABEL.VERMOEGEN, r.account.number, r.account.name, csvMoney(r.startRappen), csvMoney(r.changeRappen), csvMoney(r.endRappen)]);
  rows.push(["Vermögen total", "", "", csvMoney(s.assetStartRappen), csvMoney(s.assetChangeRappen), csvMoney(s.assetEndRappen)]);
  return rows;
}

export const BUDGET_CSV_HEADERS = ["Bereich", "Konto Nr.", "Konto", "Budget CHF", "Ist CHF", "Differenz CHF"] as const;

export function budgetCsvRows(b: BudgetComparison): CsvCell[][] {
  const one = (label: string, rows: BudgetComparison["income"]): CsvCell[][] =>
    rows.map((r) => [label, r.account.number, r.account.name, r.budgetRappen === null ? "" : csvMoney(r.budgetRappen), csvMoney(r.actualRappen), r.diffRappen === null ? "" : csvMoney(r.diffRappen)]);
  return [...one(ACCOUNT_KIND_LABEL.EINNAHMEN, b.income), ...one(ACCOUNT_KIND_LABEL.AUSGABEN, b.expense)];
}

/** Dateiname ohne Endung, z. B. «Kassen-Buchungen-2026». */
export const ledgerExportName = (what: string, year: number | null): string => (year ? `Kassen-${what}-${year}` : `Kassen-${what}`);
