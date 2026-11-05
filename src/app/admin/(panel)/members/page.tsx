import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowUp, Download, Search, UserPlus, Users } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { MEMBER_STATUS_LABEL, MEMBER_STATUSES } from "@/lib/verein/constants";
import { formatDateCh } from "@/lib/verein/dates";
import { requireModulePage } from "@/lib/verein/guard";
import { listMembers, listMembershipTypes, memberCounts, parseMemberFilters } from "@/lib/verein/members-data";
import { memberName } from "@/lib/verein/members-lib";
import type { MemberSort } from "@/lib/verein/members-schemas";
import { listHref, listParams, pageMeta } from "@/lib/verein/pagination";
import { canAccess } from "@/lib/verein/permissions";
import { PageTitle } from "@/components/admin/core/page-title";
import { Notice } from "@/components/admin/core/notice";
import { Pager } from "@/components/admin/licenses/pager";
import { EmptyState } from "@/components/admin/licenses/empty-state";
import { DueExitsButton } from "@/components/admin/members/due-exits-button";
import { MembersNav } from "@/components/admin/members/members-nav";
import { MemberStatusPill } from "@/components/admin/members/status-pill";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mitglieder" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const COLUMNS: Array<{ sort: MemberSort; label: string; className?: string }> = [
  { sort: "nr", label: "Nr.", className: "w-16" },
  { sort: "name", label: "Name" },
  { sort: "art", label: "Art", className: "hidden md:table-cell" },
  { sort: "status", label: "Status" },
  { sort: "ort", label: "Ort", className: "hidden md:table-cell" },
  { sort: "eintritt", label: "Eintritt", className: "hidden md:table-cell" },
];

export default async function AdminMembersPage({ searchParams }: Props) {
  const admin = await requireModulePage("members");
  const canWrite = canAccess(admin.roles, "members", "write");
  const sp = await searchParams;
  const filters = parseMemberFilters(sp);
  const { page, pageSize } = listParams(sp);

  const first = await listMembers(filters, (page - 1) * pageSize, pageSize);
  const meta = pageMeta(first.total, page, pageSize);
  const [rows, types, stats] = await Promise.all([
    meta.page === page ? first.rows : listMembers(filters, (meta.page - 1) * pageSize, pageSize).then((r) => r.rows),
    listMembershipTypes(),
    memberCounts(),
  ]);

  const base = { q: filters.q, status: filters.status, type: filters.typeId, sort: filters.sort === "name" ? "" : filters.sort, dir: filters.dir === "asc" ? "" : filters.dir };
  const href = (p: number, over: Partial<Record<keyof typeof base, string>> = {}) => listHref("/admin/members", { ...base, ...over, page: p });
  const exportHref = listHref("/api/admin/members/export", { q: filters.q, status: filters.status, type: filters.typeId, sort: filters.sort, dir: filters.dir });
  const filtered = Boolean(filters.q || filters.status || filters.typeId);

  const chips: Array<{ value: string; label: string; count: number }> = [
    { value: "", label: "Alle", count: Object.values(stats.counts).reduce((a, b) => a + b, 0) },
    { value: "ANTRAG", label: "Anträge", count: stats.counts.ANTRAG ?? 0 },
    { value: "AKTIV", label: "Aktiv", count: stats.counts.AKTIV ?? 0 },
    { value: "AUSTRITT", label: "Austritt vorgemerkt", count: stats.exitNotices },
    { value: "EHEMALIG", label: "Ehemalige", count: (stats.counts.AUSGETRETEN ?? 0) + (stats.counts.AUSGESCHLOSSEN ?? 0) + (stats.counts.VERSTORBEN ?? 0) },
    { value: "ABGELEHNT", label: "Abgelehnt", count: stats.counts.ABGELEHNT ?? 0 },
  ];

  return (
    <div>
      <PageTitle title="Mitglieder" description="Mitgliederverzeichnis des Vereins: Anträge prüfen, Stammdaten pflegen, Austritte erfassen. Es gelten die Statuten des Vereins.">
        <a href={exportHref} className={buttonClass("secondary", "md")} download>
          <Download className="h-4 w-4" aria-hidden />
          CSV-Export
          <span className="sr-only"> der aktuellen Auswahl</span>
        </a>
        {canWrite && (
          <Link href="/admin/members/new" className={buttonClass("primary", "md")}>
            <UserPlus className="h-4 w-4" aria-hidden />
            Neues Mitglied
          </Link>
        )}
      </PageTitle>

      <MembersNav />

      <div className="mb-6 space-y-3">
        {(stats.counts.ANTRAG ?? 0) > 0 && (
          <Notice variant="warning">
            <span className="font-medium">{stats.counts.ANTRAG === 1 ? "Ein Beitrittsantrag wartet" : `${stats.counts.ANTRAG} Beitrittsanträge warten`} auf die Prüfung.</span>{" "}
            <Link href="/admin/members?status=ANTRAG" className="underline underline-offset-2">
              Anträge anzeigen
            </Link>
          </Notice>
        )}
        {canWrite && stats.dueExits > 0 && (
          <Notice variant="info">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>
                {stats.dueExits === 1 ? "Bei einem Mitglied ist der Austrittstermin überschritten." : `Bei ${stats.dueExits} Mitgliedern ist der Austrittstermin überschritten.`} Sie gelten erst als ausgetreten, wenn du den Austritt vollziehst.
              </span>
              <DueExitsButton count={stats.dueExits} />
            </div>
          </Notice>
        )}
      </div>

      <nav aria-label="Status filtern" className="-mx-1 mb-4 overflow-x-auto px-1 pb-1">
        <ul className="flex min-w-max gap-1.5">
          {chips.map((c) => {
            const active = filters.status === c.value;
            return (
              <li key={c.value || "alle"}>
                <Link
                  href={href(1, { status: c.value })}
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

      <form method="get" action="/admin/members" role="search" className="mb-6 grid gap-2 sm:grid-cols-[1fr_12rem_12rem_auto_auto]">
        <input type="hidden" name="sort" value={filters.sort} />
        <input type="hidden" name="dir" value={filters.dir} />
        <div className="relative">
          <label htmlFor="member-q" className="sr-only">
            Mitglieder durchsuchen
          </label>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden />
          <Input id="member-q" name="q" type="search" defaultValue={filters.q} maxLength={100} placeholder="Name, Nummer, E-Mail oder Ort" className="pl-9" />
        </div>
        <div>
          <label htmlFor="member-status" className="sr-only">
            Status
          </label>
          <Select id="member-status" name="status" defaultValue={filters.status}>
            <option value="">Alle Status</option>
            {MEMBER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {MEMBER_STATUS_LABEL[s]}
              </option>
            ))}
            <option value="AUSTRITT">Austritt vorgemerkt</option>
            <option value="EHEMALIG">Alle Ehemaligen</option>
          </Select>
        </div>
        <div>
          <label htmlFor="member-type" className="sr-only">
            Mitgliedschaftsart
          </label>
          <Select id="member-type" name="type" defaultValue={filters.typeId}>
            <option value="">Alle Arten</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="secondary">
          Filtern
        </Button>
        {filtered && (
          <Link href="/admin/members" className={buttonClass("ghost", "md")}>
            Zurücksetzen
          </Link>
        )}
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title={filtered ? "Keine passenden Mitglieder" : "Noch keine Mitglieder"}
          text={filtered ? "Zu diesen Filtern gibt es keine Einträge. Passe die Auswahl an oder setze sie zurück." : "Erfasse das erste Mitglied von Hand oder schalte unter «Vereinseinstellungen» das Beitrittsformular frei, damit Anträge hier erscheinen."}
        />
      ) : (
        <>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm md:min-w-[44rem]">
                <caption className="sr-only">Mitglieder, sortiert nach {COLUMNS.find((c) => c.sort === filters.sort)?.label ?? "Name"}</caption>
                <thead className="border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    {COLUMNS.map((c) => {
                      const active = filters.sort === c.sort;
                      const nextDir = active && filters.dir === "asc" ? "desc" : "asc";
                      return (
                        <th key={c.sort} scope="col" className={cn("px-4 py-3 font-medium", c.className)} aria-sort={active ? (filters.dir === "asc" ? "ascending" : "descending") : undefined}>
                          <Link href={href(1, { sort: c.sort === "name" ? "" : c.sort, dir: nextDir === "asc" ? "" : "desc" })} className="inline-flex items-center gap-1 hover:text-zinc-200">
                            {c.label}
                            {active && (filters.dir === "asc" ? <ArrowUp className="h-3 w-3" aria-hidden /> : <ArrowDown className="h-3 w-3" aria-hidden />)}
                            <span className="sr-only">{active ? `, aktuell ${filters.dir === "asc" ? "aufsteigend" : "absteigend"}, umkehren` : ", sortieren"}</span>
                          </Link>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {rows.map((m) => (
                    <tr key={m.id} className="hover:bg-zinc-900/40">
                      <td className="px-4 py-3 tabular-nums text-zinc-400">{m.memberNumber}</td>
                      <td className="px-4 py-3">
                        <Link href={`/admin/members/${m.id}`} className="font-medium text-white hover:text-emerald-400">
                          {memberName(m)}
                        </Link>
                        {m.email && !m.anonymizedAt && <div className="break-all text-xs text-zinc-500">{m.email}</div>}
                        {/* Mobil: Art und Ort unter dem Namen (die Spalten sind dort ausgeblendet) */}
                        <div className="mt-0.5 text-xs text-zinc-400 md:hidden">{[m.membershipType?.name, m.anonymizedAt ? "" : m.city].filter(Boolean).join(" · ")}</div>
                      </td>
                      <td className="hidden px-4 py-3 text-zinc-300 md:table-cell">{m.membershipType?.name ?? <span className="text-zinc-600">–</span>}</td>
                      <td className="px-4 py-3">
                        <MemberStatusPill status={m.status} />
                        {m.status === "AKTIV" && m.exitNoticeAt && m.leftAt && <div className="mt-1 text-xs text-amber-300">Austritt {formatDateCh(m.leftAt)}</div>}
                      </td>
                      <td className="hidden px-4 py-3 text-zinc-300 md:table-cell">{m.anonymizedAt ? "" : m.city || <span className="text-zinc-600">–</span>}</td>
                      <td className="hidden px-4 py-3 tabular-nums text-zinc-400 md:table-cell">{m.joinedAt ? formatDateCh(m.joinedAt) : "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Pager page={meta.page} totalPages={meta.totalPages} from={meta.from} to={meta.to} total={meta.total} noun="Eintrag" nounPlural="Einträgen" hrefFor={(p) => href(p)} />
        </>
      )}
    </div>
  );
}

