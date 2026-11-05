import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PILL } from "@/components/admin/core/styles";
import { PageTitle } from "@/components/admin/core/page-title";
import { Notice } from "@/components/admin/core/notice";
import { EmptyState } from "@/components/admin/licenses/empty-state";
import { FiscalYearActions } from "@/components/admin/ledger/fiscal-year-actions";
import { LedgerNav } from "@/components/admin/ledger/ledger-nav";
import { Amount, TableWrap, TD, TDR, TH, THR } from "@/components/admin/ledger/ledger-ui";
import { cn } from "@/lib/utils";
import { TONE_CLASS } from "@/lib/verein/constants";
import { formatDateCh, toDateInputValue, todayZurich } from "@/lib/verein/dates";
import { requireModulePage } from "@/lib/verein/guard";
import { getFiscalStart, listFiscalYears } from "@/lib/verein/ledger-data";
import { canCloseFiscalYear, fiscalYearLabel, lockBlockReason, unlockBlockReason } from "@/lib/verein/ledger-lib";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Geschäftsjahre" };

export default async function FiscalYearsPage() {
  const admin = await requireModulePage("ledger");
  const canClose = canCloseFiscalYear(admin.roles);
  const [years, fiscal] = await Promise.all([listFiscalYears(), getFiscalStart()]);
  const today = todayZurich();
  const withBookings = years.filter((y) => y.bookingCount > 0 || y.locked).map((y) => y.year);

  return (
    <div>
      <PageTitle title="Geschäftsjahre" description="Abschliessen sperrt ein Jahr: Buchungen lassen sich dann nicht mehr ändern, Korrekturen erfolgen mit einer Gegenbuchung im offenen Jahr." />
      <LedgerNav />
      <Notice variant="info" className="mb-6">
        Abschliessen, Wiedereröffnen und den Genehmigungsvermerk dürfen der Kassier und der Präsident. Jede Aktion steht im Änderungsprotokoll. Wann und von wem die Jahresrechnung zu genehmigen ist, regeln die Statuten.
        {(fiscal.month !== 1 || fiscal.day !== 1) && ` Das Geschäftsjahr beginnt am ${fiscal.day}.${fiscal.month}.`}
      </Notice>

      {years.length === 0 ? (
        <EmptyState icon={CalendarCheck} title="Noch keine Geschäftsjahre" text="Sobald Buchungen erfasst sind, erscheinen die Geschäftsjahre hier." />
      ) : (
        <Card className="overflow-hidden">
          <TableWrap label="Geschäftsjahre">
            <table className="w-full min-w-[56rem] text-left text-sm">
              <caption className="sr-only">Geschäftsjahre mit Ergebnis, Vermögen und Abschlussstatus</caption>
              <thead className="border-b border-zinc-800">
                <tr>
                  <th scope="col" className={TH}>Jahr</th>
                  <th scope="col" className={TH}>Zeitraum</th>
                  <th scope="col" className={THR}>Buchungen</th>
                  <th scope="col" className={THR}>Ergebnis CHF</th>
                  <th scope="col" className={THR}>Vermögen Ende CHF</th>
                  <th scope="col" className={TH}>Status</th>
                  <th scope="col" className={THR}><span className="sr-only">Aktionen</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {years.map((y) => {
                  const label = fiscalYearLabel(y.year, fiscal);
                  const lockBlock = lockBlockReason({ year: y.year, fiscal, today, alreadyLocked: y.locked, earlierOpenYears: withBookings.filter((w) => w < y.year && !years.find((o) => o.year === w)?.locked) });
                  const unlockBlock = unlockBlockReason({ year: y.year, locked: y.locked, laterLockedYears: years.filter((o) => o.locked && o.year > y.year).map((o) => o.year) });
                  return (
                    <tr key={y.year} className="hover:bg-zinc-900/40">
                      <td className={cn(TD, "font-medium text-white")}>
                        <Link href={`/admin/ledger/reports?year=${y.year}`} className="hover:text-emerald-400">
                          {label}
                        </Link>
                      </td>
                      <td className={cn(TD, "whitespace-nowrap tabular-nums text-zinc-400")}>
                        {formatDateCh(y.startsOn)} bis {formatDateCh(y.endsOn)}
                      </td>
                      <td className={cn(TDR, "text-zinc-300")}>{y.bookingCount}</td>
                      <td className={TDR}>
                        <Amount rappen={y.resultRappen} signed />
                      </td>
                      <td className={cn(TDR, "text-zinc-300")}>
                        <Amount rappen={y.assetEndRappen} />
                      </td>
                      <td className={TD}>
                        <div className="flex flex-wrap gap-1">
                          <span className={cn(PILL, y.locked ? TONE_CLASS.indigo : TONE_CLASS.green)}>{y.locked ? "Abgeschlossen" : "Offen"}</span>
                          {y.approvedAt && <span className={cn(PILL, TONE_CLASS.sky)}>Genehmigt {formatDateCh(y.approvedAt)}</span>}
                        </div>
                        {y.locked && y.lockedAt && (
                          <p className="mt-1 text-xs text-zinc-500">
                            {formatDateCh(y.lockedAt)}
                            {y.lockedByName ? `, ${y.lockedByName}` : ""}
                          </p>
                        )}
                        {y.note && <p className="mt-1 text-xs text-zinc-500">{y.note}</p>}
                        {!y.locked && y.unbookedPayments > 0 && (
                          <p className="mt-1 text-xs text-amber-300">
                            {y.unbookedPayments === 1 ? "1 Zahlung" : `${y.unbookedPayments} Zahlungen`} nicht gebucht
                          </p>
                        )}
                      </td>
                      <td className={cn(TD, "text-right")}>
                        <FiscalYearActions
                          year={y.year}
                          label={label}
                          locked={y.locked}
                          approved={y.approvedAt !== null}
                          canClose={canClose}
                          unbookedPayments={y.unbookedPayments}
                          lockBlock={lockBlock}
                          unlockBlock={unlockBlock}
                          today={toDateInputValue(today)}
                        />
                        {!y.locked && lockBlock && canClose && <p className="mt-1 max-w-64 text-right text-xs text-zinc-500">{lockBlock}</p>}
                        {y.locked && unlockBlock && canClose && <p className="mt-1 max-w-64 text-right text-xs text-zinc-500">{unlockBlock}</p>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        </Card>
      )}
    </div>
  );
}
