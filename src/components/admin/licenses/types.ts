// Gemeinsame Typen und Beschriftungen der Lizenzverwaltung (Admin, deutsch).

export const KEY_STATUS_LABEL: Record<string, string> = {
  PENDING: "Wartet auf Freigabe",
  ACTIVE: "Aktiv",
  REVOKED: "Gesperrt",
  REJECTED: "Abgelehnt",
};

export const REQUEST_STATUS_LABEL: Record<string, string> = {
  PENDING: "Wartet auf Freigabe",
  APPROVED: "Freigegeben",
  REJECTED: "Abgelehnt",
};

/** Ring-/Farbklassen je Status (gleiche Palette wie PILL in core/styles). */
export const STATUS_TONE: Record<string, string> = {
  PENDING: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
  ACTIVE: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
  APPROVED: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
  REVOKED: "bg-rose-500/10 text-rose-300 ring-rose-500/30",
  REJECTED: "bg-zinc-800/80 text-zinc-400 ring-zinc-700",
};

export type ProductRow = {
  id: string;
  slug: string;
  code: string;
  name: string;
  description: string;
  businessOnly: boolean;
  allowAccountRequest: boolean;
  approvalMode: "AUTO" | "MANUAL";
  comingSoon: boolean;
  active: boolean;
  sortOrder: number;
  keyCount: number;
  requestCount: number;
};

export type ApiClientRow = {
  id: string;
  name: string;
  tokenHint: string;
  /** "*" = alle Produkte, sonst Slugs */
  productSlugs: string[] | "*";
  active: boolean;
  revoked: boolean;
  createdAt: string;
  lastUsedAt: string | null;
};
