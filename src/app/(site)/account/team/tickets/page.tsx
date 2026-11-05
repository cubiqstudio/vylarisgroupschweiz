import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Inbox, MessageSquare, Search } from "lucide-react";
import { intlTag } from "@/i18n";
import { db } from "@/lib/db";
import { requireTeamPage, teamTicketCounts } from "@/lib/team";
import { TICKET_CATEGORY_LABEL, TICKET_STATUSES, TICKET_STATUS_LABEL } from "@/lib/constants";
import { cn, formatDateTime } from "@/lib/utils";
import { Button, buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/section";
import { Input, Select } from "@/components/ui/form";
import { categoryIcon } from "@/components/contact/ticket-category";
import { TicketCategoryBadge, TicketStatusBadge } from "@/components/admin/content/badges";
import { TicketAvatar } from "@/components/admin/content/ticket-avatar";
import { formatRelative, previewText } from "@/components/admin/content/ticket-format";
import { TICKET_PAGE_SIZE } from "@/components/admin/content/ticket-filters";
import { AssigneeChip } from "@/components/team/assignee";
import {
  TEAM_CATEGORIES,
  TEAM_TICKETS_PATH,
  parseTeamFilters,
  teamBaseWhere,
  teamFullWhere,
  teamTicketHref,
  teamTicketsHref,
} from "@/components/team/team-filters";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tickets – Team-Bereich", robots: { index: false, follow: false } };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function TeamTicketsPage({ searchParams }: Props) {
  const user = await requireTeamPage();
  const filters = parseTeamFilters(await searchParams);

  const [grouped, total, { open: openAll, mineOpen }] = await Promise.all([
    db.contactTicket.groupBy({ by: ["status"], where: teamBaseWhere(filters, user.id), _count: { _all: true } }),
    db.contactTicket.count({ where: teamFullWhere(filters, user.id) }),
    teamTicketCounts(user.id),
  ]);
  const counts: Record<string, number> = {};
  for (const g of grouped) counts[g.status] = g._count._all;
  const allCount = grouped.reduce((sum, g) => sum + g._count._all, 0);

  const totalPages = Math.max(1, Math.ceil(total / TICKET_PAGE_SIZE));
  const page = Math.min(filters.page, totalPages);

  const tickets = await db.contactTicket.findMany({
    where: teamFullWhere(filters, user.id),
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * TICKET_PAGE_SIZE,
    take: TICKET_PAGE_SIZE,
    select: {
      id: true,
      ticketNumber: true,
      name: true,
      email: true,
      subject: true,
      category: true,
      status: true,
      message: true,
      createdAt: true,
      assignedTo: { select: { id: true, name: true, avatarType: true } },
      _count: { select: { replies: true } },
    },
  });

  const hasFilter = Boolean(filters.status || filters.category || filters.q || filters.mine);
  const tabs = [
    { key: "" as const, label: "Alle", count: allCount },
    ...TICKET_STATUSES.map((s) => ({ key: s, label: TICKET_STATUS_LABEL[s], count: counts[s] ?? 0 })),
  ];
  const firstShown = (page - 1) * TICKET_PAGE_SIZE + 1;
  const lastShown = firstShown + tickets.length - 1;

  return (
    <Container className="py-10 sm:py-14">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Tickets</h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-zinc-400">
            Anfragen aus dem Kontaktformular. {openAll.toLocaleString(intlTag())} offen, {mineOpen.toLocaleString(intlTag())} davon dir zugewiesen und noch nicht
            geschlossen. Security-Reports bearbeiten ausschliesslich Administratoren.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Link
            href={teamTicketsHref({ ...filters, mine: !filters.mine, page: 1 })}
            aria-pressed={filters.mine}
            className={buttonClass(filters.mine ? "primary" : "secondary", "sm")}
          >
            Nur meine
          </Link>
        </div>
      </div>

      <nav aria-label="Status-Filter" className="-mx-1 mb-4 overflow-x-auto px-1 pb-1">
        <ul className="flex min-w-max gap-2">
          {tabs.map((t) => {
            const active = filters.status === t.key;
            return (
              <li key={t.key || "all"}>
                <Link
                  href={teamTicketsHref({ ...filters, status: t.key, page: 1 })}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-full pl-4 pr-2 text-sm font-medium ring-1 ring-inset transition-colors",
                    active ? "bg-ink text-surface ring-ink" : "bg-surface text-zinc-400 ring-zinc-800 hover:bg-zinc-900 hover:text-zinc-100",
                  )}
                >
                  {t.label}
                  <span
                    className={cn(
                      "min-w-6 rounded-full px-1.5 py-0.5 text-center text-xs tabular-nums",
                      active ? "bg-surface/20 text-surface" : "bg-zinc-900 text-zinc-400",
                    )}
                  >
                    {t.count}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <form method="get" action={TEAM_TICKETS_PATH} role="search" className="mb-6 grid gap-2 sm:grid-cols-[minmax(0,1fr)_14rem_auto]">
        {filters.status && <input type="hidden" name="status" value={filters.status} />}
        {filters.mine && <input type="hidden" name="mine" value="1" />}
        <div className="relative">
          <label htmlFor="ticket-q" className="sr-only">
            Tickets durchsuchen
          </label>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden />
          <Input
            id="ticket-q"
            name="q"
            type="search"
            defaultValue={filters.q}
            maxLength={100}
            placeholder="Suche nach Ticketnummer, Name, E-Mail oder Betreff"
            className="pl-9"
          />
        </div>
        <div>
          <label htmlFor="ticket-category" className="sr-only">
            Kategorie
          </label>
          <Select id="ticket-category" name="category" defaultValue={filters.category}>
            <option value="">Alle Kategorien</option>
            {TEAM_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {TICKET_CATEGORY_LABEL[c]}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex gap-2">
          <Button type="submit" variant="secondary" className="flex-1 sm:flex-none">
            Filtern
          </Button>
          {hasFilter && (
            <Link href={TEAM_TICKETS_PATH} className={buttonClass("ghost", "md")}>
              Zurücksetzen
            </Link>
          )}
        </div>
      </form>

      {tickets.length === 0 ? (
        <Card className="flex flex-col items-center px-6 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-surface text-emerald-400 ring-1 ring-inset ring-zinc-800" aria-hidden>
            {hasFilter ? <Search className="size-6" /> : <Inbox className="size-6" />}
          </span>
          <h3 className="mt-4 text-lg font-semibold text-white">{hasFilter ? "Keine passenden Tickets" : "Noch keine Anfragen"}</h3>
          <p className="mt-1.5 max-w-sm text-sm text-zinc-400">
            {hasFilter
              ? "Zu diesen Filtern gibt es keine Tickets. Passe Suche, Status oder Kategorie an."
              : "Sobald jemand das Kontaktformular auf der Website nutzt, erscheint die Anfrage hier."}
          </p>
          {hasFilter && (
            <Link href={TEAM_TICKETS_PATH} className={buttonClass("secondary", "md", "mt-6")}>
              Filter zurücksetzen
            </Link>
          )}
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden">
            <ul className="divide-y divide-zinc-800">
              {tickets.map((t) => {
                const CatIcon = categoryIcon(t.category);
                return (
                  <li key={t.id} className="relative flex gap-3.5 px-4 py-4 transition-colors hover:bg-zinc-950 sm:gap-4 sm:px-5">
                    <div className="relative shrink-0">
                      <TicketAvatar name={t.name} className="size-11" />
                      <span
                        className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-zinc-800 text-zinc-500 ring-2 ring-surface"
                        aria-hidden
                      >
                        <CatIcon className="size-3" />
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
                        <h3 className="min-w-0 break-words text-sm font-semibold text-white sm:text-base">
                          <Link
                            href={teamTicketHref(t.id, { ...filters, page })}
                            className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-emerald-400"
                          >
                            {t.subject}
                          </Link>
                        </h3>
                        <TicketStatusBadge status={t.status} />
                      </div>
                      <p className="mt-0.5 truncate text-xs text-zinc-400">
                        {t.name}
                        <span className="mx-1.5 text-zinc-700" aria-hidden>
                          ·
                        </span>
                        {t.email}
                      </p>
                      <p className="mt-2 line-clamp-2 break-words text-sm leading-relaxed text-zinc-500">{previewText(t.message)}</p>
                      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                        <span className="font-mono text-xs text-zinc-400">{t.ticketNumber}</span>
                        <TicketCategoryBadge category={t.category} />
                        {t._count.replies > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                            <MessageSquare className="h-3 w-3" aria-hidden />
                            {t._count.replies} {t._count.replies === 1 ? "Antwort" : "Antworten"}
                          </span>
                        )}
                        <span className="inline-flex min-w-0 items-center gap-1.5">
                          <span className="sr-only">Zuständig:</span>
                          <AssigneeChip user={t.assignedTo} size={20} className="max-w-48" />
                        </span>
                        <time dateTime={t.createdAt.toISOString()} className="text-xs text-zinc-500 sm:ml-auto">
                          {formatRelative(t.createdAt)}
                          <span className="text-zinc-500"> · {formatDateTime(t.createdAt)}</span>
                        </time>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>

          <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-sm text-zinc-500" aria-live="polite">
              {firstShown}–{lastShown} von {total} {total === 1 ? "Ticket" : "Tickets"}
            </p>
            {totalPages > 1 && (
              <nav aria-label="Seitennavigation" className="flex items-center gap-2">
                {page > 1 ? (
                  <Link href={teamTicketsHref({ ...filters, page: page - 1 })} className={buttonClass("secondary", "sm")} rel="prev">
                    <ChevronLeft className="h-4 w-4" aria-hidden />
                    Zurück
                  </Link>
                ) : (
                  <span className={buttonClass("secondary", "sm", "pointer-events-none opacity-50")} aria-disabled="true">
                    <ChevronLeft className="h-4 w-4" aria-hidden />
                    Zurück
                  </span>
                )}
                <span className="px-2 text-sm tabular-nums text-zinc-400">
                  Seite {page} von {totalPages}
                </span>
                {page < totalPages ? (
                  <Link href={teamTicketsHref({ ...filters, page: page + 1 })} className={buttonClass("secondary", "sm")} rel="next">
                    Weiter
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </Link>
                ) : (
                  <span className={buttonClass("secondary", "sm", "pointer-events-none opacity-50")} aria-disabled="true">
                    Weiter
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </span>
                )}
              </nav>
            )}
          </div>
        </>
      )}
    </Container>
  );
}
