// Wandelt Prisma-Datensätze in serialisierbare DTOs um (Server -> Client Components).
import type { Incident, SaasService, SystemMetric } from "@prisma/client";
import type { IncidentDTO, MetricDTO, ServiceDTO } from "./types";

export function toServiceDTO(s: SaasService): ServiceDTO {
  return {
    id: s.id,
    name: s.name,
    slug: s.slug,
    tagline: s.tagline,
    description: s.description,
    category: s.category,
    url: s.url,
    repoUrl: s.repoUrl,
    status: s.status,
    uptime: s.uptime,
    featured: s.featured,
    comingSoon: s.comingSoon,
    sortOrder: s.sortOrder,
    nameEn: s.nameEn,
    taglineEn: s.taglineEn,
    descriptionEn: s.descriptionEn,
    updatedAt: s.updatedAt.toISOString(),
  };
}

export function toMetricDTO(m: SystemMetric): MetricDTO {
  return {
    id: m.id,
    name: m.name,
    slug: m.slug,
    kind: m.kind,
    location: m.location,
    status: m.status,
    uptime: m.uptime,
    responseMs: m.responseMs,
    sortOrder: m.sortOrder,
    updatedAt: m.updatedAt.toISOString(),
  };
}

export function toIncidentDTO(i: Incident & { service?: { id: string; name: string; slug: string } | null }): IncidentDTO {
  return {
    id: i.id,
    title: i.title,
    body: i.body,
    severity: i.severity,
    status: i.status,
    serviceId: i.serviceId,
    service: i.service ?? null,
    startedAt: i.startedAt.toISOString(),
    resolvedAt: i.resolvedAt ? i.resolvedAt.toISOString() : null,
    titleEn: i.titleEn,
    bodyEn: i.bodyEn,
    updatedAt: i.updatedAt.toISOString(),
  };
}
