"use client";

import { RECEIPT_MAX_BYTES } from "@/lib/verein/file-limits";

/** Prüft die Datei vorab (die Prüfung auf dem Server bleibt massgeblich) und lädt sie als Beleg hoch. Gibt eine Fehlermeldung oder null zurück. */
export async function uploadReceipt(transactionId: string, file: File): Promise<string | null> {
  if (file.size === 0) return "Die Datei ist leer.";
  if (file.size > RECEIPT_MAX_BYTES) return "Die Datei ist zu gross (höchstens 5 MB).";
  const body = new FormData();
  body.set("file", file);
  try {
    const res = await fetch(`/api/admin/ledger/transactions/${encodeURIComponent(transactionId)}/receipts`, { method: "POST", body, credentials: "same-origin" });
    if (res.ok) return null;
    const json = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    return json?.error?.message ?? `Der Beleg konnte nicht hochgeladen werden (${res.status}).`;
  } catch {
    return "Netzwerkfehler – bitte Verbindung prüfen.";
  }
}

export const RECEIPT_ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp";
