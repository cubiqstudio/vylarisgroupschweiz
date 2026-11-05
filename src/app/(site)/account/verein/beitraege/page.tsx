import type { Metadata } from "next";
import Link from "next/link";
import { Receipt } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PILL } from "@/components/admin/core/styles";
import { getMessages } from "@/i18n/server";
import { beitraege } from "@/i18n/verein-beitraege";
import { verein } from "@/i18n/verein";
import { cn } from "@/lib/utils";
import { TONE_CLASS, type Tone } from "@/lib/verein/constants";
import { formatDateCh, isPastDue } from "@/lib/verein/dates";
import { listInvoicesForMember } from "@/lib/verein/fees-data";
import { openAmount } from "@/lib/verein/fees-calc";
import { requireMemberPage } from "@/lib/verein/guard";
import { formatChf } from "@/lib/verein/money";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const m = (await getMessages(verein)).portal;
  return { title: m.meta.fees, robots: { index: false, follow: false } };
}

/** Eigene Rechnungen des angemeldeten Mitglieds (nur versandte, nie Entwürfe; jede Abfrage filtert mit memberId). */
export default async function Page() {
  const member = await requireMemberPage("/account/verein/beitraege");
  const m = await getMessages(beitraege);
  const invoices = await listInvoicesForMember(member.id);
  const openTotal = invoices.filter((i) => i.status === "OFFEN").reduce((sum, i) => sum + openAmount(i.totalRappen, i.paidRappen), 0);

  const stateOf = (i: (typeof invoices)[number]): { label: string; tone: Tone } => {
    if (i.status === "STORNIERT") return { label: m.state.cancelled, tone: "zinc" };
    if (i.status === "BEZAHLT") return i.paidRappen > i.totalRappen ? { label: m.state.over, tone: "green" } : { label: m.state.paid, tone: "green" };
    if (isPastDue(i.dueDate)) return { label: m.state.overdue, tone: "rose" };
    if (i.paidRappen > 0) return { label: m.state.partial, tone: "amber" };
    return { label: m.state.open, tone: "amber" };
  };

  return (
    <section aria-labelledby="fees-heading">
      <h2 id="fees-heading" className="text-xl font-semibold tracking-tight text-white">
        {m.portal.heading}
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-zinc-400">{m.portal.intro}</p>

      {invoices.length === 0 ? (
        <Card className="mt-6 flex flex-col items-center px-6 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800/80 text-zinc-400 ring-1 ring-inset ring-zinc-700">
            <Receipt className="h-5 w-5" aria-hidden />
          </span>
          <h3 className="mt-4 text-lg font-semibold text-white">{m.portal.emptyTitle}</h3>
          <p className="mt-1.5 max-w-sm text-sm text-zinc-400">{m.portal.emptyText}</p>
        </Card>
      ) : (
        <>
          {openTotal > 0 && (
            <p className="mt-4 text-sm text-zinc-300">
              {m.portal.openTotal}: <span className="font-semibold tabular-nums text-white">CHF {formatChf(openTotal)}</span>
            </p>
          )}
          <Card className="mt-4 overflow-hidden">
            <div className="overflow-x-auto" role="region" aria-label={m.portal.heading} tabIndex={0}>
              <table className="w-full min-w-[34rem]">
                <thead>
                  <tr className="border-b border-zinc-800 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                    <th className="px-4 py-2.5">{m.portal.columns.number}</th>
                    <th className="px-4 py-2.5">{m.portal.columns.date}</th>
                    <th className="px-4 py-2.5">{m.portal.columns.due}</th>
                    <th className="px-4 py-2.5 text-right">{m.portal.columns.total}</th>
                    <th className="px-4 py-2.5">{m.portal.columns.state}</th>
                    <th className="px-4 py-2.5">
                      <span className="sr-only">{m.portal.view}</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {invoices.map((i) => {
                    const state = stateOf(i);
                    return (
                      <tr key={i.id} className="text-sm text-zinc-300">
                        <td className="px-4 py-3 font-medium text-white">
                          {i.number}
                          {i.subject && <span className="block text-xs font-normal text-zinc-500">{i.subject}</span>}
                        </td>
                        <td className="px-4 py-3">{formatDateCh(i.issueDate)}</td>
                        <td className="px-4 py-3">{formatDateCh(i.dueDate)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">CHF {formatChf(i.totalRappen)}</td>
                        <td className="px-4 py-3">
                          <span className={cn(PILL, TONE_CLASS[state.tone])}>{state.label}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link href={`/account/verein/beitraege/${encodeURIComponent(i.id)}`} className="font-medium text-emerald-400 hover:underline">
                            {m.portal.view}
                            <span className="sr-only"> {i.number}</span>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
          <p className="mt-4 text-sm text-zinc-500">{m.portal.contact}</p>
        </>
      )}
    </section>
  );
}
