"use client";

import { useId, useState } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { FormSuccess } from "./form-parts";
import { useMessages } from "@/i18n/client";
import { account } from "@/i18n/account";

/**
 * "Bestätigungsmail erneut senden". Mit `email` genügt ein Button, sonst wird die Adresse abgefragt.
 * Die Antwort ist immer neutral (verrät nicht, ob ein Konto existiert).
 */
export function ResendVerification({ email, label }: { email?: string; label?: string }) {
  const uid = useId();
  const m = useMessages(account);
  const [addr, setAddr] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const target = (email ?? addr).trim();

  async function send() {
    if (state === "loading") return;
    if (!target) {
      setError(m.resend.needEmail);
      return;
    }
    setState("loading");
    setError(null);
    try {
      await api("/api/auth/resend", {
        method: "POST",
        body: { email: target },
      });
      setState("done");
    } catch (err) {
      setState("idle");
      if (err instanceof ApiClientError && err.status === 429) {
        setError(m.resend.tooMany);
      } else if (err instanceof ApiClientError && err.fields?.email) {
        setError(err.fields.email);
      } else {
        setError(err instanceof ApiClientError ? err.message : m.resend.failed);
      }
    }
  }

  if (state === "done") {
    return <FormSuccess>{m.resend.done}</FormSuccess>;
  }

  return (
    <div className="space-y-2">
      {email === undefined && (
        <div className="space-y-1.5">
          <label htmlFor={`${uid}-email`} className="block text-sm font-medium text-zinc-300">
            {m.common.email}
          </label>
          <Input
            id={`${uid}-email`}
            type="email"
            autoComplete="email"
            inputMode="email"
            maxLength={200}
            value={addr}
            onChange={(e) => setAddr(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void send();
              }
            }}
          />
        </div>
      )}
      <Button type="button" variant="secondary" size="sm" onClick={() => void send()} disabled={state === "loading"}>
        {state === "loading" ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <MailCheck className="size-4" aria-hidden />}
        {label ?? m.resend.label}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-rose-400">
          {error}
        </p>
      )}
    </div>
  );
}
