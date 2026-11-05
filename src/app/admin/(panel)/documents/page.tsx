import type { Metadata } from "next";
import Link from "next/link";
import { Download, FolderOpen, Search } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { DOCUMENT_CATEGORIES, DOCUMENT_CATEGORY_LABEL, DOCUMENT_VISIBILITIES, DOCUMENT_VISIBILITY_LABEL } from "@/lib/verein/constants";
import { formatDateCh } from "@/lib/verein/dates";
import { documentCounts, listDocuments, listMeetingOptions } from "@/lib/verein/documents-data";
import { parseDocumentFilters } from "@/lib/verein/documents-lib";
import { formatFileSize } from "@/lib/verein/documents-meta";
import { requireModulePage } from "@/lib/verein/guard";
import { firstParam, listHref, listParams, pageMeta } from "@/lib/verein/pagination";
import { canAccess } from "@/lib/verein/permissions";
import { PageTitle } from "@/components/admin/core/page-title";
import { Notice } from "@/components/admin/core/notice";
import { Pager } from "@/components/admin/licenses/pager";
import { EmptyState } from "@/components/admin/licenses/empty-state";
import { ArchivedPill, CategoryPill, VisibilityPill } from "@/components/admin/documents/pills";
import { NewDocumentButton } from "@/components/admin/documents/new-document-button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dokumente" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AdminDocumentsPage({ searchParams }: Props) {
  const admin = await requireModulePage("documents");
  const canWrite = canAccess(admin.roles, "documents", "write");
  const sp = await searchParams;
  const filters = parseDocumentFilters((k) => firstParam(sp, k));
  const { page, pageSize } = listParams(sp);

  const first = await listDocuments(filters, (page - 1) * pageSize, pageSize);
  const meta = pageMeta(first.total, page, pageSize);
  const [rows, counts, meetings] = await Promise.all([
    meta.page === page ? first.rows : listDocuments(filters, (meta.page - 1) * pageSize, pageSize).then((r) => r.rows),
    documentCounts(),
    canWrite ? listMeetingOptions() : Promise.resolve([]),
  ]);

  const base = { q: filters.q, category: filters.category, visibility: filters.visibility, archived: filters.archived ? "1" : "" };
  const href = (p: number, over: Partial<Record<keyof typeof base, string>> = {}) => listHref("/admin/documents", { ...base, ...over, page: p });
  const filtered = Boolean(filters.q || filters.category || filters.visibility);

  return (
    <div>
      <PageTitle title="Dokumente" description="Statuten, Reglemente, Protokolle und weitere Unterlagen des Vereins. Neue Fassungen werden als Version abgelegt; frühere Fassungen bleiben abrufbar.">
        {canWrite && <NewDocumentButton meetings={meetings.map((m) => ({ id: m.id, label: `${m.title} (${formatDateCh(m.startsAt)})` }))} />}
      </PageTitle>

      <nav aria-label="Aktive und archivierte Dokumente" className="-mx-1 mb-4 overflow-x-auto px-1 pb-1">
        <ul className="flex min-w-max gap-1.5">
          {[
            { archived: false, label: "Aktiv", count: counts.active },
            { archived: true, label: "Archiv", count: counts.archived },
          ].map((c) => {
            const on = filters.archived === c.archived;
            return (
              <li key={c.label}>
                <Link
                  href={href(1, { archived: c.archived ? "1" : "" })}
                  aria-current={on ? "true" : undefined}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-medium ring-1 ring-inset transition-colors",
                    on ? "bg-zinc-900 text-white ring-zinc-700" : "bg-zinc-900/50 text-zinc-400 ring-zinc-800 hover:bg-zinc-900 hover:text-zinc-100",
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

      <form method="get" action="/admin/documents" role="search" className="mb-6 grid gap-2 sm:grid-cols-[1fr_11rem_11rem_auto_auto]">
        {filters.archived && <input type="hidden" name="archived" value="1" />}
        <div className="relative">
          <label htmlFor="doc-q" className="sr-only">
            Dokumente durchsuchen
          </label>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden />
          <Input id="doc-q" name="q" type="search" defaultValue={filters.q} maxLength={100} placeholder="Titel oder Beschreibung" className="pl-9" />
        </div>
        <div>
          <label htmlFor="doc-category" className="sr-only">
            Kategorie
          </label>
          <Select id="doc-category" name="category" defaultValue={filters.category}>
            <option value="">Alle Kategorien</option>
            {DOCUMENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {DOCUMENT_CATEGORY_LABEL[c]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="doc-visibility" className="sr-only">
            Sichtbarkeit
          </label>
          <Select id="doc-visibility" name="visibility" defaultValue={filters.visibility}>
            <option value="">Jede Sichtbarkeit</option>
            {DOCUMENT_VISIBILITIES.map((v) => (
              <option key={v} value={v}>
                {DOCUMENT_VISIBILITY_LABEL[v]}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="secondary">
          Filtern
        </Button>
        {filtered && (
          <Link href={filters.archived ? "/admin/documents?archived=1" : "/admin/documents"} className={buttonClass("ghost", "md")}>
            Zurücksetzen
          </Link>
        )}
      </form>

      {!canWrite && (
        <div className="mb-6">
          <Notice variant="info">Du kannst Dokumente ansehen und herunterladen. Hochladen und Ändern ist anderen Rollen vorbehalten.</Notice>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title={filtered ? "Keine passenden Dokumente" : filters.archived ? "Das Archiv ist leer" : "Noch keine Dokumente"}
          text={
            filtered
              ? "Zu diesen Filtern gibt es keine Einträge. Passe die Auswahl an oder setze sie zurück."
              : filters.archived
                ? "Archivierte Dokumente erscheinen hier."
                : canWrite
                  ? "Lade die Statuten, Reglemente oder Protokolle des Vereins hoch. Die Sichtbarkeit bestimmst du pro Dokument."
                  : "Es sind noch keine Dokumente hochgeladen."
          }
        />
      ) : (
        <>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[48rem] text-left text-sm">
                <caption className="sr-only">Dokumente, zuletzt geänderte zuerst</caption>
                <thead className="border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">Titel</th>
                    <th scope="col" className="px-4 py-3 font-medium">Kategorie</th>
                    <th scope="col" className="px-4 py-3 font-medium">Sichtbarkeit</th>
                    <th scope="col" className="px-4 py-3 font-medium">Fassung</th>
                    <th scope="col" className="px-4 py-3 font-medium">Geändert</th>
                    <th scope="col" className="px-4 py-3 font-medium"><span className="sr-only">Herunterladen</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {rows.map((d) => {
                    const v = d.versions[0];
                    return (
                      <tr key={d.id} className="hover:bg-zinc-900/40">
                        <td className="max-w-[22rem] px-4 py-3">
                          <Link href={`/admin/documents/${d.id}`} className="font-medium text-white hover:text-emerald-400 [overflow-wrap:anywhere]">
                            {d.title}
                          </Link>
                          {d.archivedAt && (
                            <span className="ml-2 align-middle">
                              <ArchivedPill />
                            </span>
                          )}
                          {d.description && <div className="line-clamp-1 text-xs text-zinc-500">{d.description}</div>}
                          {d.meeting && <div className="text-xs text-zinc-500">Sitzung: {d.meeting.title}</div>}
                        </td>
                        <td className="px-4 py-3"><CategoryPill category={d.category} /></td>
                        <td className="px-4 py-3"><VisibilityPill visibility={d.visibility} /></td>
                        <td className="px-4 py-3 text-zinc-300">
                          <span className="tabular-nums">Version {d.currentVersion}</span>
                          {v && <div className="text-xs text-zinc-500">{formatFileSize(v.sizeBytes)}</div>}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-zinc-400">{formatDateCh(d.updatedAt)}</td>
                        <td className="px-4 py-3 text-right">
                          <a href={`/api/admin/documents/${d.id}/download`} download className={buttonClass("ghost", "sm")}>
                            <Download className="h-4 w-4" aria-hidden />
                            <span className="sr-only">{d.title} herunterladen</span>
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
          <Pager page={meta.page} totalPages={meta.totalPages} from={meta.from} to={meta.to} total={meta.total} noun="Dokument" nounPlural="Dokumenten" hrefFor={(p) => href(p)} />
        </>
      )}
    </div>
  );
}
