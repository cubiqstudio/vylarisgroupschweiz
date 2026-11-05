"use client";

import Link from "next/link";
import { useId, useState, type FormEvent } from "react";
import { ArrowRight, Loader2, MailCheck, ShieldCheck } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useMessages } from "@/i18n/client";
import { newsletter } from "@/i18n/newsletter";
import { BrandMark } from "./brand-mark";
import { transportMessage } from "./client-error";

type Variant = "footer" | "card";
type Errors = Partial<Record<"email" | "consent", string>>;

/**
 * Anmeldeformular mit Double-Opt-In. `footer` ist kompakt für den dunklen Footer, `card` ein heller Block für Seiten.
 * `markSrc` (V-Zeichen passend zum Untergrund) liefert NewsletterBlock; ohne Angabe wird ein schlichtes V gezeichnet.
 */
export function NewsletterSignup({ variant = "card", markSrc, className }: { variant?: Variant; markSrc?: string | null; className?: string }) {
  const m = useMessages(newsletter);
  const t = m.signup;
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;
  const dark = variant === "footer";

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState(""); // Honeypot
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    setFormError(null);

    const local: Errors = {};
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) local.email = t.emailError;
    if (!consent) local.consent = t.consentError;
    setErrors(local);
    if (Object.keys(local).length > 0) return;

    setLoading(true);
    try {
      await api("/api/newsletter/subscribe", {
        method: "POST",
        body: {
          email: email.trim(),
          name: name.trim(),
          consent: true,
          website,
        },
      });
      setDone(true);
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.fields && (err.fields.email || err.fields.consent)) {
          setErrors({ email: err.fields.email, consent: err.fields.consent });
        } else if (err.code === "NEWSLETTER_DISABLED") {
          setFormError(t.disabled);
        } else {
          setFormError(transportMessage(err, m.transport) ?? err.message);
        }
      } else {
        setFormError(t.failed);
      }
    } finally {
      setLoading(false);
    }
  }

  const c = dark
    ? {
        title: "text-[#ffffff]",
        text: "text-[#d1d1d1]",
        label: "text-[#d1d1d1]",
        link: "text-ondark-link underline underline-offset-4 hover:text-[#ffffff]",
        input:
          "h-11 w-full rounded-lg border border-[#333] bg-[#1a1a1a] px-3 text-sm text-[#ffffff] placeholder:text-[#9a9a9a] hover:border-[#4a4a4a] focus:border-ondark-link focus:outline-none focus:ring-2 focus:ring-ondark-link/30 disabled:opacity-60",
        error: "text-[#ff9aa8]",
        button:
          "bg-[#ffffff] text-[#101010] hover:bg-[#d1d1d1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ondark-link",
        check: "accent-[#5aa9e6]",
        alert: "border-[#5a2a33] bg-[#2a1a1d] text-[#ffb3be]",
        ok: "border-[#333] bg-[#1a1a1a] text-[#d1d1d1]",
        okIcon: "text-ondark-link",
        tile: "border-[#333] bg-[#1a1a1a]",
      }
    : {
        title: "text-white",
        text: "text-zinc-400",
        label: "text-zinc-300",
        link: "text-emerald-400 underline underline-offset-4 hover:text-emerald-300",
        input:
          "h-11 w-full rounded-lg border border-zinc-600 bg-surface px-3 text-sm text-zinc-100 placeholder:text-zinc-500 hover:border-zinc-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/25 disabled:opacity-60",
        error: "text-rose-400",
        button: "bg-ink text-surface hover:bg-zinc-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400",
        check: "accent-emerald-400",
        alert: "border-rose-500/30 bg-rose-500/10 text-rose-200",
        ok: "border-emerald-400/30 bg-emerald-400/10 text-zinc-300",
        okIcon: "text-emerald-400",
        tile: "border-zinc-800 bg-surface shadow-sm",
      };

  const tone = dark ? "dark" : "light";

  const success = (
    <div role="status" className={cn("flex items-start gap-3 rounded-xl border p-4 text-sm leading-relaxed motion-safe:animate-fade-up", c.ok)}>
      <MailCheck className={cn("mt-0.5 size-5 shrink-0", c.okIcon)} aria-hidden />
      <div>
        <p className={cn("font-semibold", c.title)}>{t.successTitle}</p>
        <p className="mt-1">{t.successText}</p>
      </div>
    </div>
  );

  const form = (
    <form onSubmit={(e) => void submit(e)} noValidate className={cn("space-y-3", dark ? "mt-4" : "mt-6")}>
      {/* Honeypot: für Menschen unsichtbar und nicht erreichbar, Bots füllen es aus */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor={id("website")}>{t.honeypot}</label>
        <input
          id={id("website")}
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      {formError && (
        <p role="alert" className={cn("rounded-lg border px-3 py-2.5 text-sm", c.alert)}>
          {formError}
        </p>
      )}

      <div className={cn("grid gap-3", !dark && "sm:grid-cols-2")}>
        <div className="space-y-1.5">
          <label htmlFor={id("name")} className={cn("block text-sm font-medium", c.label)}>
            {t.name} <span className="font-normal opacity-70">{t.optional}</span>
          </label>
          <input
            id={id("name")}
            name="name"
            type="text"
            autoComplete="name"
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
            className={c.input}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={id("email")} className={cn("block text-sm font-medium", c.label)}>
            {t.email}
          </label>
          <input
            id={id("email")}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            maxLength={200}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? id("email-error") : undefined}
            className={c.input}
          />
          {errors.email && (
            <p id={id("email-error")} role="alert" className={cn("text-xs", c.error)}>
              {errors.email}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-start gap-2.5">
          <input
            id={id("consent")}
            name="consent"
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            disabled={loading}
            aria-invalid={errors.consent ? true : undefined}
            aria-describedby={errors.consent ? id("consent-error") : undefined}
            className={cn("mt-0.5 size-4 shrink-0 cursor-pointer", c.check)}
          />
          <label htmlFor={id("consent")} className={cn("text-xs leading-relaxed", c.text)}>
            {t.consentPre}{" "}
            <Link href={t.privacyHref} target="_blank" rel="noopener" className={c.link}>
              {t.consentLink}
            </Link>
            {t.consentPost}
          </label>
        </div>
        {errors.consent && (
          <p id={id("consent-error")} role="alert" className={cn("text-xs", c.error)}>
            {errors.consent}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={loading}
        className={cn(
          "group inline-flex h-11 w-full items-center justify-center gap-2 rounded-md px-5 text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-60",
          !dark && "sm:w-auto",
          c.button,
        )}
      >
        {loading ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : null}
        {loading ? t.sending : t.submit}
        {!loading && <ArrowRight className="size-4 transition-transform motion-safe:group-hover:translate-x-0.5" aria-hidden />}
      </button>
    </form>
  );

  if (dark) {
    // Schlanke Leiste: links Titel + Kurztext, rechts E-Mail + Button in einer Zeile, Einwilligung klein darunter.
    return (
      <section
        aria-labelledby={id("title")}
        className={cn(
          "relative rounded-xl border border-[#2a2a2a] bg-[#161616] p-4 sm:px-5 md:flex md:items-center md:justify-between md:gap-8",
          className,
        )}
      >
        <div className="flex items-center gap-3 md:max-w-sm">
          <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg border", c.tile)}>
            <BrandMark src={markSrc} tone={tone} className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 id={id("title")} className={cn("text-sm font-bold uppercase tracking-wider", c.title)}>
              {t.footerTitle}
            </h2>
            <p className={cn("text-xs leading-snug", c.text)}>{t.footerText}</p>
          </div>
        </div>

        <div className="mt-3 md:mt-0 md:w-full md:max-w-md">
          {done ? (
            <p role="status" className={cn("flex items-center gap-2 text-sm", c.text)}>
              <MailCheck className={cn("size-4 shrink-0", c.okIcon)} aria-hidden />
              {t.successShort}
            </p>
          ) : (
            <form onSubmit={(e) => void submit(e)} noValidate>
              <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                <label htmlFor={id("website")}>{t.honeypot}</label>
                <input
                  id={id("website")}
                  name="website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>
              {formError && (
                <p role="alert" className={cn("mb-2 rounded-md border px-3 py-2 text-xs", c.alert)}>
                  {formError}
                </p>
              )}
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="min-w-0 flex-1">
                  <label htmlFor={id("email")} className="sr-only">
                    {t.email}
                  </label>
                  <input
                    id={id("email")}
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    required
                    maxLength={200}
                    placeholder={t.emailPlaceholder}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    aria-invalid={errors.email ? true : undefined}
                    aria-describedby={errors.email ? id("email-error") : undefined}
                    className={cn(c.input, "h-10")}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className={cn(
                    "inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-60",
                    c.button,
                  )}
                >
                  {loading ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : null}
                  {loading ? t.sendingShort : t.submitShort}
                </button>
              </div>
              {errors.email && (
                <p id={id("email-error")} role="alert" className={cn("mt-1 text-xs", c.error)}>
                  {errors.email}
                </p>
              )}
              <div className="mt-2 flex items-start gap-2">
                <input
                  id={id("consent")}
                  name="consent"
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  disabled={loading}
                  aria-invalid={errors.consent ? true : undefined}
                  aria-describedby={errors.consent ? id("consent-error") : undefined}
                  className={cn("mt-0.5 size-3.5 shrink-0 cursor-pointer", c.check)}
                />
                <label htmlFor={id("consent")} className={cn("text-[11px] leading-snug", c.text)}>
                  {t.consentPre}{" "}
                  <Link href={t.privacyHref} target="_blank" rel="noopener" className={c.link}>
                    {t.consentLink}
                  </Link>
                  {t.consentPost}
                </label>
              </div>
              {errors.consent && (
                <p id={id("consent-error")} role="alert" className={cn("mt-1 text-xs", c.error)}>
                  {errors.consent}
                </p>
              )}
            </form>
          )}
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby={id("title")}
      className={cn("bg-hero relative isolate overflow-hidden rounded-2xl border border-zinc-800 p-6 sm:p-8", className)}
    >
      <div className="bg-grid pointer-events-none absolute inset-0 -z-10" aria-hidden />
      <BrandMark src={markSrc} tone={tone} className="pointer-events-none absolute -bottom-12 -right-10 -z-10 size-64 opacity-[0.07]" />
      <div className="flex items-center gap-4">
        <span className={cn("flex size-14 shrink-0 items-center justify-center rounded-2xl border", c.tile)}>
          <BrandMark src={markSrc} tone={tone} className="size-9" />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">{t.eyebrow}</p>
          <h2 id={id("title")} className={cn("text-balance text-xl font-semibold tracking-tight sm:text-2xl", c.title)}>
            {t.title}
          </h2>
        </div>
      </div>
      <p className={cn("mt-4 max-w-xl text-sm leading-relaxed", c.text)}>{t.lead}</p>
      {done ? <div className="mt-6">{success}</div> : form}
      {!done && (
        <p className={cn("mt-4 flex items-center gap-1.5 text-xs", c.text)}>
          <ShieldCheck className={cn("size-3.5", c.okIcon)} aria-hidden /> {t.doi}
        </p>
      )}
    </section>
  );
}
