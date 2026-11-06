import type { Metadata } from "next";
import { PageTitle } from "@/components/admin/core/page-title";
import { Notice } from "@/components/admin/core/notice";
import { Card } from "@/components/ui/card";
import { LedgerNav } from "@/components/admin/ledger/ledger-nav";
import { TransactionForm } from "@/components/admin/ledger/transaction-form";
import { toDateInputValue, todayZurich } from "@/lib/verein/dates";
import { requireModulePage } from "@/lib/verein/guard";
import { loadAccounts } from "@/lib/verein/ledger-data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Neue Buchung" };

export default async function NewTransactionPage() {
  await requireModulePage("ledger", "write");
  const accounts = await loadAccounts();
  return (
    <div>
      <PageTitle title="Neue Buchung" description="Erfasse eine Einnahme, eine Ausgabe oder eine Umbuchung zwischen Bank und Kasse. Die Belegnummer vergibt die Kasse." />
      <LedgerNav />
      {accounts.length === 0 ? (
        <Notice variant="warning">Es sind noch keine Konten angelegt. Lege zuerst unter «Konten» Einnahmen-, Ausgaben- und Vermögenskonten an.</Notice>
      ) : (
        <Card className="max-w-3xl p-5 sm:p-6">
          <TransactionForm
            accounts={accounts.map((a) => ({ id: a.id, kind: a.kind, number: a.number, name: a.name, active: a.active }))}
            initial={{ bookingDate: toDateInputValue(todayZurich()), direction: "AUSGABE", amount: "", categoryId: "", counterAccountId: "", text: "", voucherRef: "" }}
          />
        </Card>
      )}
    </div>
  );
}
