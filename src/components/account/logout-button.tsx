"use client";

import { useState } from "react";
import { Loader2, LogOut } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { useMessages } from "@/i18n/client";
import { account } from "@/i18n/account";

export function LogoutButton() {
  const m = useMessages(account);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function logout() {
    if (loading) return;
    setLoading(true);
    setError(false);
    try {
      await api("/api/auth/logout", { method: "POST" });
      // Vollständiges Neuladen, damit Header und Server-Komponenten den abgemeldeten Zustand zeigen.
      window.location.assign("/");
    } catch {
      setLoading(false);
      setError(true);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button type="button" variant="secondary" onClick={() => void logout()} disabled={loading}>
        {loading ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <LogOut className="size-4" aria-hidden />}
        {loading ? m.logout.submitting : m.logout.submit}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-rose-400">
          {m.logout.failed}
        </p>
      )}
    </div>
  );
}
