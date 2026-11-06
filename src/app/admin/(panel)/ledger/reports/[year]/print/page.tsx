import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PrintButton } from "@/components/admin/ledger/print-button";
import { PrintStyles } from "@/components/admin/ledger/print-styles";
import { MonthChart } from "@/components/admin/ledger/month-chart";
import { ACCOUNTING_NOTE, AssetTable, MonthTable, ResultLine, ResultTables } from "@/components/admin/ledger/statement-tables";
import { site } from "@/lib/site";
import { formatChf } from "@/lib/verein/money";
import { formatDateCh, formatDateTimeCh } from "@/lib/verein/dates";
import { requireModulePage } from "@/lib/verein/guard";
import { getAnnualReport, listTransactionsForExport } from "@/lib/verein/ledger-data";
import { entrySign, fiscalYearLabel } from "@/lib/verein/ledger-lib";
import { yearSchema } from "@/lib/verein/ledger-schemas";
import { TRANSACTION_DIRECTION_LABEL, type TransactionDirection } from "@/lib/verein/constants";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Kassenbericht" };

type Props = { params: Promise<{ year: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const LINE = "mt-10 border-t border-black pt-1 text-[10px] text-zinc-600";

/** Kassenbericht für ein Geschäftsjahr, gestaltet für A4 (Hochformat) mit Raum für das Visum der Revisoren. */
export default async function KassenberichtPage({ params, searchParams }: Props) {
  await requireModulePage("ledger");
  const parsed = yearSchema.safeParse((await params).year);
  if (!parsed.success) notFound();
  const year = parsed.data;
  const sp = await searchParams;
  const journal = (Array.isArray(sp.journal) ? sp.journal[0] : sp.journal) === "1";
  const report = await getAnnualReport(year);
  const { fiscal, info, statement, months } = report;
  const label = fiscalYearLabel(year, fiscal);
  const rows = journal ? await listTransactionsForExport({ q: "", year, direction: "", source: "", accountId: "", noReceipt: false }, 3000) : [];

  return (
    <div>
      <PrintStyles />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/admin/ledger/reports?year=${year}`} className="inline-flex h-10 items-center gap-2 rounded-md px-4 text-sm font-semibold text-zinc-300 hover:bg-zinc-900 hover:text-white">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Zurück zu den Auswertungen
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/admin/ledger/reports/${year}/print${journal ? "" : "?journal=1"}`} className="inline-flex h-10 items-center rounded-md px-4 text-sm font-semibold text-zinc-300 ring-1 ring-inset ring-zinc-600 hover:bg-zinc-900">
            {journal ? "Ohne Buchungsjournal" : "Mit Buchungsjournal"}
          </Link>
          <PrintButton />
        </div>
      </div>

      <article className="ledger-sheet mx-auto w-full max-w-[210mm] bg-white p-[12mm] text-[12px] leading-snug text-black shadow-xl shadow-black/40 print:max-w-none print:p-0 print:shadow-none" aria-label={`Kassenbericht ${label}`}>
        <header className="mb-6 border-b-2 border-black pb-3">
          <p className="text-[11px] uppercase tracking-widest text-zinc-600">{site.name}</p>
          <h1 className="mt-1 text-2xl font-semibold">Kassenbericht {label}</h1>
          <p className="mt-1 text-[11px] text-zinc-700">
            Geschäftsjahr vom {formatDateCh(info.startsOn)} bis {formatDateCh(info.endsOn)} · Stand {formatDateTimeCh(new Date())}
          </p>
          <p className="mt-1 text-[11px] font-medium">{info.locked ? `Abgeschlossen${info.lockedAt ? ` am ${formatDateCh(info.lockedAt)}` : ""}${info.approvedAt ? ` · Genehmigung vermerkt am ${formatDateCh(info.approvedAt)}` : ""}` : "Geschäftsjahr noch offen: vorläufige Zahlen"}</p>
        </header>

        <section className="mb-6" aria-label="Zusammenfassung">
          <dl className="grid grid-cols-4 gap-3 text-center">
            {[
              ["Einnahmen", statement.totalIncomeRappen],
              ["Ausgaben", statement.totalExpenseRappen],
              [statement.resultRappen >= 0 ? "Ertragsüberschuss" : "Aufwandüberschuss", statement.resultRappen],
              ["Vermögen am Ende", statement.assetEndRappen],
            ].map(([k, v]) => (
              <div key={String(k)} className="border border-black px-2 py-2">
                <dt className="text-[10px] uppercase tracking-wide text-zinc-600">{k}</dt>
                <dd className="mt-0.5 text-base font-semibold tabular-nums">CHF {formatChf(v as number)}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mb-6" aria-label="Erfolgsrechnung">
          <ResultTables s={statement} variant="print" />
          <div className="mt-3">
            <ResultLine s={statement} variant="print" />
          </div>
        </section>

        <section className="mb-6 break-inside-avoid" aria-label="Vermögensübersicht">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide">Vermögensübersicht</h2>
          <AssetTable s={statement} variant="print" />
        </section>

        {report.bookingCount > 0 && (
          <section className="mb-6 break-inside-avoid" aria-label="Monatsbilanz">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide">Monatsbilanz</h2>
            <MonthChart months={months} print />
            <div className="mt-2">
              <MonthTable months={months} variant="print" />
            </div>
          </section>
        )}

        <section className="mb-6 break-inside-avoid" aria-label="Prüfung und Visum">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide">Prüfung und Visum</h2>
          <p className="mb-2 text-[11px] text-zinc-700">Bemerkungen der Revisorinnen und Revisoren:</p>
          <div className="h-24 border border-black" aria-hidden />
          <div className="grid grid-cols-3 gap-8">
            <p className={LINE}>Ort, Datum</p>
            <p className={LINE}>Kassier/in (Name, Unterschrift)</p>
            <p className={LINE}>Revisor/in (Name, Visum)</p>
          </div>
          <div className="grid grid-cols-3 gap-8">
            <p className={LINE}>Ort, Datum</p>
            <p className={LINE}>Präsident/in (Name, Unterschrift)</p>
            <p className={LINE}>Revisor/in (Name, Visum)</p>
          </div>
        </section>

        <p className="text-[10px] leading-relaxed text-zinc-600">{ACCOUNTING_NOTE}</p>

        {journal && (
          <section className="mt-8 break-before-page" aria-label="Buchungsjournal">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide">Buchungsjournal {label}</h2>
            {rows.length === 0 ? (
              <p className="text-[11px]">Keine Buchungen.</p>
            ) : (
              <table className="w-full text-left text-[10px]">
                <caption className="sr-only">Alle Buchungen des Geschäftsjahres in zeitlicher Reihenfolge</caption>
                <thead className="border-b border-black uppercase tracking-wide text-zinc-600">
                  <tr>
                    <th scope="col" className="py-1 pr-2 font-medium">Datum</th>
                    <th scope="col" className="py-1 pr-2 font-medium">Beleg</th>
                    <th scope="col" className="py-1 pr-2 font-medium">Text</th>
                    <th scope="col" className="py-1 pr-2 font-medium">Konto</th>
                    <th scope="col" className="py-1 pr-2 font-medium">Art</th>
                    <th scope="col" className="py-1 text-right font-medium">CHF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-300">
                  {rows.map((r, i) => (
                    <tr key={`${r.voucherNo}-${i}`} className="break-inside-avoid">
                      <td className="py-1 pr-2 tabular-nums">{formatDateCh(r.bookingDate)}</td>
                      <td className="py-1 pr-2">{r.voucherNo}</td>
                      <td className="py-1 pr-2">
                        {r.text}
                        {r.voucherRef ? ` (Ref. ${r.voucherRef})` : ""}
                        {r.receiptCount === 0 && r.source === "MANUELL" ? " · ohne Beleg" : ""}
                      </td>
                      <td className="py-1 pr-2">{r.category.number} {r.category.name}{r.counterAccount ? ` / ${r.counterAccount.number}` : ""}</td>
                      <td className="py-1 pr-2">{TRANSACTION_DIRECTION_LABEL[r.direction as TransactionDirection] ?? r.direction}{r.source === "STORNO" ? " (Storno)" : ""}</td>
                      <td className="py-1 text-right tabular-nums">{formatChf(r.amountRappen * entrySign({ reversal: r.source === "STORNO" }))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}
      </article>
    </div>
  );
}
