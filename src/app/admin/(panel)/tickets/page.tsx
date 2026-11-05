import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, ChevronLeft, ChevronRight, CircleDot, Hourglass, Inbox, MailCheck, MessageSquare, Search, ShieldAlert, type LucideIcon } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth";
import { getTicketMailSettings } from "@/lib/settings";
import { isMailConfigured } from "@/lib/mailer";
import { TICKET_CATEGORIES, TICKET_CATEGORY_LABEL, TICKET_STATUSES, TICKET_STATUS_LABEL } from "@/lib/constants";
import { cn, formatDateTime } from "@/lib/utils";
import { Button, buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { categoryIcon } from "@/components/contact/ticket-category";
import { ContentHeader } from "@/components/admin/content/page-header";
import { TicketCategoryBadge, TicketStatusBadge } from "@/components/admin/content/badges";
import { AssigneeChip } from "@/components/team/assignee";
import { TicketAvatar } from "@/components/admin/content/ticket-avatar";
import { TicketMailSettings } from "@/components/admin/content/ticket-mail-settings";
import { formatRelative, previewText } from "@/components/admin/content/ticket-format";
import {
  TICKET_PAGE_SIZE,
  baseWhere,
  buildTicketQuery,
  fullWhere,
  inboxHref,
  parseTicketFilters,
} from "@/components/admin/content/ticket-filters";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ticket-Inbox" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function Kpi({
  label,
  value,
  href,
  icon: Icon,
  tone,
  detail,
}: {
  label: string;
  value: number;
  href: string;
  icon: LucideIcon;
  tone: string;
  detail?: string;
}) {
  return (
    <Link
      href={href}
      className="group block rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
    >
      <Card className="h-full p-4 transition-colors group-hover:border-zinc-700 group-hover:bg-zinc-950 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-zinc-400">{label}</p>
          <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset", tone)} aria-hidden>
            <Icon className="size-[18px]" />
          </span>
        </div>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-white tabular-nums">{value.toLocaleString("de-DE")}</p>
        {detail && <p className="mt-0.5 text-xs text-zinc-500">{detail}</p>}
      </Card>
    </Link>
  );
}

export default async function AdminTicketsPage({ searchParams }: Props) {
  await requireAdminPage();
  const filters = parseTicketFilters(await searchParams);

  const [grouped, total, overall, securityOpen, mailSettings, mailConfigured] = await Promise.all([
    db.contactTicket.groupBy({ by: ["status"], where: baseWhere(filters), _count: { _all: true } }),
    db.contactTicket.count({ where: fullWhere(filters) }),
    db.contactTicket.groupBy({ by: ["status"], _count: { _all: true } }),
    db.contactTicket.count({ where: { category: "SECURITY_REPORT", status: { not: "CLOSED" } } }),
    getTicketMailSettings(),
    isMailConfigured(),
  ]);
  const totals: Record<string, number> = {};
  for (const g of overall) totals[g.status] = g._count._all;

  const counts: Record<string, number> = {};
  for (const g of grouped) counts[g.status] = g._count._all;
  const allCount = grouped.reduce((sum, g) => sum + g._count._all, 0);

  const totalPages = Math.max(1, Math.ceil(total / TICKET_PAGE_SIZE));
  const page = Math.min(filters.page, totalPages);

  const tickets = await db.contactTicket.findMany({
    where: fullWhere(filters),
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

  const hasFilter = Boolean(filters.status || filters.category || filters.q);
  const listQuery = buildTicketQuery({ ...filters, page });
  const from = listQuery ? `?from=${encodeURIComponent(listQuery)}` : "";

  const tabs = [
    { key: "" as const, label: "Alle", count: allCount },
    ...TICKET_STATUSES.map((s) => ({ key: s, label: TICKET_STATUS_LABEL[s], count: counts[s] ?? 0 })),
  ];

  const from_ = (page - 1) * TICKET_PAGE_SIZE + 1;
  const to_ = from_ + tickets.length - 1;

  return (
    <div>
      <ContentHeader
        title="Ticket-Inbox"
        description="Anfragen aus dem Kontaktformular. Security-Reports sind hervorgehoben und sollten zuerst bearbeitet werden."
      />

      <TicketMailSettings initial={mailSettings} mailConfigured={mailConfigured} />

      <section aria-label="Kennzahlen" className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="Offen"
          value={totals.OPEN ?? 0}
          href={inboxHref({ status: "OPEN" })}
          icon={CircleDot}
          tone="bg-amber-500/10 text-amber-300 ring-amber-500/30"
          detail="Warten auf Bearbeitung"
        />
        <Kpi
          label="In Bearbeitung"
          value={totals.IN_PROGRESS ?? 0}
          href={inboxHref({ status: "IN_PROGRESS" })}
          icon={Hourglass}
          tone="bg-indigo-500/10 text-indigo-300 ring-indigo-500/30"
        />
        <Kpi
          label="Geschlossen"
          value={totals.CLOSED ?? 0}
          href={inboxHref({ status: "CLOSED" })}
          icon={CheckCircle2}
          tone="bg-green-500/10 text-green-800 ring-green-600/30"
        />
        <Kpi
          label="Security-Reports offen"
          value={securityOpen}
          href={inboxHref({ category: "SECURITY_REPORT" })}
          icon={ShieldAlert}
          tone="bg-rose-500/10 text-rose-300 ring-rose-500/40"
          detail="Noch nicht geschlossen"
        />
      </section>

      <nav aria-label="Status-Filter" className="-mx-1 mb-4 overflow-x-auto px-1 pb-1">
        <ul className="flex min-w-max gap-2">
          {tabs.map((t) => {
            const active = filters.status === t.key;
            return (
              <li key={t.key || "all"}>
                <Link
                  href={inboxHref({ ...filters, status: t.key, page: 1 })}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-full pl-4 pr-2 text-sm font-medium ring-1 ring-inset transition-colors",
                    active
                      ? "bg-ink text-surface ring-ink"
                      : "bg-surface text-zinc-400 ring-zinc-800 hover:bg-zinc-900 hover:text-zinc-100",
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

      <form method="get" action="/admin/tickets" role="search" className="mb-6 grid gap-2 sm:grid-cols-[minmax(0,1fr)_14rem_auto]">
        {filters.status && <input type="hidden" name="status" value={filters.status} />}
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
            {TICKET_CATEGORIES.map((c) => (
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
            <Link href="/admin/tickets" className={buttonClass("ghost", "md")}>
              Zurücksetzen
            </Link>
          )}
        </div>
      </form>

      {tickets.length === 0 ? (
        <Card className="flex flex-col items-center px-6 py-16 text-center">
          <span className="relative flex size-24 items-center justify-center" aria-hidden>
            <span className="absolute inset-0 rounded-full bg-emerald-400/10" />
            <span className="absolute inset-3 rounded-full bg-emerald-400/10 ring-1 ring-inset ring-emerald-400/20" />
            <span className="relative flex size-12 items-center justify-center rounded-2xl bg-surface text-emerald-400 shadow-md shadow-slate-900/10 ring-1 ring-inset ring-zinc-800">
              {hasFilter ? <Search className="size-6" /> : <Inbox className="size-6" />}
            </span>
            {!hasFilter && (
              <span className="absolute bottom-2 right-1 flex size-7 items-center justify-center rounded-full bg-emerald-400 text-surface ring-4 ring-surface">
                <MailCheck className="size-3.5" />
              </span>
            )}
          </span>
          <h2 className="mt-4 text-lg font-semibold text-white">{hasFilter ? "Keine passenden Tickets" : "Noch keine Anfragen"}</h2>
          <p className="mt-1.5 max-w-sm text-sm text-zinc-400">
            {hasFilter
              ? "Zu diesen Filtern gibt es keine Tickets. Passe Suche, Status oder Kategorie an."
              : "Sobald jemand das Kontaktformular auf der Website nutzt, erscheint die Anfrage hier."}
          </p>
          {hasFilter && (
            <Link href="/admin/tickets" className={buttonClass("secondary", "md", "mt-6")}>
              Filter zurücksetzen
            </Link>
          )}
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden">
            <ul className="divide-y divide-zinc-800">
              {tickets.map((t) => {
                const security = t.category === "SECURITY_REPORT";
                const CatIcon = categoryIcon(t.category);
                return (
                  <li
                    key={t.id}
                    className={cn(
                      "relative flex gap-3.5 px-4 py-4 transition-colors hover:bg-zinc-950 sm:gap-4 sm:px-5",
                      security && "border-l-4 border-l-rose-500/70 bg-rose-500/[0.04] hover:bg-rose-500/[0.07]",
                    )}
                  >
                    <div className="relative shrink-0">
                      <TicketAvatar name={t.name} className="size-11" />
                      <span
                        className={cn(
                          "absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full ring-2 ring-surface",
                          security ? "bg-rose-500 text-surface" : "bg-zinc-800 text-zinc-500",
                        )}
                        aria-hidden
                      >
                        <CatIcon className="size-3" />
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
                        <h2 className="min-w-0 break-words text-sm font-semibold text-white sm:text-base">
                          <Link
                            href={`/admin/tickets/${t.id}${from}`}
                            className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-emerald-400"
                          >
                            {t.subject}
                          </Link>
                        </h2>
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
                        <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-zinc-500">
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
              {from_}–{to_} von {total} {total === 1 ? "Ticket" : "Tickets"}
            </p>
            {totalPages > 1 && (
              <nav aria-label="Seitennavigation" className="flex items-center gap-2">
                {page > 1 ? (
                  <Link href={inboxHref({ ...filters, page: page - 1 })} className={buttonClass("secondary", "sm")} rel="prev">
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
                  <Link href={inboxHref({ ...filters, page: page + 1 })} className={buttonClass("secondary", "sm")} rel="next">
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
    </div>
  );
}
