import type { Metadata } from "next";
import Link from "next/link";
import { Download, Gavel, Search } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { MEETING_KINDS, MEETING_KIND_LABEL, RESOLUTION_RESULTS, RESOLUTION_RESULT_LABEL } from "@/lib/verein/constants";
import { formatDateCh } from "@/lib/verein/dates";
import { requireModulePage } from "@/lib/verein/guard";
import { listRegister, parseRegisterFilters, registerYears } from "@/lib/verein/meetings-data";
import { MAJORITY_SHORT, voteSummary, type MajorityRule } from "@/lib/verein/meetings-lib";
import { listHref, listParams, pageMeta } from "@/lib/verein/pagination";
import { PageTitle } from "@/components/admin/core/page-title";
import { Pager } from "@/components/admin/licenses/pager";
import { EmptyState } from "@/components/admin/licenses/empty-state";
import { MeetingsNav } from "@/components/admin/meetings/meetings-nav";
import { ResultPill } from "@/components/admin/meetings/pills";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Beschlussregister" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ResolutionRegisterPage({ searchParams }: Props) {
  await requireModulePage("meetings");
  const sp = await searchParams;
  const filters = parseRegisterFilters(sp);
  const { page, pageSize } = listParams(sp);
  const first = await listRegister(filters, (page - 1) * pageSize, pageSize);
  const meta = pageMeta(first.total, page, pageSize);
  const [rows, years] = await Promise.all([meta.page === page ? first.rows : listRegister(filters, (meta.page - 1) * pageSize, pageSize).then((r) => r.rows), registerYears()]);
  const base = { q: filters.q, result: filters.result, kind: filters.kind, year: filters.year };
  const href = (p: number) => listHref("/admin/meetings/resolutions", { ...base, page: p });
  const exportHref = listHref("/api/admin/meetings/register/export", base);
  const filtered = Boolean(filters.q || filters.result || filters.kind || filters.year);

  return (
    <div>
      <PageTitle title="Beschlussregister" description="Alle Beschlüsse über alle Sitzungen: suchen, filtern und als CSV exportieren.">
        <a href={exportHref} className={buttonClass("secondary", "md")} download>
          <Download className="h-4 w-4" aria-hidden />
          CSV-Export
          <span className="sr-only"> der aktuellen Auswahl</span>
        </a>
      </PageTitle>
      <MeetingsNav />

      <form method="get" action="/admin/meetings/resolutions" role="search" className="mb-6 grid gap-2 sm:grid-cols-[1fr_10rem_12rem_12rem_auto_auto]">
        <div className="relative">
          <label htmlFor="reg-q" className="sr-only">
            Beschlüsse durchsuchen
          </label>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden />
          <Input id="reg-q" name="q" type="search" defaultValue={filters.q} maxLength={100} placeholder="Text, Traktandum oder Sitzung" className="pl-9" />
        </div>
        <div>
          <label htmlFor="reg-year" className="sr-only">
            Jahr
          </label>
          <Select id="reg-year" name="year" defaultValue={filters.year}>
            <option value="">Alle Jahre</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="reg-kind" className="sr-only">
            Art der Sitzung
          </label>
          <Select id="reg-kind" name="kind" defaultValue={filters.kind}>
            <option value="">Alle Arten</option>
            {MEETING_KINDS.map((k) => (
              <option key={k} value={k}>
                {MEETING_KIND_LABEL[k]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="reg-result" className="sr-only">
            Ergebnis
          </label>
          <Select id="reg-result" name="result" defaultValue={filters.result}>
            <option value="">Alle Ergebnisse</option>
            {RESOLUTION_RESULTS.map((r) => (
              <option key={r} value={r}>
                {RESOLUTION_RESULT_LABEL[r]}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="secondary">
          Filtern
        </Button>
        {filtered && (
          <Link href="/admin/meetings/resolutions" className={buttonClass("ghost", "md")}>
            Zurücksetzen
          </Link>
        )}
      </form>

      {rows.length === 0 ? (
        <EmptyState icon={Gavel} title={filtered ? "Keine passenden Beschlüsse" : "Noch keine Beschlüsse"} text={filtered ? "Zu diesen Filtern gibt es keine Einträge. Passe die Auswahl an oder setze sie zurück." : "Beschlüsse, die du in einer Sitzung erfasst, erscheinen hier."} />
      ) : (
        <>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto" role="region" aria-label="Beschlüsse" tabIndex={0}>
              <table className="w-full min-w-[48rem] text-left text-sm">
                <caption className="sr-only">Beschlussregister, neueste Sitzung zuerst</caption>
                <thead className="border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">Sitzung</th>
                    <th scope="col" className="px-4 py-3 font-medium">Nr.</th>
                    <th scope="col" className="px-4 py-3 font-medium">Beschluss</th>
                    <th scope="col" className="px-4 py-3 font-medium">Abstimmung</th>
                    <th scope="col" className="px-4 py-3 font-medium">Ergebnis</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {rows.map((r) => (
                    <tr key={r.id} className="align-top hover:bg-zinc-900/40">
                      <td className="px-4 py-3">
                        <Link href={`/admin/meetings/${r.meeting.id}?tab=beschluesse`} className="font-medium text-white hover:text-emerald-400">
                          {r.meeting.title}
                        </Link>
                        <div className="text-xs tabular-nums text-zinc-500">{formatDateCh(r.meeting.startsAt)}</div>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-zinc-400">{r.number}</td>
                      <td className="max-w-md px-4 py-3 text-zinc-200">
                        <p className="whitespace-pre-line">{r.text}</p>
                        {r.agendaItem && <p className="mt-1 text-xs text-zinc-500">Traktandum: {r.agendaItem.title}</p>}
                        {r.recusal.trim() && <p className="mt-1 text-xs text-zinc-500">Ausstand: {r.recusal}</p>}
                        {r._count.tasks > 0 && <p className="mt-1 text-xs text-zinc-500">{r._count.tasks} {r._count.tasks === 1 ? "Aufgabe" : "Aufgaben"} verknüpft</p>}
                      </td>
                      <td className="px-4 py-3 text-zinc-300">
                        {voteSummary(r) || <span className="text-zinc-600">ohne Auszählung</span>}
                        <div className="text-xs text-zinc-500">{MAJORITY_SHORT[r.majority as MajorityRule] ?? r.majority}</div>
                      </td>
                      <td className="px-4 py-3">
                        <ResultPill result={r.result} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Pager page={meta.page} totalPages={meta.totalPages} from={meta.from} to={meta.to} total={meta.total} noun="Beschluss" nounPlural="Beschlüssen" hrefFor={href} />
        </>
      )}
    </div>
  );
}
