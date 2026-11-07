import type { QrShape } from "@/lib/verein/membership-card";

/** Gerät für die Verwaltungsseite (Zeitpunkte als ISO-Text). Enthält nie das Token, nur den Hinweis. */
export type ScannerDeviceDto = {
  id: string;
  label: string;
  tokenHint: string;
  canCheckIn: boolean;
  active: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

/** Antwort beim Anlegen: Token, Kopplungs-Link und QR-Code gibt es nur dieses eine Mal. */
export type CreatedScannerDevice = {
  id: string;
  label: string;
  canCheckIn: boolean;
  tokenHint: string;
  token: string;
  pairingUrl: string;
  qr: QrShape;
};
