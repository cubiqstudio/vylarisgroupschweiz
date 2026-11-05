"use client";

import { useState } from "react";
import { CheckCircle2, Info, LogOut } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { Button, ButtonLink } from "@/components/ui/button";
import { FormAlert } from "@/components/account/form-parts";
import { useMessages } from "@/i18n/client";
import { vereinAnlaesse } from "@/i18n/verein-anlaesse";

type Result = "CANCELLED" | "ALREADY" | "UNKNOWN" | "STARTED";

/** Abmeldung über den Link aus der Mail. Das Abmelden löst erst der Klick aus (nicht schon das Öffnen des Links, damit Mail-Scanner nichts auslösen). */
export function CancelByToken({ token }: { token: string }) {
  const m = useMessages(vereinAnlaesse).cancelPage;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  async function run() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ result: Result }>("/api/events/cancel", { method: "POST", body: { token } });
      setResult(res.result);
    } catch (err) {
      setError(err instanceof ApiClientError && err.status !== 429 && err.status < 500 ? err.message : m.failed);
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    const text = {
      CANCELLED: { icon: <CheckCircle2 className="size-8 text-emerald-400" aria-hidden />, title: m.successTitle, body: m.successText },
      ALREADY: { icon: <Info className="size-8 text-sky-300" aria-hidden />, title: m.alreadyTitle, body: m.alreadyText },
      STARTED: { icon: <Info className="size-8 text-amber-300" aria-hidden />, title: m.startedTitle, body: m.startedText },
      UNKNOWN: { icon: <Info className="size-8 text-rose-300" aria-hidden />, title: m.unknownTitle, body: m.unknownText },
    }[result];
    return (
      <div role="status" className="space-y-3">
        {text.icon}
        <h2 className="text-lg font-semibold text-white">{text.title}</h2>
        <p className="text-sm leading-relaxed text-zinc-400">{text.body}</p>
        <ButtonLink href="/anlaesse" variant="secondary">
          {m.allEvents}
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <FormAlert>
          <p>{error}</p>
        </FormAlert>
      )}
      <Button type="button" variant="danger" size="lg" onClick={run} disabled={busy}>
        <LogOut className="size-4" aria-hidden />
        {busy ? m.confirming : m.confirm}
      </Button>
    </div>
  );
}
