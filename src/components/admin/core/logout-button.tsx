"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch {
      /* Auch bei einem Fehler zur Anmeldung wechseln – die Middleware prüft die Session erneut. */
    }
    router.push("/");
    router.refresh();
  }

  return (
    <Button type="button" variant="ghost" size="sm" onClick={logout} disabled={busy}>
      <LogOut className="h-4 w-4" aria-hidden="true" />
      <span>{busy ? "Abmelden …" : "Abmelden"}</span>
    </Button>
  );
}
