// Fachlogik des Moduls Dokumente (rein, ohne Seiteneffekte): Upload-Prüfung samt Dateiendung, Versionslogik, Sichtbarkeit, Anzeige.
// Die Datei selbst prüft checkUpload (files.ts, Typ am Inhalt erkannt); hier kommt die Übereinstimmung mit der Endung dazu.
import { safeDownloadName } from "./csv";
import { formatFileSize } from "./documents-meta";
import { DOCUMENT_CATEGORIES, DOCUMENT_VISIBILITIES, type DocumentCategory, type DocumentVisibility } from "./constants";
import { checkUpload, DOCUMENT_KINDS, DOCUMENT_MAX_BYTES, sanitizeFileName, type UploadCheck, type UploadKind } from "./files";

/** Dateiendungen, die zu einem erkannten Inhalt passen (Kleinbuchstaben, ohne Punkt). */
export const EXTENSIONS_FOR_KIND: Record<UploadKind, readonly string[]> = {
  pdf: ["pdf"],
  png: ["png"],
  jpeg: ["jpg", "jpeg"],
  webp: ["webp"],
  docx: ["docx"],
  xlsx: ["xlsx"],
  odt: ["odt"],
  ods: ["ods"],
  txt: ["txt"],
  csv: ["csv"],
};

/** Endung eines Dateinamens in Kleinbuchstaben («» ohne Endung). */
export function extensionOf(name: string): string {
  const last = name.split(/[\\/]/).pop() ?? "";
  const dot = last.lastIndexOf(".");
  return dot > 0 && dot < last.length - 1 ? last.slice(dot + 1).toLowerCase() : "";
}

export type NameCheck = { ok: true; fileName: string } | { ok: false; error: string };

/**
 * Dateiname und erkannter Inhalt müssen zusammenpassen. Ohne Endung wird die passende angehängt; eine andere Endung
 * (z. B. «bild.png» mit PDF-Inhalt oder «programm.exe») wird abgelehnt.
 */
export function reconcileFileName(rawName: string, kind: UploadKind): NameCheck {
  const clean = sanitizeFileName(rawName, "dokument");
  const ext = extensionOf(clean);
  const allowed = EXTENSIONS_FOR_KIND[kind];
  if (ext === "") return { ok: true, fileName: `${clean}.${allowed[0]}` };
  if (!allowed.includes(ext)) {
    return { ok: false, error: `Die Dateiendung «.${ext}» passt nicht zum Inhalt der Datei (erkannt: ${allowed[0]!.toUpperCase()}).` };
  }
  return { ok: true, fileName: clean };
}

/** Prüft ein hochgeladenes Dokument: Grösse, Inhaltstyp (Magic Bytes), Übereinstimmung mit der Endung, Hash, bereinigter Name. */
export async function checkDocumentUpload(file: File): Promise<UploadCheck> {
  const checked = await checkUpload(file, { maxBytes: DOCUMENT_MAX_BYTES, kinds: DOCUMENT_KINDS });
  if (!checked.ok) return checked;
  const name = reconcileFileName(file.name, checked.kind);
  if (!name.ok) return { ok: false, error: name.error };
  return { ...checked, fileName: name.fileName };
}

// ---- Versionen ----------------------------------------------------------------------------------------------------

/** Nächste Versionsnummer: höchste vorhandene + 1 (nie eine Nummer wiederverwenden), mindestens 1. */
export function nextVersionNumber(versions: ReadonlyArray<{ version: number }>, currentVersion = 0): number {
  const highest = versions.reduce((m, v) => Math.max(m, v.version), 0);
  return Math.max(highest, currentVersion) + 1;
}

/** Ist die neue Datei inhaltlich identisch mit der aktuellen Fassung (gleicher SHA-256)? Dann legen wir keine neue Version an. */
export function isSameContent(newSha256: string, currentSha256: string | null | undefined): boolean {
  return Boolean(currentSha256) && newSha256.toLowerCase() === (currentSha256 ?? "").toLowerCase();
}

/** Nummer der aktuellen Fassung nach dem Löschen einer Version (höchste verbleibende); null, wenn keine übrig bleibt. */
export function currentVersionAfterRemoval(versions: ReadonlyArray<{ version: number }>, removed: number): number | null {
  const rest = versions.filter((v) => v.version !== removed).map((v) => v.version);
  return rest.length === 0 ? null : Math.max(...rest);
}

/** Ist diese Fassung die aktuelle (neueste)? */
export const isCurrentVersion = (version: number, currentVersion: number): boolean => version === currentVersion;

/** Nummer einer angefragten Version aus einem Query-Parameter; null = aktuelle Fassung. */
export function parseVersionParam(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value.trim() === "") return null;
  if (!/^\d{1,6}$/.test(value.trim())) return null;
  const n = Number(value.trim());
  return n >= 1 ? n : null;
}

// ---- Sichtbarkeit -------------------------------------------------------------------------------------------------

/**
 * Wer ein Dokument sieht: Besucher (nicht angemeldet), Mitglied (aktuell, Status AKTIV), Verwaltung ohne das Einzelrecht
 * «Dokumente „Nur Vorstand“ sehen» (STAFF) sowie Vorstand/Verwaltung mit diesem Recht (BOARD). STAFF und BOARD sehen auch
 * archivierte Dokumente und frühere Versionen.
 */
export type DocumentAudience = "PUBLIC" | "MEMBER" | "STAFF" | "BOARD";

const VISIBLE: Record<DocumentAudience, readonly DocumentVisibility[]> = {
  PUBLIC: ["OEFFENTLICH"],
  MEMBER: ["OEFFENTLICH", "MITGLIEDER"],
  STAFF: ["OEFFENTLICH", "MITGLIEDER"],
  BOARD: ["OEFFENTLICH", "MITGLIEDER", "VORSTAND"],
};

/** Gehört das Publikum zur Verwaltung (sieht archivierte Dokumente und frühere Versionen)? */
export const isStaffAudience = (audience: DocumentAudience): boolean => audience === "BOARD" || audience === "STAFF";

/** Publikum einer Person mit Leserecht auf «Dokumente»: mit dem Einzelrecht «Nur Vorstand» sehen BOARD, sonst STAFF. */
export const adminAudience = (canSeeBoardDocuments: boolean): DocumentAudience => (canSeeBoardDocuments ? "BOARD" : "STAFF");

/** Sichtbarkeitsstufen, die ein Publikum sehen darf (für Datenbankfilter). */
export const visibilitiesFor = (audience: DocumentAudience): readonly DocumentVisibility[] => VISIBLE[audience];

/** Darf dieses Publikum ein Dokument dieser Sichtbarkeit sehen? Unbekannte Werte sind nie sichtbar. */
export function canView(audience: DocumentAudience, visibility: string, archivedAt: Date | null = null): boolean {
  if (archivedAt && !isStaffAudience(audience)) return false; // archivierte Dokumente sieht nur die Verwaltung
  return (VISIBLE[audience] as readonly string[]).includes(visibility);
}

/** Das öffentliche Statutendokument: Kategorie STATUTEN, öffentlich, nicht archiviert. */
export function isPublicStatute(doc: { category: string; visibility: string; archivedAt: Date | null }): boolean {
  return doc.category === "STATUTEN" && doc.visibility === "OEFFENTLICH" && doc.archivedAt === null;
}

// ---- Anzeige ------------------------------------------------------------------------------------------------------

/** Dateiname für den Download: «Titel-vN.endung» – ohne Pfad und Sonderzeichen. Bei der aktuellen Fassung ohne Versionsnummer. */
export function downloadFileName(title: string, version: number, fileName: string, isCurrent: boolean): string {
  const ext = extensionOf(fileName);
  const base = safeDownloadName(`${title}${isCurrent ? "" : `-v${version}`}`, "dokument").replace(/\.+$/, "");
  return ext ? `${base}.${ext}` : base;
}

export type DocumentFilters = { q: string; category: DocumentCategory | ""; visibility: DocumentVisibility | ""; archived: boolean };

const asCategory = (v: string): DocumentCategory | "" => (DOCUMENT_CATEGORIES as readonly string[]).includes(v) ? (v as DocumentCategory) : "";
const asVisibility = (v: string): DocumentVisibility | "" => (DOCUMENT_VISIBILITIES as readonly string[]).includes(v) ? (v as DocumentVisibility) : "";

/** Filter der Dokumentliste aus den Query-Parametern (unbekannte Werte werden ignoriert). */
export function parseDocumentFilters(get: (key: string) => string): DocumentFilters {
  return {
    q: get("q").trim().slice(0, 100),
    category: asCategory(get("category")),
    visibility: asVisibility(get("visibility")),
    archived: get("archived") === "1",
  };
}

export { formatFileSize };
