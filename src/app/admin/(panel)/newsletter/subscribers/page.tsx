import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { ChevronLeft, ChevronRight, Download, Search, Users } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth";
import { containsCI } from "@/lib/search";
import { cn, formatDateTime } from "@/lib/utils";
import { Button, buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { BrandMark } from "@/components/contact/brand-mark";
import { NewsletterTop } from "@/components/admin/newsletter/newsletter-top";
import { SubscriberActions } from "@/components/admin/newsletter/subscriber-actions";
import { SubscriberStatusPill } from "@/components/admin/newsletter/status-pill";
import { SUBSCRIBER_PAGE_SIZE, SUBSCRIBER_STATUSES, SUBSCRIBER_STATUS_LABEL } from "@/components/admin/newsletter/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Newsletter-Abonnenten" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

function href(f: { status: string; q: string; page: number }) {
  const p = new URLSearchParams();
  if (f.status) p.set("status", f.status);
  if (f.q) p.set("q", f.q);
  if (f.page > 1) p.set("page", String(f.page));
  const qs = p.toString();
  return `/admin/newsletter/subscribers${qs ? `?${qs}` : ""}`;
}

export default async function AdminSubscribersPage({ searchParams }: Props) {
  await requireAdminPage();
  const sp = await searchParams;
  const rawStatus = first(sp.status);
  const status = (SUBSCRIBER_STATUSES as readonly string[]).includes(rawStatus) ? rawStatus : "";
  const q = first(sp.q).trim().slice(0, 100);
  const requestedPage = Math.max(1, Math.min(10_000, Number.parseInt(first(sp.page), 10) || 1));

  const where: Prisma.NewsletterSubscriberWhereInput = {};
  if (status) where.status = status;
  if (q) where.OR = [{ email: containsCI(q) }, { name: containsCI(q) }];

  const total = await db.newsletterSubscriber.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / SUBSCRIBER_PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const items = await db.newsletterSubscriber.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * SUBSCRIBER_PAGE_SIZE,
    take: SUBSCRIBER_PAGE_SIZE,
    select: { id: true, email: true, name: true, status: true, consentAt: true, confirmedAt: true, unsubscribedAt: true, createdAt: true },
  });

  const hasFilter = Boolean(status || q);
  const filters = [{ key: "", label: "Alle" }, ...SUBSCRIBER_STATUSES.map((s) => ({ key: s as string, label: SUBSCRIBER_STATUS_LABEL[s] }))];
  const exportHref = `/api/admin/newsletter/subscribers/export${status ? `?status=${status}` : ""}`;
  const from = (page - 1) * SUBSCRIBER_PAGE_SIZE + 1;
  const to = from + items.length - 1;

  return (
    <div>
      <NewsletterTop active="subscribers" />

      <nav aria-label="Status-Filter" className="-mx-1 mb-4 overflow-x-auto px-1 pb-1">
        <ul className="flex min-w-max gap-2">
          {filters.map((f) => {
            const active = status === f.key;
            return (
              <li key={f.key || "all"}>
                <Link
                  href={href({ status: f.key, q, page: 1 })}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-9 items-center rounded-full px-4 text-sm font-medium ring-1 ring-inset transition-colors",
                    active ? "bg-ink text-surface ring-ink" : "bg-surface text-zinc-400 ring-zinc-800 hover:bg-zinc-900 hover:text-zinc-100",
                  )}
                >
                  {f.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <form method="get" action="/admin/newsletter/subscribers" role="search" className="mb-6 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        {status && <input type="hidden" name="status" value={status} />}
        <div className="relative">
          <label htmlFor="subscriber-q" className="sr-only">
            Abonnenten durchsuchen
          </label>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" aria-hidden />
          <Input id="subscriber-q" name="q" type="search" defaultValue={q} maxLength={100} placeholder="Suche nach E-Mail-Adresse oder Name" className="pl-9" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="secondary" className="flex-1 sm:flex-none">
            Suchen
          </Button>
          {hasFilter && (
            <Link href="/admin/newsletter/subscribers" className={buttonClass("ghost", "md")}>
              Zurücksetzen
            </Link>
          )}
          <a href={exportHref} download className={buttonClass("secondary", "md", "flex-1 sm:flex-none")}>
            <Download className="size-4" aria-hidden />
            CSV-Export
          </a>
        </div>
      </form>

      {items.length === 0 ? (
        <Card className="flex flex-col items-center px-6 py-16 text-center">
          {hasFilter ? (
            <span className="flex size-16 items-center justify-center rounded-2xl bg-zinc-900 text-zinc-500 ring-1 ring-inset ring-zinc-800" aria-hidden>
              <Users className="size-7" />
            </span>
          ) : (
            <BrandMark tone="onLight" className="size-16 rounded-2xl" />
          )}
          <h2 className="mt-4 text-lg font-semibold text-white">{hasFilter ? "Keine passenden Abonnenten" : "Noch keine Abonnenten"}</h2>
          <p className="mt-1.5 max-w-sm text-sm text-zinc-400">
            {hasFilter
              ? "Zu diesen Filtern gibt es keine Einträge. Passe Suche oder Status an."
              : "Sobald sich jemand auf der Website anmeldet und die Adresse bestätigt, erscheint sie hier."}
          </p>
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] text-left text-sm">
                <caption className="sr-only">Newsletter-Abonnenten</caption>
                <thead className="border-b border-zinc-800 bg-zinc-950 text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium sm:px-5">Abonnent</th>
                    <th scope="col" className="px-4 py-3 font-medium">Status</th>
                    <th scope="col" className="px-4 py-3 font-medium">Zeitpunkte</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium sm:px-5">Aktionen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {items.map((s) => (
                    <tr key={s.id} className="align-top transition-colors hover:bg-zinc-950">
                      <td className="max-w-[16rem] px-4 py-3.5 sm:px-5">
                        <p className="break-all font-medium text-white">{s.email}</p>
                        {s.name && <p className="mt-0.5 break-words text-xs text-zinc-500">{s.name}</p>}
                      </td>
                      <td className="px-4 py-3.5">
                        <SubscriberStatusPill status={s.status} />
                      </td>
                      <td className="px-4 py-3.5 text-xs leading-relaxed text-zinc-500">
                        <p>Angemeldet: {formatDateTime(s.consentAt ?? s.createdAt)}</p>
                        {s.confirmedAt && <p>Bestätigt: {formatDateTime(s.confirmedAt)}</p>}
                        {s.unsubscribedAt && <p>Abgemeldet: {formatDateTime(s.unsubscribedAt)}</p>}
                      </td>
                      <td className="px-4 py-3.5 sm:px-5">
                        <SubscriberActions id={s.id} email={s.email} status={s.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-sm text-zinc-500" aria-live="polite">
              {from}–{to} von {total} {total === 1 ? "Abonnent" : "Abonnenten"}
            </p>
            {totalPages > 1 && (
              <nav aria-label="Seitennavigation" className="flex items-center gap-2">
                {page > 1 ? (
                  <Link href={href({ status, q, page: page - 1 })} className={buttonClass("secondary", "sm")} rel="prev">
                    <ChevronLeft className="size-4" aria-hidden />
                    Zurück
                  </Link>
                ) : (
                  <span className={buttonClass("secondary", "sm", "pointer-events-none opacity-50")} aria-disabled="true">
                    <ChevronLeft className="size-4" aria-hidden />
                    Zurück
                  </span>
                )}
                <span className="px-2 text-sm tabular-nums text-zinc-400">
                  Seite {page} von {totalPages}
                </span>
                {page < totalPages ? (
                  <Link href={href({ status, q, page: page + 1 })} className={buttonClass("secondary", "sm")} rel="next">
                    Weiter
                    <ChevronRight className="size-4" aria-hidden />
                  </Link>
                ) : (
                  <span className={buttonClass("secondary", "sm", "pointer-events-none opacity-50")} aria-disabled="true">
                    Weiter
                    <ChevronRight className="size-4" aria-hidden />
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
