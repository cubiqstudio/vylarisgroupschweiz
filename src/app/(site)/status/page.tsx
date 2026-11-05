import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, ServerCrash } from "lucide-react";
import { db } from "@/lib/db";
import { worstStatus } from "@/lib/status";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Container, PageHeader } from "@/components/ui/section";
import { StatusBadge } from "@/components/ui/status-badge";
import { AutoRefresh } from "@/components/status/auto-refresh";
import { OverallBanner } from "@/components/status/overall-banner";
import { UptimeMeter } from "@/components/status/uptime-meter";
import {
  ActiveIncident,
  PastIncident,
  type IncidentData,
} from "@/components/status/incident-card";
import { labelFor, metricLocation, metricName } from "@/i18n/labels";
import { getLocale, getMessages, getSite } from "@/i18n/server";
import { status as messages } from "@/i18n/status";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSite();
  const m = await getMessages(messages);
  return {
    title: m.meta.title,
    description: m.meta.description(site.name),
    alternates: { canonical: "/status" },
  };
}

const PAST_DAYS = 90;

const incidentSelect = {
  id: true,
  title: true,
  body: true,
  severity: true,
  status: true,
  startedAt: true,
  resolvedAt: true,
  service: { select: { name: true, slug: true } },
} as const;

async function load() {
  try {
    const since = new Date(Date.now() - PAST_DAYS * 24 * 60 * 60 * 1000);
    const [metrics, services, active, past] = await Promise.all([
      db.systemMetric.findMany({
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      db.saasService.findMany({
        // Angekündigte Dienste («Bald verfügbar») haben noch keinen Betriebsstatus.
        where: { comingSoon: false },
        select: {
          id: true,
          name: true,
          slug: true,
          category: true,
          status: true,
          uptime: true,
          updatedAt: true,
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      db.incident.findMany({
        where: { status: { not: "RESOLVED" } },
        select: { ...incidentSelect, updatedAt: true },
        orderBy: { startedAt: "desc" },
      }),
      db.incident.findMany({
        where: {
          status: "RESOLVED",
          OR: [
            { resolvedAt: { gte: since } },
            { resolvedAt: null, startedAt: { gte: since } },
          ],
        },
        select: { ...incidentSelect, updatedAt: true },
        orderBy: { startedAt: "desc" },
        take: 50,
      }),
    ]);
    const stamps = [...metrics, ...services, ...active, ...past].map((x) =>
      x.updatedAt.getTime(),
    );
    return {
      metrics,
      services,
      active: active as IncidentData[],
      past: past as IncidentData[],
      overall: worstStatus([...metrics, ...services].map((x) => x.status)),
      updatedAt: stamps.length ? new Date(Math.max(...stamps)) : null,
    };
  } catch (err) {
    console.error("[status] Laden fehlgeschlagen", err);
    return null;
  }
}

function SectionTitle({
  id,
  title,
  description,
}: {
  id: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-5">
      <h2
        id={id}
        className="text-xl font-semibold tracking-tight text-white sm:text-2xl"
      >
        {title}
      </h2>
      {description && (
        <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
          {description}
        </p>
      )}
    </div>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return <p className="px-5 py-6 text-sm text-zinc-400 sm:px-6">{children}</p>;
}

export default async function StatusPage() {
  const data = await load();
  const m = await getMessages(messages);
  const locale = await getLocale();

  return (
    <>
      <PageHeader
        eyebrow={m.hero.eyebrow}
        title={
          <>
            {m.hero.titlePre}{" "}
            <span className="text-gradient">{m.hero.titleAccent}</span>
          </>
        }
        description={m.hero.description}
      />

      <Container className="space-y-12 py-12 sm:py-16">
        {data === null ? (
          <Card className="mx-auto max-w-xl p-8 text-center" role="alert">
            <ServerCrash
              className="mx-auto h-8 w-8 text-rose-400"
              aria-hidden
            />
            <h2 className="mt-4 text-lg font-semibold text-white">
              {m.failed.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              {m.failed.text}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/status" className={buttonClass("primary")}>
                {m.failed.retry}
              </Link>
              <Link href="/contact" className={buttonClass("secondary")}>
                {m.failed.contact}
              </Link>
            </div>
          </Card>
        ) : (
          <>
            <AutoRefresh />
            <OverallBanner status={data.overall} updatedAt={data.updatedAt} />

            <section aria-labelledby="incidents-title">
              <SectionTitle
                id="incidents-title"
                title={m.active.title}
                description={m.active.description}
              />
              {data.active.length === 0 ? (
                <Card className="flex items-start gap-3 p-5 sm:p-6">
                  <CheckCircle2
                    className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400"
                    aria-hidden
                  />
                  <p className="text-sm leading-relaxed text-zinc-300">
                    {m.active.none}
                  </p>
                </Card>
              ) : (
                <div className="space-y-4">
                  {data.active.map((i) => (
                    <ActiveIncident key={i.id} incident={i} />
                  ))}
                </div>
              )}
            </section>

            <section aria-labelledby="infra-title">
              <SectionTitle
                id="infra-title"
                title={m.infra.title}
                description={m.infra.description}
              />
              <Card>
                {data.metrics.length === 0 ? (
                  <EmptyRow>{m.infra.none}</EmptyRow>
                ) : (
                  <ul className="divide-y divide-zinc-800">
                    {data.metrics.map((mt) => (
                      <li
                        key={mt.id}
                        className="grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto_10rem] sm:items-center sm:gap-6 sm:px-6"
                      >
                        <div className="min-w-0">
                          <p className="break-words font-medium text-white">
                            {metricName(mt, locale)}
                          </p>
                          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
                            <Badge className="px-2 py-0.5">
                              {labelFor("metricKind", mt.kind, locale)}
                            </Badge>
                            {mt.location && <span>{metricLocation(mt.location, locale)}</span>}
                            {mt.responseMs != null && (
                              <span>
                                {m.infra.responseTime}{" "}
                                <span className="tabular-nums text-zinc-300">
                                  {mt.responseMs} ms
                                </span>
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="sm:justify-self-end">
                          <StatusBadge
                            status={mt.status}
                            label={labelFor("status", mt.status, locale)}
                          />
                        </div>
                        <UptimeMeter
                          value={mt.uptime}
                          status={mt.status}
                          label={metricName(mt, locale)}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </section>

            <section aria-labelledby="services-title">
              <SectionTitle
                id="services-title"
                title={m.services.title}
                description={m.services.description}
              />
              <Card>
                {data.services.length === 0 ? (
                  <EmptyRow>{m.services.none}</EmptyRow>
                ) : (
                  <ul className="divide-y divide-zinc-800">
                    {data.services.map((s) => (
                      <li
                        key={s.id}
                        className="grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto_10rem] sm:items-center sm:gap-6 sm:px-6"
                      >
                        <div className="min-w-0">
                          <Link
                            href={`/services#${s.slug}`}
                            className="font-medium text-white underline-offset-4 hover:text-emerald-300 hover:underline"
                          >
                            {s.name}
                          </Link>
                          <p className="mt-1 text-xs text-zinc-500">
                            {labelFor("category", s.category, locale)}
                          </p>
                        </div>
                        <div className="sm:justify-self-end">
                          <StatusBadge
                            status={s.status}
                            label={labelFor("status", s.status, locale)}
                          />
                        </div>
                        <UptimeMeter
                          value={s.uptime}
                          status={s.status}
                          label={s.name}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </section>

            <section aria-labelledby="past-title">
              <SectionTitle
                id="past-title"
                title={m.past.title}
                description={m.past.description(PAST_DAYS)}
              />
              <Card>
                {data.past.length === 0 ? (
                  <EmptyRow>{m.past.none(PAST_DAYS)}</EmptyRow>
                ) : (
                  <ul className="divide-y divide-zinc-800">
                    {data.past.map((i) => (
                      <PastIncident key={i.id} incident={i} />
                    ))}
                  </ul>
                )}
              </Card>
            </section>
          </>
        )}
      </Container>
    </>
  );
}
