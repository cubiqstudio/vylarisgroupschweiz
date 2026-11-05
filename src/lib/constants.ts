// Zentrale Wertelisten + deutsche Labels. Die DB speichert Strings (provider-neutral).

export const STATUSES = ["OPERATIONAL", "MAINTENANCE", "OUTAGE"] as const;
export type ComponentStatus = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<ComponentStatus, string> = {
  OPERATIONAL: "Betriebsbereit",
  MAINTENANCE: "Wartung",
  OUTAGE: "Störung",
};

/** Tailwind-Klassen je Status (Badge, Punkt, Text). */
export const STATUS_STYLE: Record<ComponentStatus, { badge: string; dot: string; text: string }> = {
  OPERATIONAL: {
    badge: "bg-green-500/10 text-green-800 ring-green-600/30",
    dot: "bg-green-500",
    text: "text-green-700",
  },
  MAINTENANCE: {
    badge: "bg-amber-500/10 text-amber-800 ring-amber-600/30",
    dot: "bg-amber-500",
    text: "text-amber-700",
  },
  OUTAGE: {
    badge: "bg-rose-500/10 text-rose-700 ring-rose-600/30",
    dot: "bg-rose-500",
    text: "text-rose-700",
  },
};

export const SERVICE_CATEGORIES = [
  "Sicherheit",
  "Kommunikation",
  "Produktivität",
  "Infrastruktur",
  "Entwickler-Tools",
] as const;

export const METRIC_KINDS = ["SERVER", "NETWORK", "DATABASE", "STORAGE", "OTHER"] as const;
export type MetricKind = (typeof METRIC_KINDS)[number];
export const METRIC_KIND_LABEL: Record<MetricKind, string> = {
  SERVER: "Server",
  NETWORK: "Netzwerk",
  DATABASE: "Datenbank",
  STORAGE: "Speicher",
  OTHER: "Sonstiges",
};

export const INCIDENT_SEVERITIES = ["MINOR", "MAJOR", "MAINTENANCE"] as const;
export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];
export const INCIDENT_SEVERITY_LABEL: Record<IncidentSeverity, string> = {
  MINOR: "Geringfügig",
  MAJOR: "Schwerwiegend",
  MAINTENANCE: "Wartung",
};

export const INCIDENT_STATUSES = ["SCHEDULED", "INVESTIGATING", "IDENTIFIED", "MONITORING", "RESOLVED"] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];
export const INCIDENT_STATUS_LABEL: Record<IncidentStatus, string> = {
  SCHEDULED: "Geplant",
  INVESTIGATING: "Wird untersucht",
  IDENTIFIED: "Ursache gefunden",
  MONITORING: "Wird beobachtet",
  RESOLVED: "Behoben",
};

export const TICKET_CATEGORIES = ["GENERAL", "MEMBERSHIP", "B2B_HOSTING", "SECURITY_REPORT"] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];
export const TICKET_CATEGORY_LABEL: Record<TicketCategory, string> = {
  GENERAL: "Allgemein",
  MEMBERSHIP: "Mitgliedschaft",
  B2B_HOSTING: "Web-Tools & Hosting",
  SECURITY_REPORT: "Security-Report",
};

export const TICKET_STATUSES = ["OPEN", "IN_PROGRESS", "CLOSED"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  OPEN: "Offen",
  IN_PROGRESS: "In Bearbeitung",
  CLOSED: "Geschlossen",
};

export const ADMIN_ROLES = ["OWNER", "ADMIN", "EDITOR"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

/** Label-Lookup mit Fallback auf den Rohwert (DB-Werte sind Strings). */
export function label<T extends string>(map: Record<T, string>, value: string): string {
  return (map as Record<string, string>)[value] ?? value;
}
