"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CircleSlash } from "lucide-react";
import { Notice } from "@/components/admin/core/notice";
import { useToast } from "@/components/admin/core/toast";
import { PILL } from "@/components/admin/core/styles";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { describeError } from "./form-utils";
import { Switch } from "./switch";

function Status({ ok, yes, no }: { ok: boolean; yes: string; no: string }) {
  return (
    <span
      className={cn(
        PILL,
        ok ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30" : "bg-zinc-800/80 text-zinc-400 ring-zinc-700",
      )}
    >
      {ok ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : <CircleSlash className="h-3.5 w-3.5" aria-hidden="true" />}
      {ok ? yes : no}
    </span>
  );
}

export function RegistrationForm({ enabled, mailConfigured }: { enabled: boolean; mailConfigured: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(next: boolean) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/admin/settings/site", { method: "PUT", body: { registrationEnabled: next } });
      toast.success(next ? "Registrierung aktiviert." : "Registrierung deaktiviert.");
      router.refresh();
    } catch (err) {
      setError(describeError(err, "Die Einstellung konnte nicht gespeichert werden.").message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {!mailConfigured && (
        <Notice variant="warning">
          Zuerst E-Mail einrichten: Ohne Mailserver können keine Bestätigungs-E-Mails verschickt werden. Trage dafür oben unter{" "}
          <a href="#email" className="font-medium underline">E-Mail (SMTP)</a> die Zugangsdaten ein.
        </Notice>
      )}
      {error && <Notice variant="error">{error}</Notice>}

      <Switch
        id="registration-enabled"
        checked={enabled}
        onChange={toggle}
        disabled={busy || (!mailConfigured && !enabled)}
        label="Registrierung neuer Website-Nutzer erlauben"
        description="Besucher können sich mit E-Mail-Adresse und Passwort registrieren und müssen ihre Adresse per Link bestätigen. Bestehende Konten können sich weiterhin anmelden."
      />

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 px-4 py-3">
          <dt className="text-zinc-400">Mailserver</dt>
          <dd>
            <Status ok={mailConfigured} yes="Konfiguriert" no="Nicht konfiguriert" />
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 px-4 py-3">
          <dt className="text-zinc-400">Registrierung</dt>
          <dd>
            <Status ok={enabled} yes="Aktiv" no="Deaktiviert" />
          </dd>
        </div>
      </dl>

      <p className="text-sm text-zinc-400">
        <a href="/register" target="_blank" rel="noopener noreferrer" className="font-medium text-emerald-400 hover:underline">
          Registrierungsseite ansehen<span className="sr-only"> (öffnet in neuem Tab)</span>
        </a>
      </p>
    </div>
  );
}
