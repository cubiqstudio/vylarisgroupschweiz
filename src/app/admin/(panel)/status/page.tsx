import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth";
import { getOverallStatus, OVERALL_HEADLINE } from "@/lib/status";
import { STATUS_STYLE } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageTitle } from "@/components/admin/core/page-title";
import { MetricManager } from "@/components/admin/core/metric-manager";
import { IncidentManager } from "@/components/admin/core/incident-manager";
import { toIncidentDTO, toMetricDTO } from "@/components/admin/core/serialize";

export const metadata: Metadata = { title: "Status" };
export const dynamic = "force-dynamic";

export default async function AdminStatusPage({ searchParams }: { searchParams: Promise<{ new?: string | string[] }> }) {
  await requireAdminPage();
  const sp = await searchParams;
  const openNew = (Array.isArray(sp.new) ? sp.new[0] : sp.new) === "incident";

  const [overall, metrics, incidents, services, latest] = await Promise.all([
    getOverallStatus(),
    db.systemMetric.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    db.incident.findMany({ include: { service: { select: { id: true, name: true, slug: true } } }, orderBy: { startedAt: "desc" } }),
    db.saasService.findMany({ select: { id: true, name: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    db.systemMetric.findFirst({ orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }),
  ]);

  return (
    <>
      <PageTitle
        title="Status"
        description="Pflege den Betriebszustand der Infrastruktur und veröffentliche Störungs- und Wartungsmeldungen. Alle Angaben werden von dir manuell gepflegt."
      >
        <Link
          href="/status"
          target="_blank"
          rel="noopener"
          className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-zinc-300 hover:bg-zinc-900 hover:text-white"
        >
          Öffentliche Statusseite <ExternalLink className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">(öffnet in neuem Tab)</span>
        </Link>
      </PageTitle>

      <Card className="mb-8 flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-400">Berechneter Gesamtstatus</p>
          <p className={`mt-1 text-xl font-semibold tracking-tight ${STATUS_STYLE[overall].text}`}>{OVERALL_HEADLINE[overall]}</p>
          <p className="mt-1 text-xs text-zinc-500">
            Der schlechteste Status aller Komponenten und Services bestimmt das Gesamtergebnis.
            {latest && ` Letzte Komponenten-Änderung: ${formatDateTime(latest.updatedAt)}.`}
          </p>
        </div>
        <StatusBadge status={overall} className="self-start sm:self-center" />
      </Card>

      <div className="space-y-12">
        <MetricManager initial={metrics.map(toMetricDTO)} />
        <IncidentManager initial={incidents.map(toIncidentDTO)} services={services} openNew={openNew} />
      </div>
    </>
  );
}
