"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, MailCheck } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { Button, ButtonLink } from "@/components/ui/button";
import { FormAlert } from "@/components/account/form-parts";
import { useMessages } from "@/i18n/client";
import { newsletter } from "@/i18n/newsletter";
import { transportMessage } from "./client-error";

/** Das Token wird bewusst erst per Klick (POST) verbraucht – Mail-Scanner rufen Links per GET ab. */
export function ConfirmForm({ token }: { token: string }) {
  const m = useMessages(newsletter);
  const t = m.confirm;
  const [state, setState] = useState<"idle" | "loading" | "done" | "invalid">("idle");
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (state === "loading") return;
    setState("loading");
    setError(null);
    try {
      await api("/api/newsletter/confirm", { method: "POST", body: { token } });
      setState("done");
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "INVALID_TOKEN") {
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

  if (state === "invalid") return <InvalidConfirm />;

  return (
    <div className="space-y-5">
      {error && (
        <FormAlert>
          <p>{error}</p>
        </FormAlert>
      )}
      <p className="text-sm leading-relaxed text-zinc-400">{t.prompt}</p>
      <Button type="button" size="lg" className="w-full" onClick={() => void confirm()} disabled={state === "loading"}>
        {state === "loading" ? (
          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
        ) : (
          <MailCheck className="size-4" aria-hidden />
        )}
        {state === "loading" ? t.loading : t.button}
      </Button>
    </div>
  );
}

/** Ungültiger, abgelaufener oder bereits genutzter Bestätigungslink (auch ohne Token). */
export function InvalidConfirm() {
  const t = useMessages(newsletter).confirm;
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
