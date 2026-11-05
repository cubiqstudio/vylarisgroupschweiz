import { ApiClientError } from "@/lib/api-client";

/** Zerlegt einen Fehler aus api() in Feldfehler + Gesamtmeldung. */
export function describeError(err: unknown, fallback: string): { message: string; fields: Record<string, string> } {
  if (err instanceof ApiClientError) {
    const fields = err.fields ?? {};
    return {
      message: Object.keys(fields).length > 0 ? "Bitte prüfe die markierten Felder." : err.message,
      fields,
    };
  }
  return { message: fallback, fields: {} };
}
