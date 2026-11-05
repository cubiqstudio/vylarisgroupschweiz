import { db } from "@/lib/db";
import { handle } from "@/lib/api";
import { OVERALL_HEADLINE, worstStatus } from "@/lib/status";
import { publicOk } from "../_lib/http";

export const dynamic = "force-dynamic";

const incidentSelect = {
  id: true,
  title: true,
  body: true,
  severity: true,
  status: true,
  serviceId: true,
  startedAt: true,
  resolvedAt: true,
  createdAt: true,
  updatedAt: true,
  service: { select: { name: true, slug: true } },
} as const;

export const GET = handle(async () => {
  const [components, services, active, recent] = await Promise.all([
    db.systemMetric.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    db.saasService.findMany({
      where: { comingSoon: false },
      select: { id: true, name: true, slug: true, category: true, status: true, uptime: true, updatedAt: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    db.incident.findMany({
      where: { status: { not: "RESOLVED" } },
      select: incidentSelect,
      orderBy: { startedAt: "desc" },
    }),
    db.incident.findMany({
      where: { status: "RESOLVED" },
      select: incidentSelect,
      orderBy: { startedAt: "desc" },
      take: 10,
    }),
  ]);

  const overall = worstStatus([...components, ...services].map((x) => x.status));
  const stamps = [...components, ...services, ...active, ...recent].map((x) => x.updatedAt.getTime());
  const updatedAt = new Date(stamps.length ? Math.max(...stamps) : Date.now());

  return publicOk({
    overall,
    headline: OVERALL_HEADLINE[overall],
    updatedAt,
    components,
    services: services.map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      category: s.category,
      status: s.status,
      uptime: s.uptime,
    })),
    incidents: { active, recent },
  });
});
