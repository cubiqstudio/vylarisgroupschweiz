"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Lädt die Serverdaten der Seite in festem Abstand neu (z. B. während eine Kampagne gesendet wird). */
export function AutoRefresh({ intervalMs = 4000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);
  return null;
}
