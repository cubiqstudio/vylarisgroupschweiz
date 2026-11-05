import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/admin/core/notice";
import { PageTitle } from "@/components/admin/core/page-title";
import { InvoiceActions } from "@/components/admin/fees/invoice-actions";
import { PaymentRowActions } from "@/components/admin/fees/payment-row-actions";
import { Chf, InvoiceStatusPill, ReminderPill, TD, TH, TableWrap } from "@/components/admin/fees/shared";
import { PAYMENT_METHOD_LABEL, type PaymentMethod } from "@/lib/verein/constants";
import { formatDateCh, formatDateTimeCh } from "@/lib/verein/dates";
import { billForInvoice, getInvoiceDetail } from "@/lib/verein/fees-data";
import { balanceOf } from "@/lib/verein/fees-calc";
import { formatChf } from "@/lib/verein/money";
import { requireModulePage } from "@/lib/verein/guard";
import { listBookingAccounts } from "@/lib/verein/ledger-link";
import { canAccess } from "@/lib/verein/permissions";
import { idSchema } from "@/lib/verein/validation";
import { emailSchema } from "@/lib/verein/validation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Rechnung" };

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireModulePage("fees");
  const parsed = idSchema.safeParse((await params).id);
  if (!parsed.success) notFound();
  const inv = await getInvoiceDetail(parsed.data);
  if (!inv) notFound();

  const canWrite = canAccess(admin.roles, "fees", "write");
  const canBook = canAccess(admin.roles, "ledger", "write");
  const accounts = canWrite ? await listBookingAccounts() : { assets: [], incomes: [] };
  const { openRappen, overpaidRappen } = balanceOf(inv);
  const bill = inv.status === "ENTWURF" || inv.status === "OFFEN" ? await billForInvoice(inv) : null;
  const hasEmail = emailSchema.safeParse(inv.member.email).success && !inv.member.anonymizedAt;
  const facts: Array<[string, React.ReactNode]> = [
    ["Rechnungsdatum", formatDateCh(inv.issueDate)],
    ["Fällig am", formatDateCh(inv.dueDate)],
    ["Betrag", <Chf key="t" rappen={inv.totalRappen} withCurrency />],
    ["Bezahlt", <Chf key="p" rappen={inv.paidRappen} withCurrency />],
    [overpaidRappen > 0 ? "Überzahlung" : "Noch offen", <Chf key="o" rappen={overpaidRappen > 0 ? overpaidRappen : openRappen} withCurrency />],
    ["Referenz", bill?.ok ? (bill.display.reference ?? "–") : inv.paymentReference || "–"],
    ["Versendet", inv.sentAt ? formatDateTimeCh(inv.sentAt) : "noch nicht"],
    ["Beitragsjahr", inv.period ? String(inv.period.year) : "–"],
  ];

  return (
    <div>
      <Link href="/admin/fees" className="mb-3 inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white">
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Alle Rechnungen
      </Link>
      <PageTitle title={`Rechnung ${inv.number}`} description={inv.subject || undefined}>
        <InvoiceStatusPill status={inv.status} dueDate={inv.dueDate} openRappen={openRappen} />
        <ReminderPill level={inv.reminderLevel} />
      </PageTitle>

      <div className="mb-6">
        <InvoiceActions
          id={inv.id}
          number={inv.number}
          status={inv.status}
          hasEmail={hasEmail}
          canWrite={canWrite}
          target={{ id: inv.id, number: inv.number, recipientName: inv.recipientName, openRappen, hasIncomeAccount: inv.items.some((i) => i.categoryId) }}
          accounts={accounts}
        />
      </div>

      {inv.status === "STORNIERT" && (
        <Notice variant="warning" className="mb-6">
          Storniert am {inv.cancelledAt ? formatDateCh(inv.cancelledAt) : "–"}. Grund: {inv.cancelReason || "–"}
        </Notice>
      )}
      {bill && !bill.ok && (
        <Notice variant="warning" className="mb-6">
          <p className="font-medium">Die QR-Rechnung kann noch nicht erstellt werden:</p>
          <ul className="mt-1 list-disc pl-5">
            {bill.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </Notice>
      )}
      {overpaidRappen > 0 && (
        <Notice variant="info" className="mb-6">
          Auf dieser Rechnung ist mehr bezahlt als verlangt. Kläre die Überzahlung mit dem Mitglied (Rückzahlung oder Anrechnung auf eine spätere Rechnung).
        </Notice>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-white">Eckdaten</h2>
          <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            {facts.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-zinc-500">{label}</dt>
                <dd className="mt-0.5 text-sm text-zinc-200">{value}</dd>
              </div>
            ))}
          </dl>
          {inv.notes && (
            <div className="mt-4 border-t border-zinc-800 pt-3">
              <p className="text-xs text-zinc-500">Interne Notiz</p>
              <p className="mt-1 whitespace-pre-line text-sm text-zinc-300">{inv.notes}</p>
            </div>
          )}
        </Card>
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-white">Empfänger</h2>
          <p className="mt-3 text-sm text-zinc-200">{inv.recipientName}</p>
          <p className="mt-1 whitespace-pre-line text-sm text-zinc-400">{inv.recipientAddress || "Keine Anschrift hinterlegt"}</p>
          <p className="mt-3 text-xs text-zinc-500">
            Mitglied Nr. {inv.member.memberNumber}
            {inv.member.anonymizedAt ? " (Personendaten entfernt)" : ""}
          </p>
          {canAccess(admin.roles, "members", "read") && (
            <Link href={`/admin/members/${encodeURIComponent(inv.member.id)}`} className="mt-1 inline-block text-sm text-emerald-400 hover:underline">
              Mitglied ansehen
            </Link>
          )}
        </Card>
      </div>

      <Card className="mt-6 overflow-hidden">
        <h2 className="px-5 pt-5 text-sm font-semibold text-white">Positionen</h2>
        <TableWrap label="Positionen der Rechnung">
          <table className="mt-3 w-full min-w-[32rem] border-t border-zinc-800">
            <thead>
              <tr>
                <th className={TH}>Beschreibung</th>
                <th className={`${TH} text-right`}>Menge</th>
                <th className={`${TH} text-right`}>Einzelpreis</th>
                <th className={`${TH} text-right`}>Betrag (CHF)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {inv.items.map((i) => (
                <tr key={i.id}>
                  <td className={TD}>{i.description}</td>
                  <td className={`${TD} text-right tabular-nums`}>{i.quantity}</td>
                  <td className={`${TD} text-right`}>
                    <Chf rappen={i.unitRappen} />
                  </td>
                  <td className={`${TD} text-right`}>
                    <Chf rappen={i.totalRappen} />
                  </td>
                </tr>
              ))}
              <tr>
                <td className={`${TD} font-semibold text-white`} colSpan={3}>
                  Total CHF
                </td>
                <td className={`${TD} text-right font-semibold text-white`}>
                  <Chf rappen={inv.totalRappen} />
                </td>
              </tr>
            </tbody>
          </table>
        </TableWrap>
      </Card>

      <Card className="mt-6 overflow-hidden">
        <h2 className="px-5 pt-5 text-sm font-semibold text-white">Zahlungen</h2>
        {inv.payments.length === 0 ? (
          <p className="px-5 pb-5 pt-2 text-sm text-zinc-400">Noch keine Zahlung erfasst.</p>
        ) : (
          <TableWrap label="Zahlungen zur Rechnung">
            <table className="mt-3 w-full min-w-[40rem] border-t border-zinc-800">
              <thead>
                <tr>
                  <th className={TH}>Eingang</th>
                  <th className={`${TH} text-right`}>Betrag (CHF)</th>
                  <th className={TH}>Art</th>
                  <th className={TH}>Kassa</th>
                  <th className={TH}>
                    <span className="sr-only">Aktionen</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {inv.payments.map((p) => (
                  <tr key={p.id}>
                    <td className={TD}>
                      {formatDateCh(p.receivedAt)}
                      {p.reference && <span className="block break-all text-xs text-zinc-500">{p.reference}</span>}
                    </td>
                    <td className={`${TD} text-right`}>
                      <Chf rappen={p.amountRappen} />
                    </td>
                    <td className={TD}>{PAYMENT_METHOD_LABEL[p.method as PaymentMethod] ?? p.method}</td>
                    <td className={TD}>{p.transaction ? `Beleg ${p.transaction.voucherNo}` : <span className="text-amber-300">noch nicht gebucht</span>}</td>
                    <td className={TD}>
                      <PaymentRowActions id={p.id} label={`${formatDateCh(p.receivedAt)}, CHF ${formatChf(p.amountRappen)}`} booked={Boolean(p.transaction)} canWrite={canWrite} canBook={canBook} accounts={accounts} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>

      {inv.reminders.length > 0 && (
        <Card className="mt-6 overflow-hidden">
          <h2 className="px-5 pt-5 text-sm font-semibold text-white">Mahnungen</h2>
          <TableWrap label="Mahnungen zur Rechnung">
            <table className="mt-3 w-full min-w-[32rem] border-t border-zinc-800">
              <thead>
                <tr>
                  <th className={TH}>Stufe</th>
                  <th className={TH}>Neue Frist</th>
                  <th className={`${TH} text-right`}>Gebühr</th>
                  <th className={TH}>Zustellung</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {inv.reminders.map((r) => (
                  <tr key={r.id}>
                    <td className={TD}>{r.level}. Mahnung</td>
                    <td className={TD}>{formatDateCh(r.dueDate)}</td>
                    <td className={`${TD} text-right`}>
                      <Chf rappen={r.feeRappen} />
                    </td>
                    <td className={TD}>{r.mailSent ? `Per E-Mail am ${r.sentAt ? formatDateCh(r.sentAt) : "–"}` : r.mailError || "Nicht zugestellt"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Card>
      )}
    </div>
  );
}
