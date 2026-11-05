"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { FieldBox, FormAlert, fieldA11y } from "./form-parts";
import { useMessages } from "@/i18n/client";
import { account } from "@/i18n/account";

export function ForgotForm() {
  const uid = useId();
  const emailId = `${uid}-email`;
  const doneRef = useRef<HTMLDivElement>(null);
  const m = useMessages(account);
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done) doneRef.current?.focus();
  }, [done]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    setFieldError(undefined);
    try {
      await api("/api/auth/forgot", { method: "POST", body: { email } });
      setDone(true);
    } catch (err) {
      if (err instanceof ApiClientError && err.fields?.email) {
        setFieldError(err.fields.email);
        requestAnimationFrame(() => document.getElementById(emailId)?.focus());
      } else if (err instanceof ApiClientError && err.status === 429) {
        setError(m.forgot.tooMany);
      } else {
        setError(err instanceof ApiClientError ? err.message : m.forgot.failed);
      }
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div ref={doneRef} tabIndex={-1} role="status" className="space-y-4 outline-none">
        <CheckCircle2 className="size-10 text-emerald-400" aria-hidden />
        <h2 className="text-xl font-semibold tracking-tight text-white">{m.common.checkInbox}</h2>
        <p className="text-sm leading-relaxed text-zinc-400">{m.forgot.doneText}</p>
        <ButtonLink href="/login" variant="secondary" size="sm">
          {m.forgot.backToLogin}
        </ButtonLink>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={loading} className="space-y-5">
      {error && (
        <FormAlert>
          <p>{error}</p>
        </FormAlert>
      )}
      <FieldBox id={emailId} label={m.common.email} error={fieldError}>
        <Input
          id={emailId}
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          autoFocus
          maxLength={200}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setFieldError(undefined);
          }}
          {...fieldA11y(emailId, fieldError)}
        />
      </FieldBox>
      <Button type="submit" size="lg" className="w-full" disabled={loading}>
        {loading ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <Send className="size-4" aria-hidden />}
        {loading ? m.forgot.submitting : m.forgot.submit}
      </Button>
    </form>
  );
}
