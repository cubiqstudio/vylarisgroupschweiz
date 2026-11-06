"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/form";
import { FieldBox, FormAlert, fieldA11y, textLink } from "@/components/account/form-parts";
import { useMessages } from "@/i18n/client";
import { vereinAnlaesse } from "@/i18n/verein-anlaesse";

type Values = { name: string; email: string; seats: string; note: string; consent: boolean; website: string };
const FIELD_ORDER = ["name", "email", "seats", "note", "consent"] as const;

/** Anmeldung eines Gastes (ohne Konto). Pflicht sind Name, E-Mail und die Bestätigung des Datenschutzhinweises; der Server prüft alles noch einmal. */
export function GuestRegistrationForm({ eventId, maxSeats, seatsLeft }: { eventId: string; maxSeats: number; seatsLeft: number | null }) {
  const m = useMessages(vereinAnlaesse).guest;
  const uid = useId();
  const id = (n: string) => `${uid}-${n}`;
  const successRef = useRef<HTMLDivElement>(null);
  const [v, setV] = useState<Values>({ name: "", email: "", seats: "1", note: "", consent: false, website: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof Values, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<{ email: string } | null>(null);

  useEffect(() => {
    if (done) successRef.current?.focus();
  }, [done]);

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setV((s) => ({ ...s, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setFormError(null);
    setErrors({});
    try {
      await api<{ received: true }>(`/api/events/${encodeURIComponent(eventId)}/guest`, { method: "POST", body: { ...v, email: v.email.trim() } });
      setDone({ email: v.email.trim() });
    } catch (err) {
      if (err instanceof ApiClientError) {
        const first = FIELD_ORDER.find((f) => err.fields?.[f]);
        if (err.fields && first) {
          const known: Partial<Record<keyof Values, string>> = {};
          for (const f of FIELD_ORDER) if (err.fields[f]) known[f] = err.fields[f];
          setErrors(known);
          setFormError(m.checkFields);
          requestAnimationFrame(() => document.getElementById(id(first))?.focus());
        } else if (err.status === 429) setFormError(m.tooMany);
        else setFormError(err.message);
      } else setFormError(m.unexpected);
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div ref={successRef} tabIndex={-1} role="status" className="space-y-3 outline-none">
        <CheckCircle2 className="size-8 text-emerald-400" aria-hidden />
        <h3 className="text-lg font-semibold text-white">{m.successTitle}</h3>
        <p className="text-sm leading-relaxed text-zinc-300">{m.successReceived(done.email)}</p>
        <p className="text-sm leading-relaxed text-zinc-400">{m.successSpam}</p>
      </div>
    );
  }

  const max = seatsLeft !== null && seatsLeft > 0 ? Math.min(maxSeats, seatsLeft) : maxSeats;
  const bind = (key: keyof Values) => ({ id: id(key), name: key, ...fieldA11y(id(key), errors[key]), disabled: loading });

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={loading} aria-labelledby={id("title")} className="space-y-5">
      <div>
        <h3 id={id("title")} className="text-lg font-semibold text-white">
          {m.title}
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-zinc-400">{m.intro}</p>
      </div>
      {formError && (
        <FormAlert>
          <p>{formError}</p>
        </FormAlert>
      )}
      <FieldBox id={id("name")} label={m.labels.name} error={errors.name}>
        <Input {...bind("name")} required maxLength={100} autoComplete="name" value={v.name} onChange={(e) => set("name", e.target.value)} />
      </FieldBox>
      <FieldBox id={id("email")} label={m.labels.email} error={errors.email} hint={m.emailHint}>
        <Input {...bind("email")} {...fieldA11y(id("email"), errors.email, true)} type="email" required maxLength={254} inputMode="email" autoComplete="email" value={v.email} onChange={(e) => set("email", e.target.value)} />
      </FieldBox>
      <FieldBox id={id("seats")} label={m.labels.seats} error={errors.seats} hint={m.seatsHint(maxSeats)}>
        <Input {...bind("seats")} {...fieldA11y(id("seats"), errors.seats, true)} type="number" min={1} max={max} inputMode="numeric" required className="max-w-28" value={v.seats} onChange={(e) => set("seats", e.target.value)} />
      </FieldBox>
      <FieldBox id={id("note")} label={m.labels.note} error={errors.note}>
        <Textarea {...bind("note")} rows={2} maxLength={300} value={v.note} onChange={(e) => set("note", e.target.value)} />
      </FieldBox>

      {/* Honeypot: für Menschen unsichtbar und nicht erreichbar, Bots füllen es aus. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor={id("website")}>{m.honeypot}</label>
        <input id={id("website")} name="website" type="text" tabIndex={-1} autoComplete="off" value={v.website} onChange={(e) => set("website", e.target.value)} />
      </div>

      <div className="space-y-3">
        <p className="text-xs leading-relaxed text-zinc-500">{m.privacyNote}</p>
        <div className="flex items-start gap-3">
          <input
            {...bind("consent")}
            type="checkbox"
            checked={v.consent}
            onChange={(e) => set("consent", e.target.checked)}
            required
            className="mt-0.5 size-4 shrink-0 rounded border-zinc-700 bg-zinc-950 accent-emerald-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
          />
          <label htmlFor={id("consent")} className="text-sm leading-relaxed text-zinc-300">
            {m.consentPre}{" "}
            <Link href="/datenschutz" target="_blank" rel="noopener" className={textLink}>
              {m.consentLink}
            </Link>{" "}
            {m.consentPost}
          </label>
        </div>
        {errors.consent && (
          <p id={`${id("consent")}-error`} role="alert" className="pl-7 text-xs text-rose-400">
            {errors.consent}
          </p>
        )}
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={loading}>
        {loading ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <Send className="size-4" aria-hidden />}
        {loading ? m.submitting : m.submit}
      </Button>
    </form>
  );
}

/** Rahmen für das Gast-Formular auf der Detailseite. */
export function GuestRegistrationCard(props: { eventId: string; maxSeats: number; seatsLeft: number | null }) {
  return (
    <Card className="relative p-5 sm:p-6">
      <GuestRegistrationForm {...props} />
    </Card>
  );
}

