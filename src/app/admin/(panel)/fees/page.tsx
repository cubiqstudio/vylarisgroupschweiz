import type { Metadata } from "next";
import Link from "next/link";
import { Download, FileText, Plus, Search, Wallet } from "lucide-react";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";
import { Button, buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { PageTitle } from "@/components/admin/core/page-title";
import { StatCard } from "@/components/admin/core/stat-card";
import { EmptyState } from "@/components/admin/licenses/empty-state";
import { Pager } from "@/components/admin/licenses/pager";
import { InvoiceTable, type InvoiceRowDTO } from "@/components/admin/fees/invoice-table";
import { NewPaymentButton } from "@/components/admin/fees/new-payment-button";
import { PaymentImport } from "@/components/admin/fees/payment-import";
import { PaymentRowActions } from "@/components/admin/fees/payment-row-actions";
import { PeriodManager, type PeriodDTO } from "@/components/admin/fees/period-manager";
import { ReminderTable, type ReminderRowDTO } from "@/components/admin/fees/reminder-table";
import { Chf, MissingSettingsNotice, TD, TH, TableWrap } from "@/components/admin/fees/shared";
import { Notice } from "@/components/admin/core/notice";
import { INVOICE_STATUS_LABEL, INVOICE_STATUSES, PAYMENT_METHOD_LABEL, type PaymentMethod } from "@/lib/verein/constants";
import { formatDateCh, todayZurich, yearOf } from "@/lib/verein/dates";
import { INVOICE_FILTER_OVERDUE, listInvoices } from "@/lib/verein/fees-data";
import { AGING_BUCKETS, daysOverdue } from "@/lib/verein/fees-calc";
import { getFeeKpis, getOpenItems, listFeeTypes, listPayments, listPeriods, listReminderRows } from "@/lib/verein/fees-ops";
import { requireModulePage } from "@/lib/verein/guard";
import { listBookingAccounts } from "@/lib/verein/ledger-link";
import { formatChf, openAmount } from "@/lib/verein/money";
import { listParams, listHref, pageMeta } from "@/lib/verein/pagination";
import { canAccess } from "@/lib/verein/permissions";
import { getVereinSettings, missingForInvoicing, missingForReminders } from "@/lib/verein/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Beiträge" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const TABS = [
  { id: "rechnungen", label: "Rechnungen" },
  { id: "jahre", label: "Beitragsjahre" },
  { id: "zahlungen", label: "Zahlungen" },
  { id: "mahnungen", label: "Mahnwesen" },
  { id: "offene", label: "Offene Posten" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const first = (v: string | string[] | undefined): string => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function AdminFeesPage({ searchParams }: Props) {
  const admin = await requireModulePage("fees");
  const sp = await searchParams;
  const rawTab = first(sp.tab);
  const tab: TabId = TABS.some((t) => t.id === rawTab) ? (rawTab as TabId) : "rechnungen";
  const canWrite = canAccess(admin.roles, "fees", "write");
  const canEditSettings = canAccess(admin.roles, "finance_settings", "read");
  const settings = await getVereinSettings();
  const missingInvoicing = missingForInvoicing(settings);
  const kpis = await getFeeKpis();

  return (
    <div>
      <PageTitle title="Beiträge" description="Beitragsjahre, Rechnungen mit QR-Zahlteil oder Einzahlungsangaben, Zahlungseingänge, Mahnungen und offene Posten.">
        {canWrite && (
          <Link href="/admin/fees/invoices/new" className={buttonClass("primary", "md")}>
            <Plus className="h-4 w-4" aria-hidden />
            Neue Rechnung
          </Link>
        )}
      </PageTitle>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Offen" value={`CHF ${formatChf(kpis.openRappen)}`} detail={`${kpis.openCount} ${kpis.openCount === 1 ? "Rechnung" : "Rechnungen"}`} href="/admin/fees?tab=offene" />
        <StatCard label="Überfällig" value={`CHF ${formatChf(kpis.overdueRappen)}`} detail={`${kpis.overdueCount} ${kpis.overdueCount === 1 ? "Rechnung" : "Rechnungen"}`} accent={kpis.overdueCount > 0 ? "text-rose-300" : "text-white"} href="/admin/fees?tab=mahnungen" />
        <StatCard label="Entwürfe" value={kpis.draftCount} detail="noch nicht versendet" href="/admin/fees?tab=rechnungen&status=ENTWURF" />
        <StatCard label="Nicht gebucht" value={kpis.unbookedPayments} detail="Zahlungen ohne Kassen-Buchung" accent={kpis.unbookedPayments > 0 ? "text-amber-300" : "text-white"} href="/admin/fees?tab=zahlungen" />
      </div>

      <MissingSettingsNotice title="Für Rechnungen fehlen noch Angaben in den Vereinseinstellungen:" missing={missingInvoicing} canEdit={canEditSettings} />

      <nav aria-label="Bereiche der Beiträge" className="mb-6 flex gap-1 overflow-x-auto border-b border-zinc-800">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/admin/fees?tab=${t.id}`}
            aria-current={t.id === tab ? "page" : undefined}
            className={cn("-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors", t.id === tab ? "border-emerald-400 text-white" : "border-transparent text-zinc-400 hover:text-zinc-100")}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "rechnungen" && <InvoicesTab sp={sp} canWrite={canWrite} />}
      {tab === "jahre" && <PeriodsTab canWrite={canWrite} ready={missingInvoicing.length === 0} />}
      {tab === "zahlungen" && <PaymentsTab sp={sp} canWrite={canWrite} canBook={canAccess(admin.roles, "ledger", "write")} />}
      {tab === "mahnungen" && <RemindersTab canWrite={canWrite} canEditSettings={canEditSettings} />}
      {tab === "offene" && <OpenItemsTab />}
    </div>
  );
}

// ---- Rechnungen -------------------------------------------------------------------------------------------------------------

async function InvoicesTab({ sp, canWrite }: { sp: Record<string, string | string[] | undefined>; canWrite: boolean }) {
  const p = listParams(new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : []))), { pageSize: 25 });
  const status = first(sp.status);
  const statusOk = status === INVOICE_FILTER_OVERDUE || (INVOICE_STATUSES as readonly string[]).includes(status) ? status : "";
  const periodRaw = first(sp.period);
  const periods = await db.feePeriod.findMany({ orderBy: { year: "desc" }, select: { id: true, year: true, label: true } });
  const period = periods.some((x) => x.id === periodRaw) ? periodRaw : "";
  const { items, total } = await listInvoices({ q: p.q, status: statusOk, periodId: period }, p.skip, p.take);
  const meta = pageMeta(total, p.page, p.pageSize, items.length);
  const filtered = Boolean(p.q || statusOk || period);
  const base = { tab: "rechnungen", q: p.q || null, status: statusOk || null, period: period || null };
  const exportQs = new URLSearchParams({ type: "invoices", ...(statusOk ? { status: statusOk } : {}), ...(period ? { periodId: period } : {}) });

  const rows: InvoiceRowDTO[] = items.map((i) => ({
    id: i.id,
    number: i.number,
    status: i.status,
    recipientName: i.recipientName,
    subject: i.subject,
    issueDate: i.issueDate.toISOString(),
    dueDate: i.dueDate.toISOString(),
    totalRappen: i.totalRappen,
    paidRappen: i.paidRappen,
    reminderLevel: i.reminderLevel,
    memberNumber: i.member.memberNumber,
  }));

  return (
    <>
      <form method="get" action="/admin/fees" role="search" className="mb-6 grid gap-2 sm:grid-cols-[11rem_12rem_1fr_auto_auto]">
        <input type="hidden" name="tab" value="rechnungen" />
        <div>
          <label htmlFor="inv-status" className="sr-only">
            Status
          </label>
          <Select id="inv-status" name="status" defaultValue={statusOk}>
            <option value="">Alle Status</option>
            {INVOICE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {INVOICE_STATUS_LABEL[s]}
              </option>
            ))}
            <option value={INVOICE_FILTER_OVERDUE}>Überfällig</option>
          </Select>
        </div>
        <div>
          <label htmlFor="inv-period" className="sr-only">
            Beitragsjahr
          </label>
          <Select id="inv-period" name="period" defaultValue={period}>
            <option value="">Alle Beitragsjahre</option>
            {periods.map((x) => (
              <option key={x.id} value={x.id}>
                {x.year}
              </option>
            ))}
          </Select>
        </div>
        <div className="relative">
          <label htmlFor="inv-q" className="sr-only">
            Rechnungen durchsuchen
          </label>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden />
          <Input id="inv-q" name="q" type="search" defaultValue={p.q} maxLength={100} placeholder="Nummer, Name oder Betreff" className="pl-9" />
        </div>
        <Button type="submit" variant="secondary">
          Filtern
        </Button>
        {filtered && (
          <Link href="/admin/fees?tab=rechnungen" className={buttonClass("ghost", "md")}>
            Zurücksetzen
          </Link>
        )}
      </form>

      <div className="mb-4 flex justify-end">
        <a href={`/api/admin/fees/export?${exportQs.toString()}`} className={buttonClass("secondary", "sm")}>
          <Download className="h-4 w-4" aria-hidden />
          Als CSV exportieren
        </a>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={filtered ? "Keine passenden Rechnungen" : "Noch keine Rechnungen"}
          text={filtered ? "Zu diesen Filtern gibt es keine Rechnungen. Passe die Auswahl an oder setze sie zurück." : "Lege unter «Beitragsjahre» ein Beitragsjahr an und erzeuge die Rechnungen, oder erstelle eine einzelne Rechnung."}
        />
      ) : (
        <>
          <InvoiceTable rows={rows} canWrite={canWrite} />
          <Pager page={meta.page} totalPages={meta.totalPages} from={meta.from} to={meta.to} total={meta.total} noun="Rechnung" nounPlural="Rechnungen" hrefFor={(n) => listHref("/admin/fees", { ...base, page: n > 1 ? n : null })} />
        </>
      )}
    </>
  );
}

// ---- Beitragsjahre ------------------------------------------------------------------------------------------------------------

async function PeriodsTab({ canWrite, ready }: { canWrite: boolean; ready: boolean }) {
  const [periods, types, accounts] = await Promise.all([listPeriods(), listFeeTypes(), listBookingAccounts()]);
  const dtos: PeriodDTO[] = periods.map((p) => ({
    ...p,
    startsOn: p.startsOn.toISOString(),
    endsOn: p.endsOn.toISOString(),
    invoicedAt: p.invoicedAt ? p.invoicedAt.toISOString() : null,
  }));
  const suggested = periods.length > 0 ? Math.max(...periods.map((p) => p.year)) + 1 : yearOf(todayZurich());
  return <PeriodManager periods={dtos} types={types} incomes={accounts.incomes} canWrite={canWrite} invoicingReady={ready} suggestedYear={suggested} />;
}

// ---- Zahlungen -------------------------------------------------------------------------------------------------------------------

async function PaymentsTab({ sp, canWrite, canBook }: { sp: Record<string, string | string[] | undefined>; canWrite: boolean; canBook: boolean }) {
  const p = listParams(new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : []))), { pageSize: 25 });
  const [{ items, total }, accounts, members] = await Promise.all([
    listPayments(p.q, p.skip, p.take),
    canWrite ? listBookingAccounts() : { assets: [], incomes: [] },
    canWrite ? db.member.findMany({ where: { anonymizedAt: null }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }], take: 2000, select: { id: true, memberNumber: true, firstName: true, lastName: true } }) : [],
  ]);
  const meta = pageMeta(total, p.page, p.pageSize, items.length);
  return (
    <div className="space-y-6">
      {canWrite && (
        <div className="flex flex-wrap items-center gap-3">
          <NewPaymentButton accounts={accounts} members={members.map((m) => ({ id: m.id, label: `Nr. ${m.memberNumber} · ${m.lastName} ${m.firstName}` }))} />
          <p className="text-sm text-zinc-400">Zahlungen zu einer Rechnung erfasst du direkt bei der Rechnung.</p>
        </div>
      )}
      {canWrite && <PaymentImport accounts={accounts} />}

      <form method="get" action="/admin/fees" role="search" className="flex gap-2">
        <input type="hidden" name="tab" value="zahlungen" />
        <div className="relative flex-1">
          <label htmlFor="pay-q" className="sr-only">
            Zahlungen durchsuchen
          </label>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden />
          <Input id="pay-q" name="q" type="search" defaultValue={p.q} maxLength={100} placeholder="Rechnungsnummer, Referenz oder Name" className="pl-9" />
        </div>
        <Button type="submit" variant="secondary">
          Suchen
        </Button>
        {p.q && (
          <Link href="/admin/fees?tab=zahlungen" className={buttonClass("ghost", "md")}>
            Zurücksetzen
          </Link>
        )}
      </form>

      {items.length === 0 ? (
        <EmptyState icon={Wallet} title={p.q ? "Keine passenden Zahlungen" : "Noch keine Zahlungen"} text={p.q ? "Zu dieser Suche gibt es keine Zahlungen." : "Erfasste Zahlungen erscheinen hier."} />
      ) : (
        <>
          <Card className="overflow-hidden">
            <TableWrap label="Zahlungen">
              <table className="w-full min-w-[48rem]">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className={TH}>Eingang</th>
                    <th className={`${TH} text-right`}>Betrag</th>
                    <th className={TH}>Rechnung / Mitglied</th>
                    <th className={TH}>Art</th>
                    <th className={TH}>Kasse</th>
                    <th className={TH}>
                      <span className="sr-only">Aktionen</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {items.map((pay) => (
                    <tr key={pay.id}>
                      <td className={TD}>
                        {formatDateCh(pay.receivedAt)}
                        {pay.reference && <span className="block max-w-[14rem] truncate font-mono text-xs text-zinc-500">{pay.reference}</span>}
                      </td>
                      <td className={`${TD} text-right`}>
                        <Chf rappen={pay.amountRappen} />
                      </td>
                      <td className={TD}>
                        {pay.invoice ? (
                          <Link href={`/admin/fees/invoices/${encodeURIComponent(pay.invoice.id)}`} className="font-medium text-white hover:underline">
                            {pay.invoice.number}
                          </Link>
                        ) : (
                          <span className="text-zinc-500">ohne Rechnung</span>
                        )}
                        {pay.member && (
                          <span className="block text-xs text-zinc-500">
                            Nr. {pay.member.memberNumber} · {pay.member.firstName} {pay.member.lastName}
                          </span>
                        )}
                      </td>
                      <td className={TD}>{PAYMENT_METHOD_LABEL[pay.method as PaymentMethod] ?? pay.method}</td>
                      <td className={TD}>{pay.transaction ? `Beleg ${pay.transaction.voucherNo}` : <span className="text-amber-300">noch nicht gebucht</span>}</td>
                      <td className={TD}>
                        <PaymentRowActions id={pay.id} label={`${formatDateCh(pay.receivedAt)}, CHF ${formatChf(pay.amountRappen)}`} booked={Boolean(pay.transaction)} canWrite={canWrite} canBook={canBook} accounts={accounts} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </Card>
          <Pager page={meta.page} totalPages={meta.totalPages} from={meta.from} to={meta.to} total={meta.total} noun="Zahlung" nounPlural="Zahlungen" hrefFor={(n) => listHref("/admin/fees", { tab: "zahlungen", q: p.q || null, page: n > 1 ? n : null })} />
        </>
      )}
    </div>
  );
}

// ---- Mahnwesen --------------------------------------------------------------------------------------------------------------------

async function RemindersTab({ canWrite, canEditSettings }: { canWrite: boolean; canEditSettings: boolean }) {
  const [rows, settings] = await Promise.all([listReminderRows(), getVereinSettings()]);
  const missing = missingForReminders(settings);
  const dtos: ReminderRowDTO[] = rows.map((r) => ({
    id: r.id,
    number: r.number,
    recipientName: r.recipientName,
    dueDate: r.dueDate.toISOString(),
    openRappen: openAmount(r.totalRappen, r.paidRappen),
    reminderLevel: r.reminderLevel,
    daysOverdue: r.daysOverdue,
    state: r.state.state,
    nextLevel: r.state.state === "READY" ? r.state.nextLevel : null,
    reason: "reason" in r.state ? r.state.reason : "",
    hasEmail: r.hasEmail,
    lastReminder: r.lastReminder ? { ...r.lastReminder, dueDate: r.lastReminder.dueDate.toISOString(), sentAt: r.lastReminder.sentAt ? r.lastReminder.sentAt.toISOString() : null } : null,
  }));
  return (
    <>
      <MissingSettingsNotice title="Für Mahnungen fehlen noch Angaben in den Vereinseinstellungen:" missing={missing} canEdit={canEditSettings} />
      <Notice variant="info" className="mb-6">
        Eine Mahnung ist eine schriftliche Aufforderung des Vereins zu zahlen. Fristen und Gebühren stammen aus den Vereinseinstellungen. Welche rechtlichen Folgen sie hat und wie es nach der letzten Mahnstufe weitergeht, entscheidet der Vorstand nach den Statuten.
      </Notice>
      <ReminderTable rows={dtos} canWrite={canWrite} remindersReady={missing.length === 0} />
    </>
  );
}

// ---- Offene Posten -----------------------------------------------------------------------------------------------------------------

async function OpenItemsTab() {
  const { rows, summary, today } = await getOpenItems();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-400">Stand {formatDateCh(today)}: {summary.count} {summary.count === 1 ? "offene Rechnung" : "offene Rechnungen"} über insgesamt CHF {formatChf(summary.rappen)}, davon überfällig CHF {formatChf(summary.overdueRappen)}.</p>
        <a href="/api/admin/fees/export?type=open" className={buttonClass("secondary", "sm")}>
          <Download className="h-4 w-4" aria-hidden />
          Als CSV exportieren
        </a>
      </div>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {summary.buckets.map((b) => (
          <Card key={b.id} className="p-4">
            <dt className="text-xs font-medium text-zinc-400">{AGING_BUCKETS.find((x) => x.id === b.id)?.label}</dt>
            <dd className="mt-1.5 text-lg font-semibold tabular-nums text-white">CHF {formatChf(b.rappen)}</dd>
            <dd className="text-xs text-zinc-500">{b.count} {b.count === 1 ? "Rechnung" : "Rechnungen"}</dd>
          </Card>
        ))}
      </dl>
      {rows.length === 0 ? (
        <EmptyState icon={FileText} title="Keine offenen Posten" text="Alle versendeten Rechnungen sind bezahlt." />
      ) : (
        <Card className="overflow-hidden">
          <TableWrap label="Offene Posten">
            <table className="w-full min-w-[44rem]">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className={TH}>Rechnung</th>
                  <th className={TH}>Empfänger</th>
                  <th className={TH}>Fällig</th>
                  <th className={`${TH} text-right`}>Offen</th>
                  <th className={TH}>Mahnstufe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {rows.map((r) => {
                  const late = daysOverdue(r.dueDate, today);
                  return (
                    <tr key={r.id}>
                      <td className={TD}>
                        <Link href={`/admin/fees/invoices/${encodeURIComponent(r.id)}`} className="font-medium text-white hover:underline">
                          {r.number}
                        </Link>
                      </td>
                      <td className={TD}>
                        {r.recipientName}
                        <span className="block text-xs text-zinc-500">Nr. {r.member.memberNumber}</span>
                      </td>
                      <td className={TD}>
                        {formatDateCh(r.dueDate)}
                        {late > 0 && <span className="block text-xs text-rose-300">{late} Tage überfällig</span>}
                      </td>
                      <td className={`${TD} text-right`}>
                        <Chf rappen={openAmount(r.totalRappen, r.paidRappen)} />
                      </td>
                      <td className={TD}>{r.reminderLevel > 0 ? `${r.reminderLevel}. Mahnung` : "–"}</td>
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
