"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, MailCheck } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { Button, ButtonLink } from "@/components/ui/button";
import { FormAlert } from "./form-parts";
import { ResendVerification } from "./resend-verification";
import { useMessages } from "@/i18n/client";
import { account } from "@/i18n/account";

/** Das Token wird bewusst erst per Klick (POST) verbraucht – Mail-Scanner rufen Links per GET ab. */
export function VerifyForm({ token }: { token: string }) {
  const m = useMessages(account);
  const [state, setState] = useState<"idle" | "loading" | "done" | "invalid">("idle");
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (state === "loading") return;
    setState("loading");
    setError(null);
    try {
      await api("/api/auth/verify", { method: "POST", body: { token } });
      setState("done");
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "INVALID_TOKEN") {
        setState("invalid");
      } else {
        setState("idle");
        setError(err instanceof ApiClientError && err.status === 429 ? m.common.tooManyTries : err instanceof ApiClientError ? err.message : m.verify.failed);
      }
    }
  }

  if (state === "done") {
    return (
      <div role="status" className="space-y-4">
        <CheckCircle2 className="size-10 text-emerald-400" aria-hidden />
        <h2 className="text-xl font-semibold tracking-tight text-white">{m.verify.doneTitle}</h2>
        <p className="text-sm leading-relaxed text-zinc-400">{m.verify.doneText}</p>
        <ButtonLink href="/login" size="lg" className="w-full">
          {m.verify.signInNow}
        </ButtonLink>
      </div>
    );
  }

  if (state === "invalid") {
    return (
      <div className="space-y-4">
        <FormAlert>
          <p>{m.verify.invalid}</p>
        </FormAlert>
        <ResendVerification label={m.verify.requestNew} />
        <ButtonLink href="/login" variant="ghost" size="sm">
          {m.common.toLogin}
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error && (
        <FormAlert>
          <p>{error}</p>
        </FormAlert>
      )}
      <p className="text-sm leading-relaxed text-zinc-400">{m.verify.intro}</p>
      <Button type="button" size="lg" className="w-full" onClick={() => void confirm()} disabled={state === "loading"}>
        {state === "loading" ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <MailCheck className="size-4" aria-hidden />}
        {state === "loading" ? m.verify.submitting : m.verify.submit}
      </Button>
    </div>
  );
}
