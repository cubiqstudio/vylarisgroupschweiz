import { handle, requireAdmin } from "@/lib/api";
import { db } from "@/lib/db";
import { auditActor, logAudit } from "@/lib/verein/audit";
import { csvResponse } from "@/lib/verein/csv";
import { currentFiscalYear, getAnnualReport, listTransactionsForExport } from "@/lib/verein/ledger-data";
import { ANNUAL_CSV_HEADERS, annualCsvRows, BUDGET_CSV_HEADERS, budgetCsvRows, ledgerExportName, TRANSACTION_CSV_HEADERS, transactionCsvRows } from "@/lib/verein/ledger-export";
import { parseLedgerFilters, parseYearParam } from "@/lib/verein/ledger-schemas";
import { firstParam } from "@/lib/verein/pagination";

export const dynamic = "force-dynamic";

/**
 * CSV-Export (Semikolon, Excel): ?what=buchungen (mit den Filtern der Liste) | jahresrechnung | budget, dazu ?year=.
 * Jeder Export steht im Änderungsprotokoll.
 */
export const GET = handle(async (req: Request) => {
  const admin = await requireAdmin(req);
  const sp = new URL(req.url).searchParams;
  const what = firstParam(sp, "what") || "buchungen";
  const current = await currentFiscalYear();

  if (what === "jahresrechnung" || what === "budget") {
    const year = parseYearParam(sp, current);
    const report = await getAnnualReport(year);
    await logAudit(db, { actor: auditActor(admin), action: "export.ledger", objectType: "Transaction", summary: `Kassa-Export ${what} ${year}`, after: { art: what, jahr: year } });
    if (what === "budget") return csvResponse(ledgerExportName("Budget", year), BUDGET_CSV_HEADERS, budgetCsvRows(report.budget));
    return csvResponse(ledgerExportName("Jahresrechnung", year), ANNUAL_CSV_HEADERS, annualCsvRows(report.statement));
  }

  const filters = parseLedgerFilters(sp, current);
  const rows = await listTransactionsForExport(filters);
  await logAudit(db, {
    actor: auditActor(admin),
    action: "export.ledger",
    objectType: "Transaction",
    summary: `Kassa-Export Buchungen (${rows.length} ${rows.length === 1 ? "Eintrag" : "Einträge"})`,
    after: { art: "buchungen", jahr: filters.year ?? "alle", anzahl: rows.length, suche: filters.q ? "ja" : "nein" },
  });
  return csvResponse(ledgerExportName("Buchungen", filters.year), TRANSACTION_CSV_HEADERS, transactionCsvRows(rows));
});
