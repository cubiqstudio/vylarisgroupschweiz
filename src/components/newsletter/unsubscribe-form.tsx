"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, MailX } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { Button, ButtonLink } from "@/components/ui/button";
import { FormAlert } from "@/components/account/form-parts";
import { useMessages } from "@/i18n/client";
import { newsletter } from "@/i18n/newsletter";
import { transportMessage } from "./client-error";

/** Abmeldung erst per Klick (POST) – das Abrufen der Seite (z. B. durch Mail-Scanner) ändert nichts. */
export function UnsubscribeForm({ token }: { token: string }) {
  const m = useMessages(newsletter);
  const t = m.unsubscribe;
  const [state, setState] = useState<"idle" | "loading" | "done" | "invalid">("idle");
  const [error, setError] = useState<string | null>(null);

  async function unsubscribe() {
    if (state === "loading") return;
    setState("loading");
    setError(null);
    try {
      await api("/api/newsletter/unsubscribe", {
        method: "POST",
        body: { token },
      });
      setState("done");
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 404) {
        setState("invalid");
        return;
      }
      setState("idle");
      setError(
        err instanceof ApiClientError && err.status === 429
          ? t.tooMany
          : err instanceof ApiClientError
            ? (transportMessage(err, m.transport) ?? err.message)
            : t.failed,
      );
    }
  }

  if (state === "done") {
    return (
      <div role="status" className="space-y-4">
        <CheckCircle2 className="size-10 text-emerald-400" aria-hidden />
        <p className="text-sm leading-relaxed text-zinc-400">
          <strong className="font-semibold text-white">{t.doneStrong}</strong> {t.doneText}
        </p>
        <ButtonLink href="/" variant="secondary" size="lg" className="w-full">
          {t.home}
        </ButtonLink>
      </div>
    );
  }

  if (state === "invalid") return <InvalidUnsubscribe />;

  return (
    <div className="space-y-5">
      {error && (
        <FormAlert>
          <p>{error}</p>
        </FormAlert>
      )}
      <p className="text-sm leading-relaxed text-zinc-400">{t.prompt}</p>
      <Button type="button" size="lg" className="w-full" onClick={() => void unsubscribe()} disabled={state === "loading"}>
        {state === "loading" ? (
          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
        ) : (
          <MailX className="size-4" aria-hidden />
        )}
        {state === "loading" ? t.loading : t.button}
      </Button>
      <ButtonLink href="/" variant="ghost" size="sm">
        {t.cancel}
      </ButtonLink>
    </div>
  );
}

/** Unbekannter oder unvollständiger Abmelde-Link (auch ohne Token). */
export function InvalidUnsubscribe() {
  const t = useMessages(newsletter).unsubscribe;
  return (
    <div className="space-y-4">
      <FormAlert>
        <p>{t.invalid}</p>
      </FormAlert>
      <ButtonLink href="/" variant="secondary" size="lg" className="w-full">
        {t.home}
      </ButtonLink>
    </div>
  );
}
