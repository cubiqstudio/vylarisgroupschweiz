import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, CalendarPlus, Search } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { eventViewCounts, listEventsAdmin, parseEventFilters } from "@/lib/verein/events-data";
import { EVENT_VIEW_LABEL, EVENT_VIEWS, formatEventWhen } from "@/lib/verein/events-lib";
import { requireModulePage } from "@/lib/verein/guard";
import { listHref, listParams, pageMeta } from "@/lib/verein/pagination";
import { canAccess } from "@/lib/verein/permissions";
import { PageTitle } from "@/components/admin/core/page-title";
import { EventStatusPill, visibilityLabel } from "@/components/admin/events/status-pill";
import { EmptyState } from "@/components/admin/licenses/empty-state";
import { Pager } from "@/components/admin/licenses/pager";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Anlässe" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Anlässe des Vereins: planen, veröffentlichen, Anmeldungen im Blick behalten. */
export default async function AdminEventsPage({ searchParams }: Props) {
  const admin = await requireModulePage("events");
  const canWrite = canAccess(admin.roles, "events", "write");
  const sp = await searchParams;
  const filters = parseEventFilters(sp);
  const { page, pageSize } = listParams(sp);

  const first = await listEventsAdmin(filters, (page - 1) * pageSize, pageSize);
  const meta = pageMeta(first.total, page, pageSize);
  const [rows, counts] = await Promise.all([meta.page === page ? first.rows : listEventsAdmin(filters, (meta.page - 1) * pageSize, pageSize).then((r) => r.rows), eventViewCounts()]);

  const base = { q: filters.q, view: filters.view === "kommend" ? "" : filters.view };
  const href = (p: number, over: Partial<Record<keyof typeof base, string>> = {}) => listHref("/admin/events", { ...base, ...over, page: p });
  const now = new Date();

  return (
    <div>
      <PageTitle title="Anlässe" description="Anlässe planen und veröffentlichen, Anmeldungen und Warteliste verwalten, Teilnehmerlisten exportieren.">
        {canWrite && (
          <Link href="/admin/events/new" className={buttonClass("primary", "md")}>
            <CalendarPlus className="h-4 w-4" aria-hidden />
            Neuer Anlass
          </Link>
        )}
      </PageTitle>

      <nav aria-label="Ansicht wählen" className="-mx-1 mb-4 overflow-x-auto px-1 pb-1">
        <ul className="flex min-w-max gap-1.5">
          {EVENT_VIEWS.map((v) => {
            const active = filters.view === v;
            return (
              <li key={v}>
                <Link
                  href={href(1, { view: v === "kommend" ? "" : v })}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-medium ring-1 ring-inset transition-colors",
                    active ? "bg-zinc-900 text-white ring-zinc-700" : "bg-zinc-900/50 text-zinc-400 ring-zinc-800 hover:bg-zinc-900 hover:text-zinc-100",
                  )}
                >
                  {EVENT_VIEW_LABEL[v]}
                  <span className="tabular-nums text-xs text-zinc-500">{counts[v]}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <form method="get" action="/admin/events" role="search" className="mb-6 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <input type="hidden" name="view" value={filters.view === "kommend" ? "" : filters.view} />
        <div className="relative">
          <label htmlFor="event-q" className="sr-only">
            Anlässe durchsuchen
          </label>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden />
          <Input id="event-q" name="q" type="search" defaultValue={filters.q} maxLength={100} placeholder="Titel oder Ort" className="pl-9" />
        </div>
        <Button type="submit" variant="secondary">
          Suchen
        </Button>
        {filters.q && (
          <Link href={href(1, { q: "" })} className={buttonClass("ghost", "md")}>
            Zurücksetzen
          </Link>
        )}
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={filters.q ? "Keine passenden Anlässe" : filters.view === "kommend" ? "Keine kommenden Anlässe" : `Keine ${EVENT_VIEW_LABEL[filters.view].toLowerCase()} Anlässe`}
          text={filters.q ? "Zu diesem Suchbegriff gibt es keine Einträge in dieser Ansicht." : canWrite ? "Lege den ersten Anlass an. Er bleibt ein Entwurf, bis du ihn veröffentlichst." : "Es sind noch keine Anlässe erfasst."}
        />
      ) : (
        <>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[46rem] text-left text-sm">
                <caption className="sr-only">Anlässe, {EVENT_VIEW_LABEL[filters.view]}</caption>
                <thead className="border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Anlass
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Datum und Zeit
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Anmeldungen
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {rows.map((e) => {
                    const full = e.capacity !== null && e.seats.taken >= e.capacity;
                    const past = (e.endsAt ?? e.startsAt).getTime() < now.getTime();
                    return (
                      <tr key={e.id} className="align-top hover:bg-zinc-900/40">
                        <td className="px-4 py-3">
                          <Link href={`/admin/events/${e.id}`} className="font-medium text-white hover:text-emerald-400">
                            {e.title}
                          </Link>
                          <div className="text-xs text-zinc-500">
                            {e.location && <span>{e.location} · </span>}
                            {visibilityLabel(e.isPublic, e.membersOnly)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-zinc-300">
                          {formatEventWhen(e.startsAt, e.endsAt)}
                          {past && e.status === "VEROEFFENTLICHT" && <div className="text-xs text-zinc-500">Vorbei</div>}
                        </td>
                        <td className="px-4 py-3">
                          <EventStatusPill status={e.status} />
                        </td>
                        <td className="px-4 py-3 tabular-nums text-zinc-300">
                          {e.registrations === 0 ? (
                            e.unconfirmed === 0 && <span className="text-zinc-600">–</span>
                          ) : (
                            <>
                              <span className={cn(full && "text-amber-300")}>{e.capacity === null ? `${e.seats.taken}` : `${e.seats.taken} / ${e.capacity}`}</span>
                              <span className="text-zinc-500"> {e.seats.taken === 1 ? "Person" : "Personen"}</span>
                              {e.seats.waiting > 0 && <div className="text-xs text-amber-300">+ {e.seats.waiting} auf der Warteliste</div>}
                            </>
                          )}
                          {e.unconfirmed > 0 && <div className="text-xs text-sky-300">{e.unconfirmed} E-Mail noch nicht bestätigt</div>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
          <Pager page={meta.page} totalPages={meta.totalPages} from={meta.from} to={meta.to} total={meta.total} noun="Anlass" nounPlural="Anlässen" hrefFor={(p) => href(p)} />
        </>
      )}
    </div>
  );
}
