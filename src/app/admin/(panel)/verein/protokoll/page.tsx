import type { Metadata } from "next";
import Link from "next/link";
import { Download, ScrollText, Search } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { EmptyState } from "@/components/admin/licenses/empty-state";
import { Pager } from "@/components/admin/licenses/pager";
import { Notice } from "@/components/admin/core/notice";
import { PageTitle } from "@/components/admin/core/page-title";
import { AuditTable } from "@/components/admin/verein/audit-table";
import { auditFacets, listAuditLog, parseAuditFilters } from "@/lib/verein/audit-data";
import { auditActionLabel, auditObjectLabel } from "@/lib/verein/audit-view";
import { requireModulePage } from "@/lib/verein/guard";
import { listHref, listParams, pageMeta } from "@/lib/verein/pagination";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Änderungsprotokoll" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function Page({ searchParams }: Props) {
  await requireModulePage("audit");
  const sp = await searchParams;
  const filters = parseAuditFilters(sp);
  const { page, pageSize } = listParams(sp);

  const first = await listAuditLog(filters, (page - 1) * pageSize, pageSize);
  const meta = pageMeta(first.total, page, pageSize);
  const [rows, facets] = await Promise.all([
    meta.page === page ? first.rows : listAuditLog(filters, (meta.page - 1) * pageSize, pageSize).then((r) => r.rows),
    auditFacets(),
  ]);

  const params = { q: filters.q, object: filters.objectType, action: filters.action, actor: filters.actorType, from: filters.from, to: filters.to };
  const href = (p: number) => listHref("/admin/verein/protokoll", { ...params, page: p });
  const exportHref = listHref("/api/admin/audit/export", params);
  const filtered = Object.values(params).some(Boolean);

  return (
    <div>
      <PageTitle title="Änderungsprotokoll" description="Wer hat wann was geändert? Sensible Änderungen an Mitgliedern, Beiträgen, Buchungen, Einstellungen und Rollen werden hier festgehalten. Das Protokoll lässt sich nicht bearbeiten oder löschen.">
        <a href={exportHref} className={buttonClass("secondary", "md")} download>
          <Download className="h-4 w-4" aria-hidden />
          CSV-Export
          <span className="sr-only"> der aktuellen Auswahl</span>
        </a>
      </PageTitle>

      <Notice variant="info" className="mb-6">
        Passwörter, Zugangsschlüssel und Prüfwerte erscheinen nie im Protokoll. Persönliche Angaben von Mitgliedern stehen nur als Vermerk «geändert» darin. Der CSV-Export enthält nur den Klartext und wird selbst protokolliert.
      </Notice>

      <form method="get" action="/admin/verein/protokoll" role="search" className="mb-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_11rem_13rem_9rem_9rem_9rem_auto_auto]">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <label htmlFor="audit-q" className="sr-only">
            Protokoll durchsuchen
          </label>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden />
          <Input id="audit-q" name="q" type="search" defaultValue={filters.q} maxLength={100} placeholder="Text, Name oder Objekt-ID" className="pl-9" />
        </div>
        <div>
          <label htmlFor="audit-object" className="sr-only">
            Objekt
          </label>
          <Select id="audit-object" name="object" defaultValue={filters.objectType}>
            <option value="">Alle Objekte</option>
            {facets.objectTypes.map((t) => (
              <option key={t} value={t}>
                {auditObjectLabel(t)}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="audit-action" className="sr-only">
            Aktion
          </label>
          <Select id="audit-action" name="action" defaultValue={filters.action}>
            <option value="">Alle Aktionen</option>
            {facets.actions.map((a) => (
              <option key={a} value={a}>
                {auditActionLabel(a)}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="audit-actor" className="sr-only">
            Art des Akteurs
          </label>
          <Select id="audit-actor" name="actor" defaultValue={filters.actorType}>
            <option value="">Alle Akteure</option>
            <option value="ADMIN">Verwaltung</option>
            <option value="MEMBER">Mitglied</option>
            <option value="SYSTEM">System</option>
          </Select>
        </div>
        <div>
          <label htmlFor="audit-from" className="sr-only">
            Von (Datum)
          </label>
          <Input id="audit-from" name="from" type="date" defaultValue={filters.from} title="Von" />
        </div>
        <div>
          <label htmlFor="audit-to" className="sr-only">
            Bis (Datum)
          </label>
          <Input id="audit-to" name="to" type="date" defaultValue={filters.to} title="Bis" />
        </div>
        <Button type="submit" variant="secondary">
          Filtern
        </Button>
        {filtered && (
          <Link href="/admin/verein/protokoll" className={buttonClass("ghost", "md")}>
            Zurücksetzen
          </Link>
        )}
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title={filtered ? "Keine passenden Einträge" : "Noch keine Einträge"}
          text={filtered ? "Zu diesen Filtern gibt es keine Einträge. Passe die Auswahl an oder setze sie zurück." : "Sobald im Verein etwas Wichtiges geändert wird, erscheint es hier."}
        />
      ) : (
        <>
          <AuditTable rows={rows} />
          <Pager page={meta.page} totalPages={meta.totalPages} from={meta.from} to={meta.to} total={meta.total} noun="Eintrag" nounPlural="Einträgen" hrefFor={href} />
        </>
      )}
    </div>
  );
}
