"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { CheckCircle2, Loader2, UserPlus } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { useMessages } from "@/i18n/client";
import { account } from "@/i18n/account";
import { FieldBox, FormAlert, fieldA11y, textLink } from "./form-parts";
import { PasswordInput, PasswordPolicy } from "./password-input";
import { ResendVerification } from "./resend-verification";

type FieldName = "name" | "email" | "password" | "consent";
const ORDER: FieldName[] = ["name", "email", "password", "consent"];

export function RegisterForm() {
  const uid = useId();
  const id = (n: string) => `${uid}-${n}`;
  const successRef = useRef<HTMLDivElement>(null);
  const m = useMessages(account);

  const [values, setValues] = useState({
    name: "",
    email: "",
    password: "",
    consent: false,
    website: "",
  });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [formError, setFormError] = useState<{
    code: string;
    message: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  useEffect(() => {
    if (sentTo) successRef.current?.focus();
  }, [sentTo]);

  function set<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    if (key in fieldErrors) setFieldErrors((e) => ({ ...e, [key]: undefined }));
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setFormError(null);
    setFieldErrors({});
    try {
      await api("/api/auth/register", { method: "POST", body: values });
      setSentTo(values.email.trim());
      setValues((v) => ({ ...v, password: "" }));
    } catch (err) {
      if (err instanceof ApiClientError) {
        const first = ORDER.find((f) => err.fields?.[f]);
        if (err.fields && first) {
          const known: Partial<Record<FieldName, string>> = {};
          for (const f of ORDER) if (err.fields[f]) known[f] = err.fields[f];
          setFieldErrors(known);
          setFormError({
            code: "VALIDATION_ERROR",
            message: m.register.checkFields,
          });
          requestAnimationFrame(() => document.getElementById(id(first))?.focus());
        } else if (err.status === 429) {
          setFormError({ code: err.code, message: m.register.tooMany });
        } else {
          setFormError({ code: err.code, message: err.message });
        }
      } else {
        setFormError({ code: "UNKNOWN", message: m.register.unexpected });
      }
    } finally {
      setLoading(false);
    }
  }

  if (sentTo) {
    return (
      <div ref={successRef} tabIndex={-1} role="status" className="space-y-4 outline-none">
        <CheckCircle2 className="size-10 text-emerald-400" aria-hidden />
        <h2 className="text-xl font-semibold tracking-tight text-white">{m.common.checkInbox}</h2>
        <p className="text-sm leading-relaxed text-zinc-400">
          {m.register.sentPre}
          <strong className="break-all font-medium text-zinc-200">{sentTo}</strong>
          {m.register.sentPost}
        </p>
        <p className="text-sm leading-relaxed text-zinc-400">{m.register.sentSpam}</p>
        <div className="space-y-3 border-t border-zinc-800 pt-4">
          <ResendVerification email={sentTo} />
          <ButtonLink href="/login" variant="ghost" size="sm">
            {m.common.toLogin}
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={loading} className="space-y-5">
      {formError && (
        <FormAlert>
          <p>{formError.message}</p>
          {formError.code === "MAIL_FAILED" && <ResendVerification email={values.email.trim()} label={m.register.resendAgain} />}
        </FormAlert>
      )}

      <FieldBox id={id("name")} label={m.common.name} error={fieldErrors.name}>
        <Input
          id={id("name")}
          name="name"
          autoComplete="name"
          required
          maxLength={80}
          value={values.name}
          onChange={(e) => set("name", e.target.value)}
          {...fieldA11y(id("name"), fieldErrors.name)}
        />
      </FieldBox>

      <FieldBox id={id("email")} label={m.common.email} error={fieldErrors.email}>
        <Input
          id={id("email")}
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          maxLength={200}
          value={values.email}
          onChange={(e) => set("email", e.target.value)}
          {...fieldA11y(id("email"), fieldErrors.email)}
        />
      </FieldBox>

      <FieldBox id={id("password")} label={m.common.password} error={fieldErrors.password} hint={m.common.passwordHint}>
        <PasswordInput
          id={id("password")}
          name="password"
          autoComplete="new-password"
          required
          maxLength={200}
          value={values.password}
          onChange={(e) => set("password", e.target.value)}
          {...fieldA11y(id("password"), fieldErrors.password, true)}
        />
        <PasswordPolicy value={values.password} />
      </FieldBox>

      {/* Honeypot: für Menschen unsichtbar und nicht erreichbar, Bots füllen es aus. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor={id("website")}>{m.register.honeypot}</label>
        <input id={id("website")} name="website" type="text" tabIndex={-1} autoComplete="off" value={values.website} onChange={(e) => set("website", e.target.value)} />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-start gap-3">
          <input
            id={id("consent")}
            name="consent"
            type="checkbox"
            checked={values.consent}
            onChange={(e) => set("consent", e.target.checked)}
            required
            {...fieldA11y(id("consent"), fieldErrors.consent)}
            className="mt-0.5 size-4 shrink-0 rounded border-zinc-700 bg-zinc-950 accent-emerald-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
          />
          <label htmlFor={id("consent")} className="text-sm leading-relaxed text-zinc-400">
            {m.register.consentPre}{" "}
            <Link href={m.common.privacyHref} target="_blank" rel="noopener" className={textLink}>
              {m.register.consentLink}
            </Link>{" "}
            {m.register.consentPost}
          </label>
        </div>
        {fieldErrors.consent && (
          <p id={`${id("consent")}-error`} role="alert" className="pl-7 text-xs text-rose-400">
            {fieldErrors.consent}
          </p>
        )}
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={loading}>
        {loading ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <UserPlus className="size-4" aria-hidden />}
        {loading ? m.register.submitting : m.register.submit}
      </Button>
    </form>
  );
}
