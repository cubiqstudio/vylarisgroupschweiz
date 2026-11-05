// Kleine Hilfen für Formulare und Listen der Dokumente, die auch im Browser laufen dürfen (keine Node-Importe).
import type { DocumentVisibility } from "./constants";

/** Obergrenze für Uploads in Byte; entspricht DOCUMENT_MAX_BYTES in files.ts (dort wird sie serverseitig durchgesetzt). */
export const UPLOAD_LIMIT_BYTES = 10 * 1024 * 1024;

/** Dateigrösse lesbar: «850 B», «12.4 KB», «1.5 MB» (Punkt als Dezimalzeichen wie im Rest der Software). */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Erklärung der Sichtbarkeit für Formulare und Listen. */
export const VISIBILITY_HINT: Record<DocumentVisibility, string> = {
  OEFFENTLICH: "Für alle Besuchenden der Website abrufbar.",
  MITGLIEDER: "Nur für angemeldete, aktuelle Mitglieder (und die Verwaltung).",
  VORSTAND: "Nur in der Verwaltung sichtbar.",
};

/** Dateiendungen für das Feld «Datei» im Browser (die Prüfung auf dem Server bleibt massgeblich). */
export const DOCUMENT_ACCEPT = ".pdf,.png,.jpg,.jpeg,.docx,.xlsx,.odt,.ods,.txt";
