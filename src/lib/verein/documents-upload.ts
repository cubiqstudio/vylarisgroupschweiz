// Liest ein multipart-Formular mit genau einer Datei (Feld «file») für die Dokument-Routen. Nur auf dem Server.
import "server-only";
import { ApiError } from "@/lib/api";
import { checkDocumentUpload } from "./documents-lib";
import { formFields } from "./documents-schemas";
import { DOCUMENT_MAX_BYTES, type UploadCheck } from "./files";

const FORM_OVERHEAD = 256 * 1024;

/**
 * Prüft die Grösse vorab (Content-Length), liest das Formular und prüft die Datei (Grösse, Inhaltstyp, Endung, Hash).
 * Wirft 413 bei zu grossen Anfragen und 422 mit Feldfehler «file» bei ungültigen Dateien.
 */
export async function readDocumentForm(req: Request): Promise<{ fields: Record<string, string>; file: Extract<UploadCheck, { ok: true }> }> {
  const length = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(length) && length > DOCUMENT_MAX_BYTES + FORM_OVERHEAD) {
    throw new ApiError(413, "PAYLOAD_TOO_LARGE", "Die Datei ist zu gross (höchstens 10 MB).", { file: "Die Datei ist zu gross (höchstens 10 MB)." });
  }
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new ApiError(400, "BAD_INPUT", "Die Datei konnte nicht gelesen werden. Bitte erneut versuchen.", { file: "Die Datei konnte nicht gelesen werden." });
  }
  const file = form.get("file");
  if (!(file instanceof File) || (file.size === 0 && file.name === "")) {
    throw new ApiError(422, "VALIDATION_ERROR", "Bitte eine Datei wählen.", { file: "Bitte eine Datei wählen." });
  }
  const check = await checkDocumentUpload(file);
  if (!check.ok) throw new ApiError(422, "VALIDATION_ERROR", check.error, { file: check.error });
  return { fields: formFields(form), file: check };
}
