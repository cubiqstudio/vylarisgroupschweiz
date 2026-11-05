import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Search, Users } from "lucide-react";
import { db } from "@/lib/db";
import { containsCI } from "@/lib/search";
import { requireModulePage } from "@/lib/verein/guard";
import { cn, formatDateTime } from "@/lib/utils";
import { Button, buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { PageTitle } from "@/components/admin/core/page-title";
import { PILL } from "@/components/admin/core/styles";
import { UserActions } from "@/components/admin/settings/user-actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Benutzer" };

const PAGE_SIZE = 25;

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

function href(q: string, page: number) {
  const sp = new URLSearchParams();
  if (q) sp.set("q", q);
  if (page > 1) sp.set("page", String(page));
  const s = sp.toString();
  return s ? `/admin/users?${s}` : "/admin/users";
}

export default async function AdminUsersPage({ searchParams }: Props) {
  await requireModulePage("website");
  const sp = await searchParams;
  const q = first(sp.q).trim().slice(0, 100);
  const requestedPage = Math.max(1, Number.parseInt(first(sp.page), 10) || 1);

  // `contains` ist unter SQLite case-insensitive; src/lib/search.ts (containsCI) gab es in diesem Stand noch nicht.
  const where = q ? { OR: [{ name: containsCI(q) }, { email: containsCI(q) }] } : {};

  const [totalAll, verified, disabledCount, total] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { emailVerifiedAt: { not: null } } }),
    db.user.count({ where: { disabled: true } }),
    db.user.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);

  const users = await db.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      name: true,
      email: true,
      emailVerifiedAt: true,
      disabled: true,
      lastLoginAt: true,
      createdAt: true,
      isTeam: true,
      teamTitle: true,
      businessStatus: true,
      companyName: true,
    },
  });

  const from = (page - 1) * PAGE_SIZE + 1;
  const to = from + users.length - 1;

  const stats = [
    { label: "Gesamt", value: totalAll },
    { label: "E-Mail bestätigt", value: verified },
    { label: "Gesperrt", value: disabledCount },
  ];

  return (
    <div>
      <PageTitle title="Benutzer" description="Website-Konten, die sich über die Registrierung angemeldet haben. Hier kannst du Nutzer ins Team aufnehmen (Team-Bereich und Profilbild). Administratoren werden hier nicht aufgeführt." />

      <dl className="mb-6 grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <dt className="text-xs font-medium text-zinc-400 sm:text-sm">{s.label}</dt>
            <dd className="mt-1.5 text-2xl font-semibold tabular-nums text-white">{s.value}</dd>
          </Card>
        ))}
      </dl>

      <form method="get" action="/admin/users" role="search" className="mb-6 flex gap-2">
        <div className="relative flex-1">
          <label htmlFor="user-q" className="sr-only">
            Benutzer durchsuchen
          </label>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden />
          <Input id="user-q" name="q" type="search" defaultValue={q} maxLength={100} placeholder="Suche nach Name oder E-Mail" className="pl-9" />
        </div>
        <Button type="submit" variant="secondary">
          Suchen
        </Button>
        {q && (
          <Link href="/admin/users" className={buttonClass("ghost", "md")}>
            Zurücksetzen
          </Link>
        )}
      </form>

      {users.length === 0 ? (
        <Card className="flex flex-col items-center px-6 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800/80 text-zinc-400 ring-1 ring-inset ring-zinc-700">
            <Users className="h-5 w-5" aria-hidden />
          </span>
          <h2 className="mt-4 text-lg font-semibold text-white">{q ? "Keine passenden Benutzer" : "Noch keine Website-Nutzer"}</h2>
          <p className="mt-1.5 max-w-sm text-sm text-zinc-400">
            {q
              ? "Zu dieser Suche gibt es keine Konten. Prüfe die Schreibweise oder suche nach einem Teil der E-Mail-Adresse."
              : "Sobald sich jemand über die Registrierung anmeldet, erscheint das Konto hier. Die Registrierung aktivierst du unter Einstellungen."}
          </p>
          {q ? (
            <Link href="/admin/users" className={buttonClass("secondary", "md", "mt-6")}>
              Suche zurücksetzen
            </Link>
          ) : (
            <Link href="/admin/settings#registrierung" className={buttonClass("secondary", "md", "mt-6")}>
              Zu den Einstellungen
            </Link>
          )}
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden">
            <ul className="divide-y divide-zinc-800">
              {users.map((u) => (
                <li key={u.id} className="px-4 py-4 sm:px-5">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                    <h2 className="text-sm font-semibold text-white sm:text-base">{u.name}</h2>
                    <span
                      className={cn(
                        PILL,
                        u.emailVerifiedAt ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30" : "bg-amber-500/10 text-amber-300 ring-amber-500/30",
                      )}
                    >
                      {u.emailVerifiedAt ? "Bestätigt" : "Unbestätigt"}
                    </span>
                    {u.disabled && <span className={cn(PILL, "bg-rose-500/10 text-rose-300 ring-rose-500/30")}>Gesperrt</span>}
                    {u.isTeam && (
                      <span className={cn(PILL, "bg-sky-500/10 text-sky-300 ring-sky-500/30")}>
                        Team{u.teamTitle ? ` · ${u.teamTitle}` : ""}
                      </span>
                    )}
                    {u.businessStatus === "APPROVED" && (
                      <span className={cn(PILL, "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30")}>
                        Firmenkunde{u.companyName ? ` · ${u.companyName}` : ""}
                      </span>
                    )}
                    {u.businessStatus === "PENDING" && (
                      <span className={cn(PILL, "bg-amber-500/10 text-amber-300 ring-amber-500/30")}>
                        Firmenkunde beantragt{u.companyName ? `: ${u.companyName}` : ""}
                      </span>
                    )}
                    {u.businessStatus === "REJECTED" && (
                      <span className={cn(PILL, "bg-zinc-800/80 text-zinc-400 ring-zinc-700")}>
                        Firmenkunde abgelehnt{u.companyName ? `: ${u.companyName}` : ""}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 break-all text-sm text-zinc-400">{u.email}</p>
                  <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-zinc-500">
                    <div className="flex gap-1.5">
                      <dt>Registriert:</dt>
                      <dd>
                        <time dateTime={u.createdAt.toISOString()}>{formatDateTime(u.createdAt)}</time>
                      </dd>
                    </div>
                    <div className="flex gap-1.5">
                      <dt>Letzter Login:</dt>
                      <dd>{u.lastLoginAt ? <time dateTime={u.lastLoginAt.toISOString()}>{formatDateTime(u.lastLoginAt)}</time> : "noch nie"}</dd>
                    </div>
                  </dl>
                  <div className="mt-3">
                    <UserActions user={{ id: u.id, name: u.name, email: u.email, verified: Boolean(u.emailVerifiedAt), disabled: u.disabled, isTeam: u.isTeam, teamTitle: u.teamTitle ?? "", businessStatus: u.businessStatus, companyName: u.companyName ?? "" }} />
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-sm text-zinc-500" aria-live="polite">
              {from}–{to} von {total} {total === 1 ? "Benutzer" : "Benutzern"}
            </p>
            {totalPages > 1 && (
              <nav aria-label="Seitennavigation" className="flex items-center gap-2">
                {page > 1 ? (
                  <Link href={href(q, page - 1)} className={buttonClass("secondary", "sm")} rel="prev">
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
                  <Link href={href(q, page + 1)} className={buttonClass("secondary", "sm")} rel="next">
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
