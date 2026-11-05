"use client";

import { api } from "@/lib/api-client";
import { describeError } from "@/components/admin/settings/form-utils";

/** Ruft die API auf und liefert entweder die Daten oder eine deutsche Fehlermeldung samt Feldfehlern. */
export async function call<T>(url: string, method: "POST" | "PATCH" | "DELETE", body?: unknown): Promise<{ ok: true; data: T } | { ok: false; message: string; fields: Record<string, string> }> {
  try {
    const data = await api<T>(url, { method, body });
    return { ok: true, data };
  } catch (err) {
    const d = describeError(err, "Die Aktion ist fehlgeschlagen.");
    return { ok: false, message: d.message, fields: d.fields };
  }
}
