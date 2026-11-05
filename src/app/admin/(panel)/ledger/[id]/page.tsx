import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageTitle } from "@/components/admin/core/page-title";
import { Notice } from "@/components/admin/core/notice";
import { LedgerNav } from "@/components/admin/ledger/ledger-nav";
import { Amount, DirectionPill, StatePill } from "@/components/admin/ledger/ledger-ui";
import { ReceiptPanel, TransactionActions } from "@/components/admin/ledger/transaction-actions";
import { TRANSACTION_SOURCE_LABEL, type TransactionSource } from "@/lib/verein/constants";
import { formatDateCh, formatDateTimeCh, toDateInputValue, todayZurich } from "@/lib/verein/dates";
import { requireModulePage } from "@/lib/verein/guard";
import { getTransactionDetail, loadAccounts } from "@/lib/verein/ledger-data";
import { cashEffect, MAX_RECEIPTS_PER_TRANSACTION } from "@/lib/verein/ledger-lib";
import { formatChf, toDecimalString } from "@/lib/verein/money";
import { idSchema } from "@/lib/verein/validation";
import { canAccess } from "@/lib/verein/permissions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Buchung" };

const sizeLabel = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

export default async function TransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireModulePage("ledger");
  const parsed = idSchema.safeParse((await params).id);
  if (!parsed.success) notFound();
  const t = await getTransactionDetail(parsed.data);
  if (!t) notFound();
  const canWrite = canAccess(admin.roles, "ledger", "write");
  const accounts = canWrite ? await loadAccounts() : [];
  const isReversal = t.reversalOf !== null;
  const effect = cashEffect({ direction: t.direction, amountRappen: t.amountRappen, reversal: isReversal });
  const row = (label: string, value: React.ReactNode) => (
    <div className="grid gap-1 py-3 sm:grid-cols-[11rem_1fr] sm:gap-4">
      <dt className="text-sm text-zinc-500">{label}</dt>
      <dd className="min-w-0 break-words text-sm text-zinc-100">{value}</dd>
    </div>
  );

  return (
    <div>
      <PageTitle title={`Buchung ${t.voucherNo || ""}`.trim()} description={t.text}>
        <Link href="/admin/ledger" className="inline-flex h-10 items-center gap-2 rounded-md px-4 text-sm font-semibold text-zinc-300 hover:bg-zinc-900 hover:text-white">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Zur Kassa
        </Link>
      </PageTitle>
      <LedgerNav />

      {t.state === "STORNIERT" && t.reversedBy && (
        <Notice variant="warning" className="mb-4">
          Diese Buchung wurde am {formatDateCh(t.reversedBy.bookingDate)} storniert. Gegenbuchung:{" "}
          <Link href={`/admin/ledger/${t.reversedBy.id}`} className="font-medium underline underline-offset-2">
            {t.reversedBy.voucherNo}
          </Link>
          .
        </Notice>
      )}
      {t.state === "STORNO" && t.reversalOf && (
        <Notice variant="info" className="mb-4">
          Gegenbuchung zu{" "}
          <Link href={`/admin/ledger/${t.reversalOf.id}`} className="font-medium underline underline-offset-2">
            {t.reversalOf.voucherNo}
          </Link>{" "}
          ({t.reversalOf.text}).
        </Notice>
      )}
      {t.locked && <Notice variant="info" className="mb-4">Das Geschäftsjahr {t.fiscalYear} ist abgeschlossen.</Notice>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <Card className="px-5 py-2 sm:px-6">
            <dl className="divide-y divide-zinc-800">
              {row("Beleg-Nr.", t.voucherNo || "–")}
              {row("Datum", formatDateCh(t.bookingDate))}
              {row("Art", <span className="inline-flex items-center gap-2"><DirectionPill direction={t.direction} /><StatePill state={t.state} /></span>)}
              {row(
                "Betrag",
                t.direction === "UMBUCHUNG" ? (
                  <span className="tabular-nums">CHF {formatChf(t.amountRappen)}</span>
                ) : (
                  <span className="tabular-nums">
                    CHF <Amount rappen={effect} signed />
                    {isReversal && <span className="ml-2 text-xs text-zinc-500">(Gegenbuchung hebt {formatChf(t.amountRappen)} auf)</span>}
                  </span>
                ),
              )}
              {row(t.direction === "UMBUCHUNG" ? "Von" : t.direction === "EINNAHME" ? "Einnahmenkonto" : "Ausgabenkonto", `${t.category.number} ${t.category.name}${t.category.active ? "" : " (inaktiv)"}`)}
              {row(t.direction === "UMBUCHUNG" ? "Nach" : t.direction === "EINNAHME" ? "Eingegangen auf" : "Bezahlt von", t.counterAccount ? `${t.counterAccount.number} ${t.counterAccount.name}${t.counterAccount.active ? "" : " (inaktiv)"}` : "–")}
              {row("Buchungstext", t.text)}
              {row("Beleg-Referenz", t.voucherRef || "–")}
              {row("Geschäftsjahr", String(t.fiscalYear))}
              {row("Quelle", TRANSACTION_SOURCE_LABEL[t.source as TransactionSource] ?? t.source)}
              {t.payment &&
                row(
                  "Zahlungseingang",
                  t.payment.invoiceId ? (
                    <Link href={`/admin/fees/invoices/${t.payment.invoiceId}`} className="text-emerald-400 underline underline-offset-2">
                      Rechnung {t.payment.invoiceNumber}
                    </Link>
                  ) : (
                    "Zahlung ohne Rechnung"
                  ),
                )}
              {row("Erfasst", `${formatDateTimeCh(t.createdAt)}${t.createdByName ? `, ${t.createdByName}` : ""}`)}
            </dl>
          </Card>

          <section aria-labelledby="receipts-h">
            <h2 id="receipts-h" className="mb-3 text-base font-semibold text-white">
              Belege
            </h2>
            <ReceiptPanel
              transactionId={t.id}
              canWrite={canWrite}
              removeBlock={t.receiptRemoveBlock}
              maxReached={t.receipts.length >= MAX_RECEIPTS_PER_TRANSACTION}
              receipts={t.receipts.map((r) => ({ id: r.id, fileName: r.fileName, sizeLabel: sizeLabel(r.sizeBytes), uploadedByName: r.uploadedByName, createdLabel: formatDateCh(r.createdAt) }))}
            />
            {t.receipts.length === 0 && t.source === "MANUELL" && !isReversal && (
              <p className="mt-3 text-xs text-zinc-500">Tipp: Hänge zu jeder Ausgabe den Beleg an. Die Revisorinnen und Revisoren prüfen die Buchungen anhand der Belege.</p>
            )}
          </section>
        </div>

        {canWrite && (
          <aside aria-label="Aktionen">
            <Card className="p-5">
              <h2 className="mb-3 text-base font-semibold text-white">Aktionen</h2>
              <TransactionActions
                id={t.id}
                voucherNo={t.voucherNo}
                canWrite={canWrite}
                accounts={accounts.map((a) => ({ id: a.id, kind: a.kind, number: a.number, name: a.name, active: a.active }))}
                initial={{
                  bookingDate: toDateInputValue(t.bookingDate),
                  direction: t.direction,
                  amount: toDecimalString(t.amountRappen),
                  categoryId: t.categoryId,
                  counterAccountId: t.counterAccountId ?? "",
                  text: t.text,
                  voucherRef: t.voucherRef,
                }}
                editBlock={t.editBlock}
                reverseBlock={t.reverseBlock}
                today={toDateInputValue(todayZurich())}
                reverseNote={t.source === "ZAHLUNG" ? "Diese Buchung stammt aus einem Zahlungseingang. Die Zahlung unter «Beiträge» bleibt bestehen und die Rechnung gilt weiterhin als bezahlt. Prüfe dort, ob eine Korrektur nötig ist." : t.locked ? `Das Geschäftsjahr ${t.fiscalYear} ist abgeschlossen. Die Gegenbuchung wird im offenen Jahr verbucht.` : undefined}
              />
            </Card>
          </aside>
        )}
      </div>
    </div>
  );
}
