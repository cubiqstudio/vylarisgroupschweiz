"use client";

import { UPLOAD_LIMIT_BYTES } from "@/lib/verein/documents-meta";

export type UploadOutcome = { ok: true; data: unknown } | { ok: false; message: string; fields: Record<string, string> };

/** Vorabprüfung der Datei im Browser (die Prüfung auf dem Server bleibt massgeblich). Gibt eine Fehlermeldung oder null zurück. */
export function precheckFile(file: File | null): string | null {
  if (!file) return "Bitte eine Datei wählen.";
  if (file.size === 0) return "Die Datei ist leer.";
  if (file.size > UPLOAD_LIMIT_BYTES) return "Die Datei ist zu gross (höchstens 10 MB).";
  return null;
}

/** Sendet ein multipart-Formular an die API und liest { data } bzw. { error } (mit Feldfehlern). */
export async function sendForm(url: string, body: FormData): Promise<UploadOutcome> {
  try {
    const res = await fetch(url, { method: "POST", body, credentials: "same-origin" });
    const json = (await res.json().catch(() => null)) as { data?: unknown; error?: { message?: string; fields?: Record<string, string> } } | null;
    if (res.ok) return { ok: true, data: json?.data };
    const fields = json?.error?.fields ?? {};
    return {
      ok: false,
      fields,
      message: Object.keys(fields).length > 0 ? "Bitte prüfe die markierten Felder." : (json?.error?.message ?? `Der Upload ist fehlgeschlagen (${res.status}).`),
    };
  } catch {
    return { ok: false, fields: {}, message: "Netzwerkfehler – bitte Verbindung prüfen." };
  }
}
