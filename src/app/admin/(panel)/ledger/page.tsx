import type { Metadata } from "next";
import Link from "next/link";
import { Download, Paperclip, Plus, Search, Wallet } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { PageTitle } from "@/components/admin/core/page-title";
import { Notice } from "@/components/admin/core/notice";
import { EmptyState } from "@/components/admin/licenses/empty-state";
import { Pager } from "@/components/admin/licenses/pager";
import { LedgerNav } from "@/components/admin/ledger/ledger-nav";
import { Amount, DirectionPill, Stat, StatePill, TableWrap, TD, TDR, TH, THR } from "@/components/admin/ledger/ledger-ui";
import { TRANSACTION_DIRECTIONS, TRANSACTION_DIRECTION_LABEL, TRANSACTION_SOURCES, TRANSACTION_SOURCE_LABEL } from "@/lib/verein/constants";
import { formatDateCh } from "@/lib/verein/dates";
import { requireModulePage } from "@/lib/verein/guard";
import { cashEffect, fiscalYearLabel } from "@/lib/verein/ledger-lib";
import { currentFiscalYear, filterTotals, getAnnualStatementOnly, getFiscalStart, getFiscalYearInfo, knownYears, listAccountsWithUsage, listTransactions } from "@/lib/verein/ledger-data";
import { parseLedgerFilters } from "@/lib/verein/ledger-schemas";
import { formatChf } from "@/lib/verein/money";
import { listHref, listParams, pageMeta } from "@/lib/verein/pagination";
import { canAccess } from "@/lib/verein/permissions";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Kassa" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function LedgerPage({ searchParams }: Props) {
  const admin = await requireModulePage("ledger");
  const canWrite = canAccess(admin.roles, "ledger", "write");
  const sp = await searchParams;
  const current = await currentFiscalYear();
  const filters = parseLedgerFilters(sp, current);
  const { page, pageSize } = listParams(sp);
  const fiscal = await getFiscalStart();

  const first = await listTransactions(filters, (page - 1) * pageSize, pageSize);
  const meta = pageMeta(first.total, page, pageSize);
  const [rows, totals, accounts, { years }, statement, info] = await Promise.all([
    meta.page === page ? first.rows : listTransactions(filters, (meta.page - 1) * pageSize, pageSize).then((r) => r.rows),
    filterTotals(filters),
    listAccountsWithUsage(),
    knownYears(),
    getAnnualStatementOnly(filters.year ?? current),
    filters.year !== null ? getFiscalYearInfo(filters.year, fiscal) : Promise.resolve(null),
  ]);

  const yearParam = filters.year === null ? "alle" : String(filters.year);
  const base = { q: filters.q, year: yearParam === String(current) ? "" : yearParam, direction: filters.direction, source: filters.source, account: filters.accountId, noReceipt: filters.noReceipt ? "1" : "" };
  const href = (p: number) => listHref("/admin/ledger", { ...base, page: p });
  const exportHref = listHref("/api/admin/ledger/export", { what: "buchungen", q: filters.q, year: yearParam, direction: filters.direction, source: filters.source, account: filters.accountId, noReceipt: base.noReceipt });
  const filtered = Boolean(filters.q || filters.direction || filters.source || filters.accountId || filters.noReceipt || (filters.year !== null && filters.year !== current) || filters.year === null);
  const hasAccounts = accounts.length > 0;
  const assetAccounts = statement.assets;

  return (
    <div>
      <PageTitle title="Kassa" description="Einfache Buchhaltung des Vereins: Einnahmen, Ausgaben und Vermögen. Fehlerhafte Buchungen werden storniert statt gelöscht.">
        <a href={exportHref} className={buttonClass("secondary", "md")} download>
          <Download className="h-4 w-4" aria-hidden />
          CSV-Export
          <span className="sr-only"> der aktuellen Auswahl</span>
        </a>
        {canWrite && (
          <Link href="/admin/ledger/new" className={buttonClass("primary", "md")}>
            <Plus className="h-4 w-4" aria-hidden />
            Neue Buchung
          </Link>
        )}
      </PageTitle>

      <LedgerNav />

      {!hasAccounts && (
        <Notice variant="warning" className="mb-6">
          <span className="font-medium">Es sind noch keine Konten angelegt.</span> Bevor du buchen kannst, braucht die Kassa Einnahmen- und Ausgabenkonten sowie ein Vermögenskonto (Bank, Kasse).{" "}
          <Link href="/admin/ledger/accounts" className="font-medium underline underline-offset-2">
            {canWrite ? "Standardkonten anlegen" : "Zu den Konten"}
          </Link>
        </Notice>
      )}

      <form method="get" action="/admin/ledger" role="search" className="mb-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_9rem_10rem_12rem_auto]">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <label htmlFor="ledger-q" className="sr-only">
            Buchungen durchsuchen
          </label>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden />
          <Input id="ledger-q" name="q" type="search" defaultValue={filters.q} maxLength={100} placeholder="Text, Beleg-Nr., Referenz oder Betrag" className="pl-9" />
        </div>
        <div>
          <label htmlFor="ledger-year" className="sr-only">
            Geschäftsjahr
          </label>
          <Select id="ledger-year" name="year" defaultValue={yearParam}>
            <option value="alle">Alle Jahre</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {fiscalYearLabel(y, fiscal)}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="ledger-direction" className="sr-only">
            Art
          </label>
          <Select id="ledger-direction" name="direction" defaultValue={filters.direction}>
            <option value="">Alle Arten</option>
            {TRANSACTION_DIRECTIONS.map((d) => (
              <option key={d} value={d}>
                {TRANSACTION_DIRECTION_LABEL[d]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="ledger-account" className="sr-only">
            Konto
          </label>
          <Select id="ledger-account" name="account" defaultValue={filters.accountId}>
            <option value="">Alle Konten</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.number} {a.name}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="secondary">
          Filtern
        </Button>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:col-span-2 lg:col-span-5">
          <div className="w-44">
            <label htmlFor="ledger-source" className="sr-only">
              Quelle
            </label>
            <Select id="ledger-source" name="source" defaultValue={filters.source} className="h-9">
              <option value="">Alle Quellen</option>
              {TRANSACTION_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {TRANSACTION_SOURCE_LABEL[s]}
                </option>
              ))}
            </Select>
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-zinc-300">
            <input type="checkbox" name="noReceipt" value="1" defaultChecked={filters.noReceipt} className="h-4 w-4 rounded border-zinc-600" />
            Nur Buchungen ohne Beleg
          </label>
          {filtered && (
            <Link href="/admin/ledger" className={buttonClass("ghost", "sm")}>
              Zurücksetzen
            </Link>
          )}
        </div>
      </form>

      {info?.locked && (
        <Notice variant="info" className="mb-6">
          Das Geschäftsjahr {fiscalYearLabel(info.year, fiscal)} ist abgeschlossen{info.lockedAt ? ` (${formatDateCh(info.lockedAt)})` : ""}. Buchungen können nicht mehr geändert, aber mit einer Gegenbuchung im offenen Jahr korrigiert werden.
        </Notice>
      )}

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Einnahmen" hint={filtered ? "in dieser Auswahl" : undefined}>
          <span className="text-emerald-400">CHF {formatChf(totals.incomeRappen)}</span>
        </Stat>
        <Stat label="Ausgaben" hint={filtered ? "in dieser Auswahl" : undefined}>
          <span className="text-rose-400">CHF {formatChf(totals.expenseRappen)}</span>
        </Stat>
        <Stat label="Ergebnis" hint={filtered ? "in dieser Auswahl" : undefined}>
          CHF {formatChf(totals.resultRappen)}
        </Stat>
      </div>

      {assetAccounts.length > 0 && (
        <section aria-labelledby="assets-h" className="mb-6">
          <h2 id="assets-h" className="mb-2 text-sm font-semibold text-zinc-300">
            Bestände am Ende von {fiscalYearLabel(filters.year ?? current, fiscal)}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {assetAccounts.map((a) => (
              <li key={a.account.id} className="rounded-xl border border-zinc-800 bg-surface px-4 py-3">
                <p className="truncate text-xs text-zinc-500">
                  {a.account.number} {a.account.name}
                </p>
                <p className={cn("text-lg font-semibold tabular-nums", a.endRappen < 0 ? "text-rose-400" : "text-white")}>CHF {formatChf(a.endRappen)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title={filtered ? "Keine passenden Buchungen" : "Noch keine Buchungen"}
          text={filtered ? "Zu diesen Filtern gibt es keine Einträge. Passe die Auswahl an oder setze sie zurück." : canWrite ? "Erfasse die erste Einnahme oder Ausgabe. Zahlungseingänge aus den Beiträgen erscheinen hier automatisch, sobald sie gebucht sind." : "Sobald der Kassier Buchungen erfasst, erscheinen sie hier."}
        />
      ) : (
        <>
          <Card className="overflow-hidden">
            <TableWrap label="Buchungen">
              <table className="w-full text-left text-sm md:min-w-[52rem]">
                <caption className="sr-only">Buchungen, neueste zuerst</caption>
                <thead className="border-b border-zinc-800">
                  <tr>
                    <th scope="col" className={TH}>
                      Datum
                    </th>
                    <th scope="col" className={TH}>
                      Beleg
                    </th>
                    <th scope="col" className={TH}>
                      Buchung
                    </th>
                    <th scope="col" className={cn(TH, "hidden md:table-cell")}>
                      Konto
                    </th>
                    <th scope="col" className={cn(THR, "hidden md:table-cell")}>
                      CHF
                    </th>
                    <th scope="col" className={cn(TH, "hidden md:table-cell")}>
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {rows.map((t) => {
                    const effect = cashEffect({ direction: t.direction, amountRappen: t.amountRappen, reversal: t.reversalOfId !== null });
                    return (
                      <tr key={t.id} className={cn("hover:bg-zinc-900/40", t.state === "STORNIERT" && "text-zinc-500")}>
                        <td className={cn(TD, "whitespace-nowrap tabular-nums text-zinc-400")}>{formatDateCh(t.bookingDate)}</td>
                        <td className={cn(TD, "whitespace-nowrap")}>
                          <Link href={`/admin/ledger/${t.id}`} className="font-medium text-white hover:text-emerald-400">
                            {t.voucherNo || "–"}
                          </Link>
                        </td>
                        <td className={TD}>
                          <div className="flex items-start gap-1.5">
                            <span className={cn("min-w-0 break-words", t.state === "STORNIERT" && "line-through")}>{t.text}</span>
                            {t._count.receipts > 0 && (
                              <span title={`${t._count.receipts} Beleg${t._count.receipts === 1 ? "" : "e"}`} className="mt-0.5 shrink-0 text-zinc-500">
                                <Paperclip className="h-3.5 w-3.5" aria-hidden />
                                <span className="sr-only">{t._count.receipts} Beleg(e) angehängt</span>
                              </span>
                            )}
                          </div>
                          {t.voucherRef && <div className="text-xs text-zinc-500">Ref. {t.voucherRef}</div>}
                          {/* Mobil: Konto, Betrag und Status stehen unter dem Buchungstext (die Spalten sind dort ausgeblendet) */}
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400 md:hidden">
                            <span>
                              {t.category.number} {t.category.name}
                            </span>
                            <span className="font-medium tabular-nums text-zinc-200">
                              CHF {t.direction === "UMBUCHUNG" ? formatChf(t.amountRappen) : formatChf(effect)}
                            </span>
                            {t.state !== "AKTIV" && <StatePill state={t.state} />}
                          </div>
                        </td>
                        <td className={cn(TD, "hidden text-zinc-400 md:table-cell")}>
                          <div>
                            {t.category.number} {t.category.name}
                          </div>
                          {t.counterAccount && (
                            <div className="text-xs text-zinc-500">
                              {t.direction === "UMBUCHUNG" ? "nach" : "über"} {t.counterAccount.number} {t.counterAccount.name}
                            </div>
                          )}
                        </td>
                        <td className={cn(TDR, "hidden md:table-cell")}>
                          {t.direction === "UMBUCHUNG" ? <span className="text-zinc-400">{formatChf(t.amountRappen)}</span> : <Amount rappen={effect} signed />}
                        </td>
                        <td className={cn(TD, "hidden md:table-cell")}>
                          <div className="flex flex-wrap gap-1">
                            {t.direction === "UMBUCHUNG" && <DirectionPill direction={t.direction} />}
                            <StatePill state={t.state} />
                            {t.source === "ZAHLUNG" && <span className="text-xs text-zinc-500">Zahlungseingang</span>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableWrap>
          </Card>
          <Pager page={meta.page} totalPages={meta.totalPages} from={meta.from} to={meta.to} total={meta.total} noun="Buchung" nounPlural="Buchungen" hrefFor={href} />
        </>
      )}
    </div>
  );
}
