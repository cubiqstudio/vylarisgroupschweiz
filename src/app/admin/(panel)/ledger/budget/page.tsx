import type { Metadata } from "next";
import { PageTitle } from "@/components/admin/core/page-title";
import { Notice } from "@/components/admin/core/notice";
import { BudgetEditor, type BudgetLine } from "@/components/admin/ledger/budget-editor";
import { LedgerNav } from "@/components/admin/ledger/ledger-nav";
import { YearPicker } from "@/components/admin/ledger/year-picker";
import { requireModulePage } from "@/lib/verein/guard";
import { currentFiscalYear, getBudgetEditor, getFiscalStart, knownYears } from "@/lib/verein/ledger-data";
import { fiscalYearLabel } from "@/lib/verein/ledger-lib";
import { parseYearParam } from "@/lib/verein/ledger-schemas";
import { canAccess } from "@/lib/verein/permissions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Budget" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function BudgetPage({ searchParams }: Props) {
  const admin = await requireModulePage("ledger");
  const canWrite = canAccess(admin.roles, "ledger", "write");
  const sp = await searchParams;
  const current = await currentFiscalYear();
  const year = parseYearParam(sp, current);
  const fiscal = await getFiscalStart();
  const [editor, { years }] = await Promise.all([getBudgetEditor(year), knownYears()]);
  const choices = years.includes(year) ? years : [year, ...years].sort((a, b) => b - a);
  if (!choices.includes(current + 1)) choices.unshift(current + 1);

  const lines: BudgetLine[] = [...editor.comparison.income, ...editor.comparison.expense].map((r) => {
    const prev = [...editor.previous.income, ...editor.previous.expense].find((p) => p.account.id === r.account.id);
    return {
      id: r.account.id,
      kind: r.account.kind === "EINNAHMEN" ? "EINNAHMEN" : "AUSGABEN",
      label: `${r.account.number} ${r.account.name}${r.account.active ? "" : " (inaktiv)"}`,
      budgetRappen: r.budgetRappen,
      actualRappen: r.actualRappen,
      previousBudgetRappen: prev?.budgetRappen ?? null,
      previousActualRappen: prev?.actualRappen ?? 0,
    };
  });

  return (
    <div>
      <PageTitle title="Budget" description={`Soll/Ist-Vergleich je Konto für das Geschäftsjahr ${fiscalYearLabel(year, fiscal)}. Beträge legt der Verein selbst fest; es gibt keine Voreinstellungen.`} />
      <LedgerNav />
      <YearPicker action="/admin/ledger/budget" years={choices} selected={year} fiscal={fiscal} />
      {lines.length === 0 ? (
        <Notice variant="warning">Es sind noch keine Einnahmen- oder Ausgabenkonten angelegt. Lege sie zuerst unter «Konten» an.</Notice>
      ) : (
        <BudgetEditor key={year} year={year} lines={lines} canWrite={canWrite} locked={editor.locked} />
      )}
    </div>
  );
}
