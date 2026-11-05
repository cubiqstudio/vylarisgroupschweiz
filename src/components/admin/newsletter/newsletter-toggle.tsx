"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, MailWarning } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/admin/settings/switch";
import { useToast } from "@/components/admin/core/toast";

type Settings = { enabled: boolean; mailConfigured: boolean };

/** Schalter „Newsletter aktiv“ samt Hinweis zum Mailserver. Einschalten geht nur mit eingerichtetem Mailserver. */
export function NewsletterToggle({ enabled: initialEnabled, mailConfigured }: Settings) {
  const router = useRouter();
  const toast = useToast();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [busy, setBusy] = useState(false);

  async function change(next: boolean) {
    if (busy) return;
    setBusy(true);
    const previous = enabled;
    setEnabled(next);
    try {
      const res = await api<Settings>("/api/admin/newsletter/settings", { method: "PUT", body: { enabled: next } });
      setEnabled(res.enabled);
      toast.success(res.enabled ? "Newsletter eingeschaltet." : "Newsletter ausgeschaltet.");
      router.refresh();
    } catch (err) {
      setEnabled(previous);
      toast.error(err instanceof ApiClientError ? err.message : "Die Einstellung konnte nicht gespeichert werden.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <Switch
        id="newsletter-enabled"
        checked={enabled}
        onChange={change}
        disabled={busy || (!mailConfigured && !enabled)}
        label="Newsletter aktiv"
        description="Wenn aktiv, ist die Anmeldung auf der Website verfügbar und Kampagnen können versendet werden."
      />
      <p
        className={cn(
          "inline-flex items-start gap-2 rounded-xl px-3 py-2 text-sm ring-1 ring-inset sm:max-w-sm",
          mailConfigured ? "bg-green-500/10 text-green-800 ring-green-600/30" : "bg-amber-500/10 text-amber-300 ring-amber-500/30",
        )}
      >
        {mailConfigured ? (
          <>
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>Mailserver ist eingerichtet.</span>
          </>
        ) : (
          <>
            <MailWarning className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              Kein Mailserver eingerichtet. Ohne Mailserver bleibt der Newsletter aus.{" "}
              <Link href="/admin/settings" className="font-medium underline underline-offset-2">
                Zu den Einstellungen
              </Link>
            </span>
          </>
        )}
      </p>
    </div>
  );
}
