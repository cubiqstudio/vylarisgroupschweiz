// Serialisierte (JSON-taugliche) Datentypen für die Admin-Oberfläche. Datumsfelder sind ISO-Strings.

export type ServiceDTO = {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  category: string;
  url: string;
  repoUrl: string | null;
  status: string;
  uptime: number;
  featured: boolean;
  comingSoon: boolean;
  sortOrder: number;
  updatedAt: string;
};

export type MetricDTO = {
  id: string;
  name: string;
  slug: string;
  kind: string;
  location: string;
  status: string;
  uptime: number;
  responseMs: number | null;
  sortOrder: number;
  updatedAt: string;
};

export type IncidentDTO = {
  id: string;
  title: string;
  body: string;
  severity: string;
  status: string;
  serviceId: string | null;
  service: { id: string; name: string; slug: string } | null;
  startedAt: string;
  resolvedAt: string | null;
  updatedAt: string;
};

export type ServiceOption = { id: string; name: string };
