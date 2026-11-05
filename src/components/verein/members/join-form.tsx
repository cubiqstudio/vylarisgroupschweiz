"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/form";
import { FieldBox, FormAlert, fieldA11y, textLink } from "@/components/account/form-parts";
import { useMessages } from "@/i18n/client";
import { vereinMitglieder } from "@/i18n/verein-mitglieder";

export type JoinType = { id: string; name: string; description: string; fee: string | null };

type Values = {
  membershipTypeId: string;
  salutation: string;
  firstName: string;
  lastName: string;
  street: string;
  houseNumber: string;
  zip: string;
  city: string;
  country: string;
  email: string;
  phone: string;
  communicationPref: string;
  message: string;
  consent: boolean;
  website: string;
};

const FIELD_ORDER = ["membershipTypeId", "firstName", "lastName", "email", "street", "houseNumber", "zip", "city", "country", "phone", "communicationPref", "message", "consent"] as const;

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="text-base font-semibold text-white">{title}</legend>
      {hint && <p className="-mt-2 text-sm text-zinc-400">{hint}</p>}
      {children}
    </fieldset>
  );
}

/** Öffentliches Beitrittsformular. Pflicht sind Name, E-Mail und die Bestätigung; der Server prüft alles noch einmal. */
export function JoinForm({ types }: { types: JoinType[] }) {
  const m = useMessages(vereinMitglieder).join;
  const uid = useId();
  const id = (n: string) => `${uid}-${n}`;
  const successRef = useRef<HTMLDivElement>(null);
  const [v, setV] = useState<Values>({
    membershipTypeId: types.length === 1 ? types[0]!.id : "",
    salutation: "",
    firstName: "",
    lastName: "",
    street: "",
    houseNumber: "",
    zip: "",
    city: "",
    country: "CH",
    email: "",
    phone: "",
    communicationPref: "EMAIL",
    message: "",
    consent: false,
    website: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof Values, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

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
      await api("/api/membership/apply", { method: "POST", body: v });
      setDone(true);
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
        else if (err.code === "APPLICATIONS_CLOSED") setFormError(m.closedNow);
        else setFormError(err.message);
      } else setFormError(m.unexpected);
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <Card className="p-6 sm:p-8">
        <div ref={successRef} tabIndex={-1} role="status" className="space-y-4 outline-none">
          <CheckCircle2 className="size-10 text-emerald-400" aria-hidden />
          <h2 className="text-xl font-semibold tracking-tight text-white">{m.successTitle}</h2>
          <p className="text-sm leading-relaxed text-zinc-400">{m.successText}</p>
          <p className="text-sm leading-relaxed text-zinc-400">{m.successSpam}</p>
          <ButtonLink href="/" variant="secondary">
            {m.toHome}
          </ButtonLink>
        </div>
      </Card>
    );
  }

  const selected = types.find((t) => t.id === v.membershipTypeId);
  const bind = (key: keyof Values) => ({ id: id(key), name: key, ...fieldA11y(id(key), errors[key]), disabled: loading });

  return (
    <Card className="p-6 sm:p-8">
      <form onSubmit={onSubmit} noValidate aria-busy={loading} className="space-y-8">
        {formError && (
          <FormAlert>
            <p>{formError}</p>
          </FormAlert>
        )}

        {types.length > 0 && (
          <Group title={m.sections.membership}>
            <FieldBox id={id("membershipTypeId")} label={m.labels.type} error={errors.membershipTypeId} hint={selected?.fee ? `${m.feeLine(selected.fee)}. ${m.feeNote}` : selected?.description || undefined}>
              <Select {...bind("membershipTypeId")} required value={v.membershipTypeId} onChange={(e) => set("membershipTypeId", e.target.value)}>
                <option value="">{m.typePlaceholder}</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.fee ? ` (${m.feeLine(t.fee)})` : ""}
                  </option>
                ))}
              </Select>
            </FieldBox>
          </Group>
        )}

        <Group title={m.sections.person}>
          <FieldBox id={id("salutation")} label={m.labels.salutation}>
            <Select {...bind("salutation")} value={v.salutation} onChange={(e) => set("salutation", e.target.value)} autoComplete="honorific-prefix">
              <option value="">{m.noSalutation}</option>
              <option value="FRAU">{m.salutations.FRAU}</option>
              <option value="HERR">{m.salutations.HERR}</option>
            </Select>
          </FieldBox>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldBox id={id("firstName")} label={m.labels.firstName} error={errors.firstName}>
              <Input {...bind("firstName")} required maxLength={80} autoComplete="given-name" value={v.firstName} onChange={(e) => set("firstName", e.target.value)} />
            </FieldBox>
            <FieldBox id={id("lastName")} label={m.labels.lastName} error={errors.lastName}>
              <Input {...bind("lastName")} required maxLength={80} autoComplete="family-name" value={v.lastName} onChange={(e) => set("lastName", e.target.value)} />
            </FieldBox>
          </div>
        </Group>

        <Group title={m.sections.contact}>
          <FieldBox id={id("email")} label={m.labels.email} error={errors.email} hint={m.emailHint}>
            <Input {...bind("email")} {...fieldA11y(id("email"), errors.email, true)} type="email" required maxLength={254} inputMode="email" autoComplete="email" value={v.email} onChange={(e) => set("email", e.target.value)} />
          </FieldBox>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldBox id={id("phone")} label={m.labels.phone} error={errors.phone}>
              <Input {...bind("phone")} type="tel" maxLength={30} autoComplete="tel" value={v.phone} onChange={(e) => set("phone", e.target.value)} />
            </FieldBox>
            <FieldBox id={id("communicationPref")} label={m.labels.communicationPref} error={errors.communicationPref}>
              <Select {...bind("communicationPref")} value={v.communicationPref} onChange={(e) => set("communicationPref", e.target.value)}>
                <option value="EMAIL">{m.prefs.EMAIL}</option>
                <option value="POST">{m.prefs.POST}</option>
              </Select>
            </FieldBox>
          </div>
        </Group>

        <Group title={m.sections.address} hint={m.addressHint}>
          <div className="grid gap-4 sm:grid-cols-[1fr_6rem]">
            <FieldBox id={id("street")} label={m.labels.street} error={errors.street}>
              <Input {...bind("street")} maxLength={100} autoComplete="address-line1" value={v.street} onChange={(e) => set("street", e.target.value)} />
            </FieldBox>
            <FieldBox id={id("houseNumber")} label={m.labels.houseNumber} error={errors.houseNumber}>
              <Input {...bind("houseNumber")} maxLength={20} value={v.houseNumber} onChange={(e) => set("houseNumber", e.target.value)} />
            </FieldBox>
          </div>
          <div className="grid gap-4 sm:grid-cols-[8rem_1fr_6rem]">
            <FieldBox id={id("zip")} label={m.labels.zip} error={errors.zip}>
              <Input {...bind("zip")} maxLength={10} inputMode="numeric" autoComplete="postal-code" value={v.zip} onChange={(e) => set("zip", e.target.value)} />
            </FieldBox>
            <FieldBox id={id("city")} label={m.labels.city} error={errors.city}>
              <Input {...bind("city")} maxLength={80} autoComplete="address-level2" value={v.city} onChange={(e) => set("city", e.target.value)} />
            </FieldBox>
            <FieldBox id={id("country")} label={m.labels.country} error={errors.country}>
              <Input {...bind("country")} maxLength={2} className="uppercase" autoComplete="country" value={v.country} onChange={(e) => set("country", e.target.value)} />
            </FieldBox>
          </div>
        </Group>

        <FieldBox id={id("message")} label={m.labels.message} error={errors.message}>
          <Textarea {...bind("message")} rows={3} maxLength={1000} value={v.message} onChange={(e) => set("message", e.target.value)} />
        </FieldBox>

        {/* Honeypot: für Menschen unsichtbar und nicht erreichbar, Bots füllen es aus. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label htmlFor={id("website")}>{m.honeypot}</label>
          <input id={id("website")} name="website" type="text" tabIndex={-1} autoComplete="off" value={v.website} onChange={(e) => set("website", e.target.value)} />
        </div>

        <div className="space-y-3">
          <p className="text-sm leading-relaxed text-zinc-400">{m.privacyNote}</p>
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
              <Link href="/verein/statuten" target="_blank" rel="noopener" className={textLink}>
                {m.consentStatutes}
              </Link>{" "}
              {m.consentMid}{" "}
              <Link href="/datenschutz" target="_blank" rel="noopener" className={textLink}>
                {m.consentPrivacy}
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

        <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <Send className="size-4" aria-hidden />}
          {loading ? m.submitting : m.submit}
        </Button>
      </form>
    </Card>
  );
}
