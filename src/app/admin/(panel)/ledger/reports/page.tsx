import type { Metadata } from "next";
import Link from "next/link";
import { Download, Printer } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageTitle } from "@/components/admin/core/page-title";
import { Notice } from "@/components/admin/core/notice";
import { LedgerNav } from "@/components/admin/ledger/ledger-nav";
import { MonthChart } from "@/components/admin/ledger/month-chart";
import { ACCOUNTING_NOTE, AssetTable, MonthTable, ResultLine, ResultTables } from "@/components/admin/ledger/statement-tables";
import { Stat } from "@/components/admin/ledger/ledger-ui";
import { YearPicker } from "@/components/admin/ledger/year-picker";
import { formatDateCh } from "@/lib/verein/dates";
import { requireModulePage } from "@/lib/verein/guard";
import { currentFiscalYear, getAnnualReport, knownYears } from "@/lib/verein/ledger-data";
import { fiscalYearLabel } from "@/lib/verein/ledger-lib";
import { parseYearParam } from "@/lib/verein/ledger-schemas";
import { formatChf } from "@/lib/verein/money";
import { listHref } from "@/lib/verein/pagination";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Auswertungen der Kassa" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ReportsPage({ searchParams }: Props) {
  await requireModulePage("ledger");
  const sp = await searchParams;
  const current = await currentFiscalYear();
  const year = parseYearParam(sp, current);
  const [report, { years }] = await Promise.all([getAnnualReport(year), knownYears()]);
  const { fiscal, info, statement, months } = report;
  const label = fiscalYearLabel(year, fiscal);
  const choices = years.includes(year) ? years : [year, ...years].sort((a, b) => b - a);
  const csv = (what: string) => listHref("/api/admin/ledger/export", { what, year });

  return (
    <div>
      <PageTitle title="Auswertungen" description={`Jahresrechnung, Monatsbilanz und Kassabericht für das Geschäftsjahr ${label} (${formatDateCh(info.startsOn)} bis ${formatDateCh(info.endsOn)}).`}>
        <Link href={`/admin/ledger/reports/${year}/print`} className={buttonClass("primary", "md")}>
          <Printer className="h-4 w-4" aria-hidden />
          Kassabericht drucken
        </Link>
      </PageTitle>
      <LedgerNav />
      <YearPicker action="/admin/ledger/reports" years={choices} selected={year} fiscal={fiscal} />

      {info.locked ? (
        <Notice variant="info" className="mb-6">
          Abgeschlossen{info.lockedAt ? ` am ${formatDateCh(info.lockedAt)}` : ""}
          {info.lockedByName ? ` von ${info.lockedByName}` : ""}.{info.approvedAt ? ` Genehmigung vermerkt am ${formatDateCh(info.approvedAt)}.` : ""}
        </Notice>
      ) : (
        <Notice variant="warning" className="mb-6">
          Dieses Geschäftsjahr ist noch offen. Die Zahlen sind vorläufig, bis es unter «Geschäftsjahre» abgeschlossen wird.
        </Notice>
      )}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Einnahmen">
          <span className="text-emerald-400">CHF {formatChf(statement.totalIncomeRappen)}</span>
        </Stat>
        <Stat label="Ausgaben">
          <span className="text-rose-400">CHF {formatChf(statement.totalExpenseRappen)}</span>
        </Stat>
        <Stat label="Ergebnis">CHF {formatChf(statement.resultRappen)}</Stat>
        <Stat label="Vermögen am Ende" hint={`Anfang: CHF ${formatChf(statement.assetStartRappen)}`}>
          CHF {formatChf(statement.assetEndRappen)}
        </Stat>
      </div>

      <div className="mb-8 flex flex-wrap gap-2">
        <a href={csv("jahresrechnung")} download className={buttonClass("secondary", "sm")}>
          <Download className="h-4 w-4" aria-hidden />
          Jahresrechnung (CSV)
        </a>
        <a href={listHref("/api/admin/ledger/export", { what: "buchungen", year })} download className={buttonClass("secondary", "sm")}>
          <Download className="h-4 w-4" aria-hidden />
          Alle Buchungen (CSV)
        </a>
        <a href={csv("budget")} download className={buttonClass("secondary", "sm")}>
          <Download className="h-4 w-4" aria-hidden />
          Budgetvergleich (CSV)
        </a>
      </div>

      <section aria-labelledby="rep-result" className="mb-10 space-y-4">
        <h2 id="rep-result" className="text-lg font-semibold text-white">
          Jahresrechnung {label}
        </h2>
        <ResultTables s={statement} />
        <ResultLine s={statement} />
      </section>

      <section aria-labelledby="rep-assets" className="mb-10 space-y-3">
        <h2 id="rep-assets" className="text-lg font-semibold text-white">
          Vermögensübersicht
        </h2>
        <Card className="overflow-hidden">
          <AssetTable s={statement} />
        </Card>
      </section>

      <section aria-labelledby="rep-months" className="mb-10 space-y-4">
        <h2 id="rep-months" className="text-lg font-semibold text-white">
          Monatsbilanz
        </h2>
        {report.bookingCount === 0 ? <p className="text-sm text-zinc-400">In diesem Geschäftsjahr gibt es noch keine Buchungen.</p> : <Card className="p-4 sm:p-5"><MonthChart months={months} /></Card>}
        <Card className="overflow-hidden">
          <MonthTable months={months} />
        </Card>
      </section>

      {report.receiptMissingCount > 0 && (
        <Notice variant="warning" className="mb-6">
          {report.receiptMissingCount === 1 ? "Eine manuelle Buchung hat" : `${report.receiptMissingCount} manuelle Buchungen haben`} keinen Beleg.{" "}
          <Link href={listHref("/admin/ledger", { year, source: "MANUELL", noReceipt: "1" })} className="font-medium underline underline-offset-2">
            Anzeigen
          </Link>
        </Notice>
      )}

      <p className="text-xs leading-relaxed text-zinc-500">{ACCOUNTING_NOTE}</p>
    </div>
  );
}
