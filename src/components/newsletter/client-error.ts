import { ApiClientError } from "@/lib/api-client";

/**
 * Transportfehler des API-Clients (Netzwerk, Antwort ohne auswertbaren Fehler) mit eigenem, übersetztem Text.
 * Fachliche Server-Meldungen kommen bereits in der Sprache der Seite an und werden unverändert angezeigt.
 * Liefert null, wenn es kein Transportfehler ist.
 */
export function transportMessage(
  err: ApiClientError,
  m: { network: string; requestFailed: (status: number) => string },
): string | null {
  if (err.code === "NETWORK") return m.network;
  if (err.code === "ERROR") return m.requestFailed(err.status);
  return null;
}
