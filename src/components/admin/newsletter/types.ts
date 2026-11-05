// Gemeinsame Typen und Beschriftungen des Newsletter-Bereichs (server- und client-tauglich).

export type CampaignStatus = "DRAFT" | "SENDING" | "SENT" | "FAILED";

export type CampaignDto = {
  id: string;
  subject: string;
  preheader: string;
  content: string;
  status: string;
  /** Empfängerkreis: ALL | MEMBERS | MEMBERSHIP_TYPE */
  segment: string;
  segmentTypeId: string | null;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  startedAt: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CampaignFailure = { id: string; email: string; error: string };

/** Antwort von GET /api/admin/newsletter/campaigns/[id] */
export type CampaignDetail = CampaignDto & { failures: CampaignFailure[] };

export const CAMPAIGN_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Entwurf",
  SENDING: "Wird gesendet",
  SENT: "Versendet",
  FAILED: "Fehlgeschlagen",
};

export const SUBSCRIBER_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Aktiv",
  PENDING: "Ausstehend",
  UNSUBSCRIBED: "Abgemeldet",
};

export const SUBSCRIBER_STATUSES = ["ACTIVE", "PENDING", "UNSUBSCRIBED"] as const;
export const SUBSCRIBER_PAGE_SIZE = 25;
