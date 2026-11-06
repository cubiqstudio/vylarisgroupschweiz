import type { Metadata } from "next";
import { PageTitle } from "@/components/admin/core/page-title";
import { Notice } from "@/components/admin/core/notice";
import { AccountManager } from "@/components/admin/ledger/account-manager";
import { LedgerNav } from "@/components/admin/ledger/ledger-nav";
import { ACCOUNTING_NOTE } from "@/components/admin/ledger/statement-tables";
import { requireModulePage } from "@/lib/verein/guard";
import { listAccountsWithUsage } from "@/lib/verein/ledger-data";
import { formatChf, toDecimalString } from "@/lib/verein/money";
import { canAccess } from "@/lib/verein/permissions";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Konten der Kasse" };

export default async function AccountsPage() {
  const admin = await requireModulePage("ledger");
  const canWrite = canAccess(admin.roles, "ledger", "write");
  const [accounts, locked] = await Promise.all([listAccountsWithUsage(), db.fiscalYear.count({ where: { lockedAt: { not: null } } })]);
  return (
    <div>
      <PageTitle title="Konten" description="Der Kontenplan des Vereins: woher das Geld kommt, wofür es ausgegeben wird und wo es liegt. Der Verein legt Namen und Nummern selbst fest." />
      <LedgerNav />
      <Notice variant="info" className="mb-6">
        {ACCOUNTING_NOTE}
      </Notice>
      <AccountManager
        canWrite={canWrite}
        openingLocked={locked > 0}
        accounts={accounts.map((a) => ({
          id: a.id,
          kind: a.kind,
          number: a.number,
          name: a.name,
          openingDisplay: formatChf(a.openingBalanceRappen),
          openingInput: toDecimalString(a.openingBalanceRappen),
          active: a.active,
          sortOrder: a.sortOrder,
          usage: a.usage,
        }))}
      />
    </div>
  );
}
