import type { Metadata } from "next";
import Link from "next/link";
import { Gavel, Plus, Search } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { MEETING_KINDS, MEETING_KIND_LABEL, MEETING_STATUSES, MEETING_STATUS_LABEL } from "@/lib/verein/constants";
import { formatDateTimeCh } from "@/lib/verein/dates";
import { requireModulePage } from "@/lib/verein/guard";
import { listMeetings, meetingCounts, parseMeetingFilters } from "@/lib/verein/meetings-data";
import { kindLabel } from "@/lib/verein/meetings-lib";
import { listHref, listParams, pageMeta } from "@/lib/verein/pagination";
import { canAccess } from "@/lib/verein/permissions";
import { PageTitle } from "@/components/admin/core/page-title";
import { Pager } from "@/components/admin/licenses/pager";
import { EmptyState } from "@/components/admin/licenses/empty-state";
import { MeetingsNav } from "@/components/admin/meetings/meetings-nav";
import { MeetingStatusPill } from "@/components/admin/meetings/pills";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Versammlungen" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AdminMeetingsPage({ searchParams }: Props) {
  const admin = await requireModulePage("meetings");
  const canWrite = canAccess(admin.roles, "meetings", "write");
  const sp = await searchParams;
  const filters = parseMeetingFilters(sp);
  const { page, pageSize } = listParams(sp);

  const first = await listMeetings(filters, (page - 1) * pageSize, pageSize);
  const meta = pageMeta(first.total, page, pageSize);
  const [rows, counts] = await Promise.all([
    meta.page === page ? first.rows : listMeetings(filters, (meta.page - 1) * pageSize, pageSize).then((r) => r.rows),
    meetingCounts(),
  ]);

  const base = { q: filters.q, kind: filters.kind, status: filters.status, when: filters.when };
  const href = (p: number, over: Partial<Record<keyof typeof base, string>> = {}) => listHref("/admin/meetings", { ...base, ...over, page: p });
  const filtered = Boolean(filters.q || filters.kind || filters.status);
  const chips: Array<{ value: string; label: string; count: number }> = [
    { value: "", label: "Alle", count: counts.all },
    { value: "kommend", label: "Kommend", count: counts.upcoming },
    { value: "vergangen", label: "Vergangen", count: counts.past },
  ];

  return (
    <div>
      <PageTitle title="Versammlungen" description="Mitgliederversammlungen und Vorstandssitzungen: Einladung, Traktanden, Anwesenheit, Beschlüsse und Protokoll. Fristen und Mehrheiten richten sich nach den Statuten.">
        {canWrite && (
          <Link href="/admin/meetings/new" className={buttonClass("primary", "md")}>
            <Plus className="h-4 w-4" aria-hidden />
            Neue Sitzung
          </Link>
        )}
      </PageTitle>

      <MeetingsNav />

      <nav aria-label="Zeitraum filtern" className="-mx-1 mb-4 overflow-x-auto px-1 pb-1">
        <ul className="flex min-w-max gap-1.5">
          {chips.map((c) => {
            const active = filters.when === c.value;
            return (
              <li key={c.value || "alle"}>
                <Link
                  href={href(1, { when: c.value })}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-medium ring-1 ring-inset transition-colors",
                    active ? "bg-zinc-900 text-white ring-zinc-700" : "bg-zinc-900/50 text-zinc-400 ring-zinc-800 hover:bg-zinc-900 hover:text-zinc-100",
                  )}
                >
                  {c.label}
                  <span className="tabular-nums text-xs text-zinc-500">{c.count}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <form method="get" action="/admin/meetings" role="search" className="mb-6 grid gap-2 sm:grid-cols-[1fr_14rem_12rem_auto_auto]">
        <input type="hidden" name="when" value={filters.when} />
        <div className="relative">
          <label htmlFor="meeting-q" className="sr-only">
            Sitzungen durchsuchen
          </label>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden />
          <Input id="meeting-q" name="q" type="search" defaultValue={filters.q} maxLength={100} placeholder="Titel oder Ort" className="pl-9" />
        </div>
        <div>
          <label htmlFor="meeting-kind" className="sr-only">
            Art
          </label>
          <Select id="meeting-kind" name="kind" defaultValue={filters.kind}>
            <option value="">Alle Arten</option>
            {MEETING_KINDS.map((k) => (
              <option key={k} value={k}>
                {MEETING_KIND_LABEL[k]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="meeting-status" className="sr-only">
            Status
          </label>
          <Select id="meeting-status" name="status" defaultValue={filters.status}>
            <option value="">Alle Status</option>
            {MEETING_STATUSES.map((s) => (
              <option key={s} value={s}>
                {MEETING_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="secondary">
          Filtern
        </Button>
        {(filtered || filters.when) && (
          <Link href="/admin/meetings" className={buttonClass("ghost", "md")}>
            Zurücksetzen
          </Link>
        )}
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon={Gavel}
          title={filtered || filters.when ? "Keine passenden Sitzungen" : "Noch keine Sitzungen"}
          text={filtered || filters.when ? "Zu diesen Filtern gibt es keine Einträge. Passe die Auswahl an oder setze sie zurück." : canWrite ? "Lege die erste Sitzung an, z. B. die Mitgliederversammlung oder eine Vorstandssitzung." : "Es sind noch keine Sitzungen erfasst."}
        />
      ) : (
        <>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto" role="region" aria-label="Sitzungen" tabIndex={0}>
              <table className="w-full min-w-[46rem] text-left text-sm">
                <caption className="sr-only">Sitzungen</caption>
                <thead className="border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">Datum</th>
                    <th scope="col" className="px-4 py-3 font-medium">Sitzung</th>
                    <th scope="col" className="px-4 py-3 font-medium">Status</th>
                    <th scope="col" className="px-4 py-3 font-medium">Einladung</th>
                    <th scope="col" className="px-4 py-3 font-medium">Beschlüsse</th>
                    <th scope="col" className="px-4 py-3 font-medium">Protokoll</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {rows.map((m) => (
                    <tr key={m.id} className="hover:bg-zinc-900/40">
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-zinc-300">{formatDateTimeCh(m.startsAt)}</td>
                      <td className="px-4 py-3">
                        <Link href={`/admin/meetings/${m.id}`} className="font-medium text-white hover:text-emerald-400">
                          {m.title}
                        </Link>
                        <div className="text-xs text-zinc-500">
                          {kindLabel(m.kind)}
                          {m.location && ` · ${m.location}`}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <MeetingStatusPill status={m.status} />
                      </td>
                      <td className="px-4 py-3 text-zinc-300">{m.invitationCount > 0 ? `${m.invitationCount} eingeladen` : <span className="text-zinc-600">–</span>}</td>
                      <td className="px-4 py-3 tabular-nums text-zinc-300">{m._count.resolutions || <span className="text-zinc-600">–</span>}</td>
                      <td className="px-4 py-3 text-zinc-300">{m.minutesApprovedAt ? "Genehmigt" : m.status === "DURCHGEFUEHRT" ? <span className="text-amber-300">Offen</span> : <span className="text-zinc-600">–</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Pager page={meta.page} totalPages={meta.totalPages} from={meta.from} to={meta.to} total={meta.total} noun="Sitzung" nounPlural="Sitzungen" hrefFor={(p) => href(p)} />
        </>
      )}
    </div>
  );
}
