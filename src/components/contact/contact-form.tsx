"use client";

import Link from "next/link";
import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { AlertTriangle, Check, Copy, Inbox, Loader2, Mail, MessageSquareReply, Send, Settings2, Info } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { TICKET_CATEGORIES, type TicketCategory } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { intlTag } from "@/i18n";
import { useLocale, useMessages, useSite } from "@/i18n/client";
import { labelFor } from "@/i18n/labels";
import { contact } from "@/i18n/contact";
import { transportMessage } from "@/components/newsletter/client-error";
import { TICKET_CATEGORY_ICON } from "./ticket-category";

const MAX_MESSAGE = 5000;

const SUCCESS_STEP_ICONS = [Inbox, Settings2, MessageSquareReply] as const;

type FieldName = "name" | "email" | "subject" | "category" | "message" | "consent";

type Values = {
  name: string;
  email: string;
  subject: string;
  category: TicketCategory;
  message: string;
  consent: boolean;
  website: string;
};

export function ContactForm({ initialCategory = "GENERAL", mark }: { initialCategory?: TicketCategory; mark?: ReactNode }) {
  const m = useMessages(contact).form;
  const site = useSite();
  const locale = useLocale();
  const uid = useId();
  const id = (n: string) => `${uid}-${n}`;
  const successRef = useRef<HTMLDivElement>(null);

  const [values, setValues] = useState<Values>({
    name: "",
    email: "",
    subject: "",
    category: initialCategory,
    message: "",
    consent: false,
    website: "",
  });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ticket, setTicket] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<{
    category: TicketCategory;
    subject: string;
    email: string;
  } | null>(null);
  const [copied, setCopied] = useState<"idle" | "ok" | "fail">("idle");

  function set<K extends keyof Values>(key: K, value: Values[K]) {
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
      const res = await api<{ ticketNumber: string }>("/api/contact", {
        method: "POST",
        body: {
          name: values.name,
          email: values.email,
          subject: values.subject,
          category: values.category,
          message: values.message,
          consent: values.consent,
          website: values.website,
        },
      });
      setSubmitted({
        category: values.category,
        subject: values.subject.trim(),
        email: values.email.trim(),
      });
      setTicket(res.ticketNumber);
      setCopied("idle");
      requestAnimationFrame(() => successRef.current?.focus());
    } catch (err) {
      if (err instanceof ApiClientError) {
        const order: FieldName[] = ["name", "email", "subject", "category", "message", "consent"];
        const first = order.find((f) => err.fields?.[f]);
        if (err.fields && first) {
          const known: Partial<Record<FieldName, string>> = {};
          for (const f of order) if (err.fields[f]) known[f] = err.fields[f];
          setFieldErrors(known);
          setFormError(m.errors.checkFields);
          // Fokus auf das erste fehlerhafte Feld
          requestAnimationFrame(() => document.getElementById(id(first))?.focus());
        } else if (err.status === 429) {
          setFormError(m.errors.tooMany);
        } else {
          setFormError(transportMessage(err, m.errors) ?? err.message);
        }
      } else {
        setFormError(m.errors.unexpected);
      }
    } finally {
      setLoading(false);
    }
  }

  async function copyTicket() {
    if (!ticket) return;
    try {
      await navigator.clipboard.writeText(ticket);
      setCopied("ok");
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = ticket;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        const okCopy = document.execCommand("copy");
        document.body.removeChild(ta);
        setCopied(okCopy ? "ok" : "fail");
      } catch {
        setCopied("fail");
      }
    }
    window.setTimeout(() => setCopied("idle"), 2500);
  }

  function reset() {
    setTicket(null);
    setSubmitted(null);
    setValues({
      name: "",
      email: "",
      subject: "",
      category: initialCategory,
      message: "",
      consent: false,
      website: "",
    });
    setFieldErrors({});
    setFormError(null);
    requestAnimationFrame(() => document.getElementById(id("name"))?.focus());
  }

  if (ticket) {
    const cat = submitted?.category ?? "GENERAL";
    const CatIcon = TICKET_CATEGORY_ICON[cat];
    return (
      <Card className="relative overflow-hidden">
        <div className="relative overflow-hidden bg-ink px-6 pb-12 pt-6 sm:px-8">
          <div className="pointer-events-none absolute -right-10 -top-16 size-56 rounded-full bg-emerald-400/30 blur-3xl" aria-hidden />
          <div className="pointer-events-none absolute -bottom-24 left-1/3 size-48 rounded-full bg-indigo-400/20 blur-3xl" aria-hidden />
          <div className="relative flex items-center gap-3.5">
            {mark}
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-surface/60">{m.success.badge}</p>
              <p className="text-lg font-semibold text-surface">{m.success.headline}</p>
            </div>
          </div>
        </div>

        <div ref={successRef} tabIndex={-1} role="status" className="relative px-6 pb-6 outline-none sm:px-8 sm:pb-8">
          <span className="-mt-9 flex size-[4.5rem] items-center justify-center rounded-full bg-surface ring-4 ring-surface">
            <span className="flex size-full items-center justify-center rounded-full bg-emerald-400 text-surface shadow-lg shadow-emerald-400/30">
              <Check className="size-9" strokeWidth={3} aria-hidden />
            </span>
          </span>
          <h2 className="mt-5 text-2xl font-semibold tracking-tight text-white">{m.success.title}</h2>
          <p className="mt-2 text-zinc-400">{m.success.lead}</p>

          <div className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{m.success.ticketLabel}</p>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p
                className="select-all break-all font-mono text-2xl font-semibold tracking-wider text-white sm:text-3xl"
                aria-label={m.success.ticketAria(ticket)}
              >
                {ticket}
              </p>
              <Button type="button" variant="secondary" size="lg" onClick={copyTicket} className="shrink-0">
                {copied === "ok" ? <Check className="size-4 text-emerald-400" aria-hidden /> : <Copy className="size-4" aria-hidden />}
                {copied === "ok" ? m.success.copied : m.success.copy}
              </Button>
            </div>
            <p className="mt-2 min-h-5 text-sm text-zinc-500" aria-live="polite">
              {copied === "fail" ? m.success.copyFail : ""}
            </p>
          </div>

          {submitted && (
            <dl className="mt-4 grid gap-3 rounded-2xl border border-zinc-800 p-4 text-sm sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-x-6 sm:p-5">
              <dt className="font-medium text-zinc-500">{m.success.category}</dt>
              <dd className="flex items-center gap-2 font-medium text-zinc-100">
                <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-400/10 text-emerald-400">
                  <CatIcon className="size-4" aria-hidden />
                </span>
                {labelFor("ticketCategory", cat, locale)}
              </dd>
              <dt className="font-medium text-zinc-500">{m.success.subject}</dt>
              <dd className="min-w-0 break-words text-zinc-100">{submitted.subject}</dd>
            </dl>
          )}

          <ol aria-label={m.success.stepsLabel} className="mt-7 grid grid-cols-3">
            {m.steps.map((label, i) => {
              const Icon = SUCCESS_STEP_ICONS[i] ?? Inbox;
              const done = i === 0;
              return (
                <li key={label} aria-current={done ? "step" : undefined} className="relative flex flex-col items-center text-center">
                  {i < m.steps.length - 1 && (
                    <span className={cn("absolute left-1/2 top-[1.125rem] h-0.5 w-full", done ? "bg-emerald-400/50" : "bg-zinc-800")} aria-hidden />
                  )}
                  <span
                    className={cn(
                      "relative flex size-9 items-center justify-center rounded-full ring-4 ring-surface",
                      done ? "bg-emerald-400 text-surface" : "bg-zinc-900 text-zinc-500 ring-offset-0",
                    )}
                  >
                    {done ? <Check className="size-4" strokeWidth={3} aria-hidden /> : <Icon className="size-4" aria-hidden />}
                  </span>
                  <span className={cn("mt-2 text-xs font-medium sm:text-sm", done ? "text-white" : "text-zinc-500")}>
                    {label}
                    <span className="sr-only">{done ? m.success.stepDone : m.success.stepNext}</span>
                  </span>
                </li>
              );
            })}
          </ol>

          <ul className="mt-7 space-y-2.5 text-sm leading-relaxed text-zinc-400">
            <li className="flex items-start gap-2.5 rounded-xl bg-zinc-900 p-3.5">
              <Info className="mt-0.5 size-4 shrink-0 text-emerald-400" aria-hidden />
              <span>
                <strong className="font-semibold text-zinc-200">{m.success.keepStrong}</strong> {m.success.keepRest}
              </span>
            </li>
            <li className="flex items-start gap-2.5 rounded-xl bg-zinc-900 p-3.5">
              <Mail className="mt-0.5 size-4 shrink-0 text-emerald-400" aria-hidden />
              <span>
                {m.success.confirmPre}
                {submitted?.email ? (
                  <>
                    {" "}
                    {m.success.confirmTo} <span className="break-words font-medium text-zinc-200">{submitted.email}</span>
                  </>
                ) : null}
                {m.success.confirmPost}
              </span>
            </li>
          </ul>

          <Button type="button" variant="secondary" className="mt-6" onClick={reset}>
            <Send className="size-4" aria-hidden />
            {m.success.another}
          </Button>
        </div>
      </Card>
    );
  }

  const describedBy = (name: FieldName, extra?: string) =>
    [fieldErrors[name] ? `${id(name)}-error` : null, extra].filter(Boolean).join(" ") || undefined;

  return (
    <Card className="p-6 sm:p-8">
      <form onSubmit={onSubmit} noValidate aria-busy={loading} className="space-y-5">
        {formError && (
          <div role="alert" className="flex items-start gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>{formError}</p>
          </div>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <FieldBox label={m.fields.name} htmlFor={id("name")} error={fieldErrors.name} errorId={`${id("name")}-error`}>
            <Input
              id={id("name")}
              name="name"
              autoComplete="name"
              required
              maxLength={100}
              value={values.name}
              onChange={(e) => set("name", e.target.value)}
              aria-invalid={!!fieldErrors.name}
              aria-describedby={describedBy("name")}
            />
          </FieldBox>
          <FieldBox label={m.fields.email} htmlFor={id("email")} error={fieldErrors.email} errorId={`${id("email")}-error`}>
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
              aria-invalid={!!fieldErrors.email}
              aria-describedby={describedBy("email")}
            />
          </FieldBox>
        </div>

        <FieldBox label={m.fields.subject} htmlFor={id("subject")} error={fieldErrors.subject} errorId={`${id("subject")}-error`}>
          <Input
            id={id("subject")}
            name="subject"
            required
            maxLength={150}
            value={values.subject}
            onChange={(e) => set("subject", e.target.value)}
            aria-invalid={!!fieldErrors.subject}
            aria-describedby={describedBy("subject")}
          />
        </FieldBox>

        <fieldset aria-describedby={describedBy("category", `${id("category")}-help`)} className="space-y-1.5">
          <legend className="mb-1.5 text-sm font-medium text-zinc-300">{m.fields.category}</legend>
          <div className="grid gap-2.5 sm:grid-cols-3">
            {TICKET_CATEGORIES.map((c, i) => {
              const checked = values.category === c;
              const Icon = TICKET_CATEGORY_ICON[c];
              return (
                <label
                  key={c}
                  className={cn(
                    "relative flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors sm:flex-col sm:items-start sm:gap-2.5 sm:p-3.5",
                    "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-emerald-400/50 has-[:focus-visible]:ring-offset-2",
                    checked
                      ? "border-emerald-400 bg-emerald-400/[0.07] shadow-sm"
                      : "border-zinc-800 bg-surface hover:border-zinc-700 hover:bg-zinc-950",
                  )}
                >
                  <input
                    id={i === 0 ? id("category") : undefined}
                    type="radio"
                    name="category"
                    value={c}
                    checked={checked}
                    onChange={() => set("category", c)}
                    className="sr-only"
                  />
                  <span
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors",
                      checked ? "bg-emerald-400 text-surface" : "bg-zinc-900 text-zinc-500",
                    )}
                    aria-hidden
                  >
                    <Icon className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className={cn("block text-sm font-semibold", checked ? "text-white" : "text-zinc-200")}>
                      {labelFor("ticketCategory", c, locale)}
                    </span>
                    <span className="block text-xs text-zinc-500">{m.categoryTagline[c]}</span>
                  </span>
                  <span
                    className={cn(
                      "absolute right-2.5 top-2.5 flex size-5 items-center justify-center rounded-full transition-opacity",
                      checked ? "bg-emerald-400 text-surface opacity-100" : "opacity-0",
                    )}
                    aria-hidden
                  >
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                </label>
              );
            })}
          </div>
          <p id={`${id("category")}-help`} className="text-xs leading-relaxed text-zinc-500" aria-live="polite">
            {m.categoryHelp[values.category]?.(site)}
          </p>
          {fieldErrors.category && (
            <p id={`${id("category")}-error`} role="alert" className="text-xs text-rose-400">
              {fieldErrors.category}
            </p>
          )}
        </fieldset>

        <div className="space-y-1.5">
          <label htmlFor={id("message")} className="block text-sm font-medium text-zinc-300">
            {m.fields.message}
          </label>
          <Textarea
            id={id("message")}
            name="message"
            required
            rows={8}
            maxLength={MAX_MESSAGE}
            value={values.message}
            onChange={(e) => set("message", e.target.value)}
            aria-invalid={!!fieldErrors.message}
            aria-describedby={describedBy("message", `${id("message")}-count`)}
          />
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              {fieldErrors.message && (
                <p id={`${id("message")}-error`} role="alert" className="text-xs text-rose-400">
                  {fieldErrors.message}
                </p>
              )}
            </div>
            <p
              id={`${id("message")}-count`}
              className={cn("ml-auto shrink-0 text-xs tabular-nums", values.message.length > MAX_MESSAGE * 0.95 ? "text-amber-400" : "text-zinc-500")}
            >
              {values.message.length.toLocaleString(intlTag(locale))} / {MAX_MESSAGE.toLocaleString(intlTag(locale))}
            </p>
          </div>
        </div>

        {/* Honeypot: für Menschen unsichtbar und nicht erreichbar, Bots füllen es aus. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label htmlFor={id("website")}>{m.fields.honeypot}</label>
          <input
            id={id("website")}
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={values.website}
            onChange={(e) => set("website", e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-start gap-3">
            <input
              id={id("consent")}
              name="consent"
              type="checkbox"
              checked={values.consent}
              onChange={(e) => set("consent", e.target.checked)}
              aria-invalid={!!fieldErrors.consent}
              aria-describedby={describedBy("consent")}
              required
              className="mt-0.5 size-4 shrink-0 rounded border-zinc-700 bg-zinc-950 accent-emerald-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
            />
            <label htmlFor={id("consent")} className="text-sm leading-relaxed text-zinc-400">
              {m.consentPre}{" "}
              <Link
                href={m.privacyHref}
                className="text-emerald-400 underline underline-offset-4 hover:text-emerald-300"
                target="_blank"
                rel="noopener"
              >
                {m.consentLink}
              </Link>
              {m.consentPost}
            </label>
          </div>
          {fieldErrors.consent && (
            <p id={`${id("consent")}-error`} role="alert" className="pl-7 text-xs text-rose-400">
              {fieldErrors.consent}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center">
          <Button type="submit" size="lg" disabled={loading} className="w-full sm:w-auto">
            {loading ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <Send className="size-4" aria-hidden />}
            {loading ? m.submitting : m.submit}
          </Button>
          <p className="text-xs text-zinc-500">{m.allRequired}</p>
        </div>
      </form>
    </Card>
  );
}

/** Field-Wrapper mit stabiler Fehler-ID (für aria-describedby). */
function FieldBox({
  label,
  htmlFor,
  error,
  errorId,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  errorId: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-zinc-300">
        {label}
      </label>
      {children}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-rose-400">
          {error}
        </p>
      )}
    </div>
  );
}
