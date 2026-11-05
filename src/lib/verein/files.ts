// Dateiuploads (Belege, Dokumente): Grössen- und Typprüfung, Inhalts-Erkennung anhand der ersten Bytes, Hash, sichere Dateinamen.
// Die Datei liegt als Bytes in der Datenbank (Receipt.data, DocumentVersion.data). Der Browser-MIME-Typ wird NICHT geglaubt:
// massgeblich ist der erkannte Inhalt. Downloads immer als Anhang mit nosniff ausliefern (downloadHeaders).
import { createHash } from "node:crypto";
import { safeDownloadName } from "./csv";

export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export type UploadKind = "pdf" | "png" | "jpeg" | "webp" | "docx" | "xlsx" | "odt" | "ods" | "txt" | "csv";

export const UPLOAD_MIME: Record<UploadKind, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  txt: "text/plain; charset=utf-8",
  csv: "text/csv; charset=utf-8",
};

export const UPLOAD_LABEL: Record<UploadKind, string> = {
  pdf: "PDF",
  png: "PNG",
  jpeg: "JPEG",
  webp: "WebP",
  docx: "Word (DOCX)",
  xlsx: "Excel (XLSX)",
  odt: "OpenDocument-Text (ODT)",
  ods: "OpenDocument-Tabelle (ODS)",
  txt: "Text (TXT)",
  csv: "CSV",
};

/** Erlaubte Typen für Belege (Scans, Fotos, Rechnungen). */
export const RECEIPT_KINDS: readonly UploadKind[] = ["pdf", "png", "jpeg", "webp"];
/** Erlaubte Typen für Dokumente. */
export const DOCUMENT_KINDS: readonly UploadKind[] = ["pdf", "png", "jpeg", "docx", "xlsx", "odt", "ods", "txt"];

const startsWith = (b: Uint8Array, sig: number[], at = 0) => sig.every((v, i) => b[at + i] === v);

/** Erkennt den Typ anhand der ersten Bytes (txt nur, wenn der Inhalt gültiges UTF-8 ohne Steuerzeichen ist). */
export function sniffKind(bytes: Uint8Array, fileName = ""): UploadKind | null {
  if (bytes.length < 4) return null;
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) return "pdf"; // %PDF
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return "webp";
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    // ZIP-Container: Office/OpenDocument unterscheidet die Dateiendung (der Inhalt wird nie ausgeführt oder entpackt)
    const ext = fileName.toLowerCase().split(".").pop() ?? "";
    if (ext === "docx" || ext === "xlsx" || ext === "odt" || ext === "ods") return ext;
    return null;
  }
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  if (ext === "txt" || ext === "csv") {
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, Math.min(bytes.length, 64 * 1024)));
      if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)) return null;
      return ext;
    } catch {
      return null;
    }
  }
  return null;
}

export type UploadCheck =
  | { ok: true; kind: UploadKind; mimeType: string; sizeBytes: number; sha256: string; fileName: string; data: Buffer }
  | { ok: false; error: string };

/** Dateiname bereinigen: nur Dateiname (kein Pfad), unkritische Zeichen, höchstens 120 Zeichen, Endung bleibt. */
export function sanitizeFileName(name: string, fallback = "datei"): string {
  const last = name.split(/[\\/]/).pop() ?? "";
  const dot = last.lastIndexOf(".");
  const base = safeDownloadName(dot > 0 ? last.slice(0, dot) : last, fallback).slice(0, 100);
  const ext = dot > 0 ? last.slice(dot + 1).replace(/[^A-Za-z0-9]/g, "").toLowerCase().slice(0, 8) : "";
  return ext ? `${base}.${ext}` : base;
}

/**
 * Prüft eine hochgeladene Datei (aus formData): nicht leer, höchstens `maxBytes`, Inhalt gehört zu einem der erlaubten Typen.
 * Liefert die Bytes samt Hash oder eine deutsche Fehlermeldung.
 */
export async function checkUpload(file: File, opts: { maxBytes: number; kinds: readonly UploadKind[] }): Promise<UploadCheck> {
  if (file.size === 0) return { ok: false, error: "Die Datei ist leer." };
  if (file.size > opts.maxBytes) {
    return { ok: false, error: `Die Datei ist zu gross (höchstens ${Math.round(opts.maxBytes / 1024 / 1024)} MB).` };
  }
  const data = Buffer.from(await file.arrayBuffer());
  if (data.length > opts.maxBytes) {
    return { ok: false, error: `Die Datei ist zu gross (höchstens ${Math.round(opts.maxBytes / 1024 / 1024)} MB).` };
  }
  const kind = sniffKind(data, file.name);
  if (!kind || !opts.kinds.includes(kind)) {
    return { ok: false, error: `Dateityp nicht erlaubt. Erlaubt: ${opts.kinds.map((k) => UPLOAD_LABEL[k]).join(", ")}.` };
  }
  return {
    ok: true,
    kind,
    mimeType: UPLOAD_MIME[kind],
    sizeBytes: data.length,
    sha256: createHash("sha256").update(data).digest("hex"),
    fileName: sanitizeFileName(file.name),
    data,
  };
}

/** Antwortkopfzeilen für einen Datei-Download: immer als Anhang, Typ nicht erraten lassen, nie öffentlich cachen. */
export function downloadHeaders(fileName: string, mimeType: string, sizeBytes?: number): Record<string, string> {
  const name = sanitizeFileName(fileName);
  return {
    "Content-Type": mimeType,
    "Content-Disposition": `attachment; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    ...(sizeBytes !== undefined ? { "Content-Length": String(sizeBytes) } : {}),
  };
}
