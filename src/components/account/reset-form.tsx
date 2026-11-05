"use client";

import Link from "next/link";
import { useId, useState, type FormEvent } from "react";
import { CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { Button, ButtonLink } from "@/components/ui/button";
import { FieldBox, FormAlert, fieldA11y, textLink } from "./form-parts";
import { PasswordInput, PasswordPolicy } from "./password-input";
import { useMessages } from "@/i18n/client";
import { account } from "@/i18n/account";

export function ResetForm({ token }: { token: string }) {
  const uid = useId();
  const m = useMessages(account);
  const id = (n: string) => `${uid}-${n}`;
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [errors, setErrors] = useState<{ password?: string; repeat?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "done" | "invalid">("idle");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state === "loading") return;
    setError(null);
    if (password !== repeat) {
      setErrors({ repeat: m.reset.mismatch });
      document.getElementById(id("repeat"))?.focus();
      return;
    }
    setErrors({});
    setState("loading");
    try {
      await api("/api/auth/reset", {
        method: "POST",
        body: { token, password },
      });
      setState("done");
    } catch (err) {
      setState("idle");
      if (err instanceof ApiClientError && err.code === "INVALID_TOKEN") {
        setState("invalid");
      } else if (err instanceof ApiClientError && err.fields?.password) {
        setErrors({ password: err.fields.password });
        requestAnimationFrame(() => document.getElementById(id("password"))?.focus());
      } else if (err instanceof ApiClientError && err.status === 429) {
        setError(m.common.tooManyTries);
      } else {
        setError(err instanceof ApiClientError ? err.message : m.reset.failed);
      }
    }
  }

  if (state === "done") {
    return (
      <div role="status" className="space-y-4">
        <CheckCircle2 className="size-10 text-emerald-400" aria-hidden />
        <h2 className="text-xl font-semibold tracking-tight text-white">{m.reset.doneTitle}</h2>
        <p className="text-sm leading-relaxed text-zinc-400">{m.reset.doneText}</p>
        <ButtonLink href="/login" size="lg" className="w-full">
          {m.common.toLogin}
        </ButtonLink>
      </div>
    );
  }

  if (state === "invalid") {
    return (
      <div className="space-y-4">
        <FormAlert>
          <p>{m.reset.invalid}</p>
        </FormAlert>
        <ButtonLink href="/forgot-password" size="lg" className="w-full">
          {m.reset.requestNew}
        </ButtonLink>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={state === "loading"} className="space-y-5">
      {error && (
        <FormAlert>
          <p>{error}</p>
        </FormAlert>
      )}
      <FieldBox id={id("password")} label={m.reset.newPassword} error={errors.password} hint={m.common.passwordHint}>
        <PasswordInput
          id={id("password")}
          name="password"
          autoComplete="new-password"
          required
          autoFocus
          maxLength={200}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setErrors((x) => ({ ...x, password: undefined }));
          }}
          {...fieldA11y(id("password"), errors.password, true)}
        />
        <PasswordPolicy value={password} />
      </FieldBox>
      <FieldBox id={id("repeat")} label={m.reset.repeat} error={errors.repeat}>
        <PasswordInput
          id={id("repeat")}
          name="password-repeat"
          autoComplete="new-password"
          required
          maxLength={200}
          value={repeat}
          onChange={(e) => {
            setRepeat(e.target.value);
            setErrors((x) => ({ ...x, repeat: undefined }));
          }}
          {...fieldA11y(id("repeat"), errors.repeat)}
        />
      </FieldBox>
      <Button type="submit" size="lg" className="w-full" disabled={state === "loading"}>
        {state === "loading" ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <KeyRound className="size-4" aria-hidden />}
        {state === "loading" ? m.common.saving : m.reset.submit}
      </Button>
      <p className="text-center text-xs text-zinc-500">
        <Link href="/login" className={textLink}>
          {m.common.cancel}
        </Link>
      </p>
    </form>
  );
}
