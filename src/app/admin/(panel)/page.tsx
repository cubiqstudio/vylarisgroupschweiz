import type { Metadata } from "next";
import Link from "next/link";
import { Activity, ArrowRight, FileText, Inbox, KeySquare, Plus, Server, Siren } from "lucide-react";
import { site } from "@/lib/site";
import { db } from "@/lib/db";
import { requireModulePage } from "@/lib/verein/guard";
import { getOverallStatus, OVERALL_HEADLINE } from "@/lib/status";
import {
  INCIDENT_SEVERITY_LABEL,
  INCIDENT_STATUS_LABEL,
  STATUS_STYLE,
  TICKET_CATEGORY_LABEL,
  TICKET_STATUS_LABEL,
  label,
} from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageTitle } from "@/components/admin/core/page-title";
import { StatCard } from "@/components/admin/core/stat-card";
import { INCIDENT_SEVERITY_STYLE, INCIDENT_STATUS_STYLE, PILL, TICKET_STATUS_STYLE } from "@/components/admin/core/styles";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Übersicht" };
export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const [
    admin,
    openTickets,
    inProgressTickets,
    services,
    publishedPosts,
    draftPosts,
    latestTickets,
    activeIncidents,
    overall,
    pendingKeys,
    pendingWebspace,
  ] = await Promise.all([
    requireModulePage("dashboard"),
    db.contactTicket.count({ where: { status: "OPEN" } }),
    db.contactTicket.count({ where: { status: "IN_PROGRESS" } }),
    db.saasService.findMany({ where: { comingSoon: false }, select: { status: true } }),
    db.blogPost.count({ where: { published: true } }),
    db.blogPost.count({ where: { published: false } }),
    db.contactTicket.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
    db.incident.findMany({
      where: { NOT: { status: "RESOLVED" } },
      orderBy: { startedAt: "desc" },
      include: { service: { select: { name: true } } },
    }),
    getOverallStatus(),
    db.licenseKey.count({ where: { status: "PENDING" } }),
    db.webspaceRequest.count({ where: { status: "PENDING" } }),
  ]);
  const pendingLicenses = pendingKeys + pendingWebspace;

  const impaired = services.filter((s) => s.status !== "OPERATIONAL").length;
  const firstName = admin.name.split(" ")[0];

  return (
    <>
      <PageTitle
        title={firstName ? `Hallo, ${firstName}` : "Übersicht"}
        description={`Der aktuelle Stand von Anfragen, Services, Systemstatus und Inhalten der ${site.name} auf einen Blick.`}
      />

      <section aria-label="Kennzahlen" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Offene Tickets"
          value={openTickets}
          detail={`${inProgressTickets} in Bearbeitung`}
          href="/admin/tickets"
          accent={openTickets > 0 ? "text-amber-300" : "text-white"}
          icon={<Inbox className="h-4 w-4" />}
        />
        <StatCard
          label="SaaS-Services"
          value={services.length}
          detail={impaired === 0 ? "Alle betriebsbereit" : `${impaired} nicht betriebsbereit`}
          href="/admin/services"
          accent={impaired > 0 ? "text-amber-300" : "text-white"}
          icon={<Server className="h-4 w-4" />}
        />
        <StatCard
          label="Gesamtstatus"
          value={<span className={cn("block text-xl leading-snug", STATUS_STYLE[overall].text)}>{OVERALL_HEADLINE[overall]}</span>}
          detail={
            <span className="inline-flex items-center gap-2">
              <StatusBadge status={overall} /> Zum Status
            </span>
          }
          href="/admin/status"
          icon={<Activity className="h-4 w-4" />}
        />
        <StatCard
          label="Blog"
          value={publishedPosts}
          detail={`veröffentlicht · ${draftPosts} ${draftPosts === 1 ? "Entwurf" : "Entwürfe"}`}
          href="/admin/blog"
          icon={<FileText className="h-4 w-4" />}
        />
        <StatCard
          label="Wartende Lizenz-Anträge"
          value={pendingLicenses}
          detail={`${pendingKeys} Schlüssel · ${pendingWebspace} Webspace-${pendingWebspace === 1 ? "Konto" : "Konten"}`}
          href="/admin/licenses"
          accent={pendingLicenses > 0 ? "text-amber-300" : "text-white"}
          icon={<KeySquare className="h-4 w-4" />}
        />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-5 py-4">
            <h2 className="text-sm font-semibold text-white">Neueste Tickets</h2>
            <Link href="/admin/tickets" className="inline-flex items-center gap-1 text-sm text-emerald-400 hover:text-emerald-300">
              Alle ansehen <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
          {latestTickets.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-zinc-500">Noch keine Anfragen über das Kontaktformular eingegangen.</p>
          ) : (
            <ul className="divide-y divide-zinc-800">
              {latestTickets.map((t) => (
                <li key={t.id}>
                  <Link href={`/admin/tickets/${t.id}`} className="flex flex-col gap-1.5 px-5 py-3.5 transition-colors hover:bg-zinc-900 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-zinc-100">{t.subject}</p>
                      <p className="truncate text-xs text-zinc-500">
                        <span className="font-mono">{t.ticketNumber}</span> · {t.name} · {label(TICKET_CATEGORY_LABEL, t.category)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className={cn(PILL, TICKET_STATUS_STYLE[t.status] ?? TICKET_STATUS_STYLE.CLOSED)}>
                        {label(TICKET_STATUS_LABEL, t.status)}
                      </span>
                      <time dateTime={t.createdAt.toISOString()} className="text-xs text-zinc-500">
                        {formatDateTime(t.createdAt)}
                      </time>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-5 py-4">
              <h2 className="text-sm font-semibold text-white">Aktive Meldungen</h2>
              <Link href="/admin/status" className="inline-flex items-center gap-1 text-sm text-emerald-400 hover:text-emerald-300">
                Verwalten <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
            {activeIncidents.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-zinc-500">Keine aktiven Störungs- oder Wartungsmeldungen.</p>
            ) : (
              <ul className="divide-y divide-zinc-800">
                {activeIncidents.map((i) => (
                  <li key={i.id} className="px-5 py-3.5">
                    <p className="text-sm font-medium text-zinc-100">{i.title}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <span className={cn(PILL, INCIDENT_SEVERITY_STYLE[i.severity])}>{label(INCIDENT_SEVERITY_LABEL, i.severity)}</span>
                      <span className={cn(PILL, INCIDENT_STATUS_STYLE[i.status])}>{label(INCIDENT_STATUS_LABEL, i.status)}</span>
                      {i.service && <span className="text-xs text-zinc-500">{i.service.name}</span>}
                    </div>
                    <p className="mt-1.5 text-xs text-zinc-500">Beginn {formatDateTime(i.startedAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold text-white">Verein</h2>
            <p className="mt-1 text-xs text-zinc-500">
              {site.legalName} · {site.members} Mitglieder, davon {site.board.length} im Vorstand
            </p>
            <ul className="mt-4 space-y-2.5">
              {site.board.map((m) => (
                <li key={m.name} className="text-sm">
                  <p className="font-medium text-zinc-100">{m.name}</p>
                  <p className="text-xs text-zinc-500">{m.role}</p>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold text-white">Schnellaktionen</h2>
            <div className="mt-4 flex flex-col gap-2">
              <ButtonLink href="/admin/services/new" variant="secondary" className="justify-start">
                <Plus className="h-4 w-4" aria-hidden="true" /> Neuer Service
              </ButtonLink>
              <ButtonLink href="/admin/blog/new" variant="secondary" className="justify-start">
                <Plus className="h-4 w-4" aria-hidden="true" /> Neuer Beitrag
              </ButtonLink>
              <ButtonLink href="/admin/status?new=incident" variant="secondary" className="justify-start">
                <Siren className="h-4 w-4" aria-hidden="true" /> Statusmeldung erstellen
              </ButtonLink>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
