"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiClientError } from "@/lib/api-client";

/**
 * Gemeinsamer Ablauf für alle Anträge: Ladezustand, Fehlermeldung (bereits in der Sprache der Seite), Feldfehler.
 * Nach Erfolg wird die Seite neu geladen (router.refresh), damit der neue Stand aus der Datenbank erscheint.
 */
export function useRequest(fallbackError: string) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  /** Sendet den Antrag; liefert die Antwort oder null bei einem Fehler. */
  async function post<T>(url: string, body: unknown): Promise<T | null> {
    if (loading) return null;
    setLoading(true);
    setError(null);
    setFields({});
    try {
      const res = await api<T>(url, { method: "POST", body });
      router.refresh();
      return res;
    } catch (err) {
      if (err instanceof ApiClientError) {
        setFields(err.fields ?? {});
        // Bei Feldfehlern steht die Meldung am Feld; sonst als allgemeine Fehlermeldung.
        setError(err.fields && Object.keys(err.fields).length > 0 ? null : err.message);
      } else {
        setError(fallbackError);
      }
      return null;
    } finally {
      setLoading(false);
    }
  }

  return {
    loading,
    error,
    fields,
    post,
    clearField: (name: string) => setFields((f) => ({ ...f, [name]: "" })),
  };
}
