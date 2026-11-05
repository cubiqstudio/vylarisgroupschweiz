"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { api } from "@/lib/api-client";
import { Notice } from "@/components/admin/core/notice";
import { useToast } from "@/components/admin/core/toast";
import { describeError } from "./form-utils";

export type LegalValues = {
  responsible: string;
  street: string;
  zipCity: string;
  country: string;
  phone: string;
  register: string;
  vatId: string;
  email: string;
  smallBusiness: boolean;
  noRegister: boolean;
  hideRegister: boolean;
  hideVat: boolean;
};

export function LegalForm({ initial, isComplete }: { initial: LegalValues; isComplete: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [values, setValues] = useState<LegalValues>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  const set = (k: Exclude<keyof LegalValues, "smallBusiness" | "noRegister" | "hideRegister" | "hideVat">) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));
  const setFlag = (k: "smallBusiness" | "noRegister" | "hideRegister" | "hideVat") => (e: { target: { checked: boolean } }) =>
    setValues((v) => ({ ...v, [k]: e.target.checked }));
  const invalid = (k: string) => (fields[k] ? true : undefined);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setFields({});
    try {
      await api("/api/admin/settings/legal", { method: "PUT", body: values });
      toast.success("Rechtliche Angaben gespeichert.");
      router.refresh();
    } catch (err) {
      const d = describeError(err, "Die Angaben konnten nicht gespeichert werden.");
      setError(d.message);
      setFields(d.fields);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {isComplete ? (
        <Notice variant="success">Die Pflichtangaben (Straße, PLZ/Ort und Kontakt-E-Mail) sind vollständig.</Notice>
      ) : (
        <Notice variant="warning">
          Die Pflichtangaben sind noch unvollständig. Für ein rechtssicheres Impressum fehlen Straße, PLZ/Ort oder die Kontakt-E-Mail.
        </Notice>
      )}
      {error && <Notice variant="error">{error}</Notice>}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Verantwortlich i. S. d. § 18 Abs. 2 MStV" htmlFor="legal-responsible" error={fields.responsible} className="sm:col-span-2">
          <Input id="legal-responsible" value={values.responsible} onChange={set("responsible")} maxLength={120} disabled={busy} aria-invalid={invalid("responsible")} autoComplete="off" />
        </Field>
        <Field label="Straße und Hausnummer" htmlFor="legal-street" error={fields.street}>
          <Input id="legal-street" value={values.street} onChange={set("street")} maxLength={160} disabled={busy} aria-invalid={invalid("street")} autoComplete="off" />
        </Field>
        <Field label="PLZ und Ort" htmlFor="legal-zip" error={fields.zipCity}>
          <Input id="legal-zip" value={values.zipCity} onChange={set("zipCity")} maxLength={120} disabled={busy} aria-invalid={invalid("zipCity")} autoComplete="off" />
        </Field>
        <Field label="Land" htmlFor="legal-country" error={fields.country}>
          <Input id="legal-country" value={values.country} onChange={set("country")} maxLength={80} disabled={busy} aria-invalid={invalid("country")} autoComplete="off" />
        </Field>
        <Field label="Telefon (optional)" htmlFor="legal-phone" error={fields.phone}>
          <Input id="legal-phone" type="tel" value={values.phone} onChange={set("phone")} maxLength={60} disabled={busy} aria-invalid={invalid("phone")} autoComplete="off" />
        </Field>
        <Field label="Kontakt-E-Mail" htmlFor="legal-email" error={fields.email} hint="Wird im Impressum und in der Datenschutzerklärung genannt.">
          <Input id="legal-email" type="email" value={values.email} onChange={set("email")} maxLength={200} disabled={busy} aria-invalid={invalid("email")} autoComplete="off" />
        </Field>
        <Field
          label="Umsatzsteuer-ID (optional)"
          htmlFor="legal-vat"
          error={fields.vatId}
          hint={values.smallBusiness ? "Bei Kleinunternehmern wird keine USt-IdNr. im Impressum angezeigt." : undefined}
        >
          <Input id="legal-vat" value={values.vatId} onChange={set("vatId")} maxLength={40} disabled={busy || values.smallBusiness || values.hideVat} aria-invalid={invalid("vatId")} autoComplete="off" />
        </Field>
        <Field
          label="Handelsregister / Registereintrag (optional)"
          htmlFor="legal-register"
          error={fields.register}
          hint={values.noRegister ? "Ist als „nicht eingetragen“ markiert – die Angabe wird im Impressum nicht angezeigt." : undefined}
        >
          <Input id="legal-register" value={values.register} onChange={set("register")} maxLength={200} disabled={busy || values.noRegister || values.hideRegister} aria-invalid={invalid("register")} autoComplete="off" />
        </Field>
      </div>

      <fieldset className="space-y-3 rounded-xl border border-zinc-800 bg-surface p-4">
        <legend className="px-1 text-sm font-semibold text-white">Unternehmensform &amp; Steuer</legend>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={values.smallBusiness}
            onChange={setFlag("smallBusiness")}
            disabled={busy}
            className="mt-1 h-4 w-4 rounded border-zinc-700 accent-emerald-400"
          />
          <span className="text-sm">
            <span className="font-medium text-white">Wir sind Kleinunternehmer (§ 19 UStG)</span>
            <span className="mt-0.5 block text-zinc-400">
              Im Impressum steht dann, dass keine Umsatzsteuer ausgewiesen wird; eine Umsatzsteuer-Identifikationsnummer ist nicht anzugeben.
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={values.noRegister}
            onChange={setFlag("noRegister")}
            disabled={busy}
            className="mt-1 h-4 w-4 rounded border-zinc-700 accent-emerald-400"
          />
          <span className="text-sm">
            <span className="font-medium text-white">Kein Handelsregister- bzw. Registereintrag vorhanden</span>
            <span className="mt-0.5 block text-zinc-400">Im Impressum steht dann, dass kein Registereintrag besteht – „Angabe ergänzen“ entfällt.</span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={values.hideRegister}
            onChange={setFlag("hideRegister")}
            disabled={busy}
            className="mt-1 h-4 w-4 rounded border-zinc-700 accent-emerald-400"
          />
          <span className="text-sm">
            <span className="font-medium text-white">Registereintrag im Impressum nicht anzeigen</span>
            <span className="mt-0.5 block text-zinc-400">Die ganze Zeile „Registereintrag“ entfällt – auch „Angabe ergänzen“ und der Hinweis „kein Registereintrag“.</span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={values.hideVat}
            onChange={setFlag("hideVat")}
            disabled={busy}
            className="mt-1 h-4 w-4 rounded border-zinc-700 accent-emerald-400"
          />
          <span className="text-sm">
            <span className="font-medium text-white">Umsatzsteuer-ID im Impressum nicht anzeigen</span>
            <span className="mt-0.5 block text-zinc-400">Die Zeile „Umsatzsteuer-Identifikationsnummer“ entfällt – auch „Angabe ergänzen“ und der Kleinunternehmer-Hinweis.</span>
          </span>
        </label>
        <p className="text-xs text-zinc-500">
          Hinweis: Die Wahl ersetzt keine Rechtsberatung. Bitte prüfe, ob die Voraussetzungen für dich tatsächlich erfüllt sind.
        </p>
      </fieldset>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-zinc-400">
          Diese Angaben erscheinen in Impressum und Datenschutzerklärung.{" "}
          <a
            href="/impressum"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-emerald-400 hover:underline"
          >
            Impressum ansehen
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="sr-only">(öffnet in neuem Tab)</span>
          </a>
        </p>
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
          {busy ? "Speichern …" : "Speichern"}
        </Button>
      </div>
    </form>
  );
}
