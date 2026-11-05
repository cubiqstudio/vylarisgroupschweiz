"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ExternalLink, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { api } from "@/lib/api-client";
import {
  IMPRINT_GROUPS,
  IMPRINT_ITEMS,
  PRIVACY_ALWAYS,
  PRIVACY_GROUPS,
  PRIVACY_ITEMS,
  emptyShownKeys,
  imprintHasContent,
  imprintWarnings,
  privacyWarnings,
  setImprintGroup,
  setPrivacyGroup,
  visibleImprint,
  type ImprintGroup,
  type ImprintKey,
  type ImprintShow,
  type LegalContent,
  type PrivacyGroup,
  type PrivacyShow,
} from "@/lib/legal-toggles";
import type { LegalSettings } from "@/lib/settings";
import { Notice } from "@/components/admin/core/notice";
import { useToast } from "@/components/admin/core/toast";
import { describeError } from "./form-utils";
import { Switch } from "./switch";

/** Eingabefelder und Aussagen zum Verein (ohne Anzeige-Schalter). */
export type LegalValues = Omit<LegalSettings, "show" | "privacyShow" | "privacyUpdatedAt">;

type TextField = Exclude<keyof LegalValues, "smallBusiness" | "noRegister">;
type FlagField = "smallBusiness" | "noRegister";

const contentOf = (v: LegalValues): LegalContent => ({
  street: v.street,
  zipCity: v.zipCity,
  country: v.country,
  phone: v.phone,
  register: v.register,
  vatId: v.vatId,
  email: v.email,
  smallBusiness: v.smallBusiness,
  noRegister: v.noRegister,
});

/** «2026-11-05» → «5.11.2026» */
function formatStand(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${Number(m[3])}.${Number(m[2])}.${m[1]}` : "";
}

function Warnings({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      {items.map((text) => (
        <Notice key={text} variant="warning">
          {text}
        </Notice>
      ))}
    </div>
  );
}

function PreviewLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-sm font-medium text-emerald-400 hover:underline"
    >
      {label}
      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
      <span className="sr-only">(öffnet in neuem Tab, zeigt den gespeicherten Stand)</span>
    </a>
  );
}

/** Gruppe von Schaltern mit «Alle an» / «Alle aus». */
function SwitchGroup({
  title,
  description,
  on,
  total,
  onAll,
  disabled,
  children,
}: {
  title: string;
  description: string;
  on: number;
  total: number;
  onAll: (value: boolean) => void;
  disabled: boolean;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-surface p-4" aria-label={title}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-white">
            {title} <span className="ml-1 text-xs font-normal text-zinc-500">{on} von {total} angezeigt</span>
          </h4>
          <p className="mt-0.5 text-xs text-zinc-500">{description}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => onAll(true)} disabled={disabled}>
            Alle an
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => onAll(false)} disabled={disabled}>
            Alle aus
          </Button>
        </div>
      </div>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function ToggleRow({
  id,
  checked,
  onChange,
  label,
  description,
  warning,
  disabled,
}: {
  id: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description: string;
  warning?: string;
  disabled: boolean;
}) {
  return (
    <div>
      <Switch id={id} checked={checked} onChange={onChange} label={label} description={description} disabled={disabled} />
      {warning && (
        <p className="ml-14 mt-1 flex items-center gap-1.5 text-xs text-amber-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {warning}
        </p>
      )}
    </div>
  );
}

export function LegalForm({ initial, isComplete }: { initial: LegalSettings; isComplete: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [values, setValues] = useState<LegalValues>(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { show, privacyShow, privacyUpdatedAt, ...rest } = initial;
    return rest;
  });
  const [show, setShow] = useState<ImprintShow>(initial.show);
  const [privacy, setPrivacy] = useState<PrivacyShow>(initial.privacyShow);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  /** Schalter, die von Hand bedient wurden: Sie werden beim Ausfüllen eines Feldes nicht automatisch angehakt. */
  const touched = useRef(new Set<ImprintKey>());

  const content = contentOf(values);
  const visible = visibleImprint(show, content);
  const emptyShown = new Set(emptyShownKeys(show, content));
  const invalid = (k: string) => (fields[k] ? true : undefined);

  const set = (k: TextField) => (e: { target: { value: string } }) => {
    const next = { ...values, [k]: e.target.value };
    // Wird ein bisher leeres Feld ausgefüllt, dessen Schalter noch aus und nie bedient wurde, schaltet er sich ein.
    const before = contentOf(values);
    const after = contentOf(next);
    const auto: Partial<ImprintShow> = {};
    for (const item of IMPRINT_ITEMS) {
      if ("fields" in item && !show[item.key] && !touched.current.has(item.key) && !imprintHasContent(item.key, before) && imprintHasContent(item.key, after)) {
        auto[item.key] = true;
      }
    }
    setValues(next);
    if (Object.keys(auto).length > 0) setShow((s) => ({ ...s, ...auto }));
  };
  const setFlag = (k: FlagField) => (e: { target: { checked: boolean } }) => setValues((v) => ({ ...v, [k]: e.target.checked }));

  const setImprint = (key: ImprintKey) => (next: boolean) => {
    touched.current.add(key);
    setShow((s) => ({ ...s, [key]: next }));
  };
  const setImprintAll = (group: ImprintGroup) => (value: boolean) => {
    for (const i of IMPRINT_ITEMS) if (i.group === group) touched.current.add(i.key);
    setShow((s) => setImprintGroup(s, group, value));
  };

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setFields({});
    try {
      await api("/api/admin/settings/legal", { method: "PUT", body: { ...values, show, privacyShow: privacy } });
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

  const stand = formatStand(initial.privacyUpdatedAt);

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {isComplete ? (
        <Notice variant="success">Die Pflichtangaben (Strasse, PLZ/Ort und Kontakt-E-Mail) sind vollständig.</Notice>
      ) : (
        <Notice variant="warning">
          Die Pflichtangaben sind noch unvollständig. Für ein vollständiges Impressum fehlen Strasse, PLZ/Ort oder die Kontakt-E-Mail.
        </Notice>
      )}
      {error && <Notice variant="error">{error}</Notice>}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Ansprechperson"
          htmlFor="legal-responsible"
          error={fields.responsible}
          hint="Wird im Impressum als Ansprechperson genannt. Leer lassen: Es erscheint der Präsident aus den Stammdaten."
          className="sm:col-span-2"
        >
          <Input id="legal-responsible" value={values.responsible} onChange={set("responsible")} maxLength={120} disabled={busy} aria-invalid={invalid("responsible")} autoComplete="off" />
        </Field>
        <Field label="Strasse und Hausnummer" htmlFor="legal-street" error={fields.street}>
          <Input id="legal-street" value={values.street} onChange={set("street")} maxLength={160} disabled={busy} aria-invalid={invalid("street")} autoComplete="off" />
        </Field>
        <Field label="PLZ und Ort" htmlFor="legal-zip" error={fields.zipCity}>
          <Input id="legal-zip" value={values.zipCity} onChange={set("zipCity")} maxLength={120} disabled={busy} aria-invalid={invalid("zipCity")} autoComplete="off" />
        </Field>
        <Field label="Land" htmlFor="legal-country" error={fields.country} hint="Leer lassen: Es erscheint «Schweiz».">
          <Input id="legal-country" value={values.country} onChange={set("country")} maxLength={80} disabled={busy} aria-invalid={invalid("country")} autoComplete="off" />
        </Field>
        <Field label="Telefon (optional)" htmlFor="legal-phone" error={fields.phone}>
          <Input id="legal-phone" type="tel" value={values.phone} onChange={set("phone")} maxLength={60} disabled={busy} aria-invalid={invalid("phone")} autoComplete="off" />
        </Field>
        <Field label="Kontakt-E-Mail" htmlFor="legal-email" error={fields.email} hint="Wird im Impressum und in der Datenschutzerklärung genannt.">
          <Input id="legal-email" type="email" value={values.email} onChange={set("email")} maxLength={200} disabled={busy} aria-invalid={invalid("email")} autoComplete="off" />
        </Field>
        <Field
          label="MWST-Nummer (optional)"
          htmlFor="legal-vat"
          error={fields.vatId}
          hint={values.smallBusiness ? "Bei nicht mehrwertsteuerpflichtigen Vereinen wird keine MWST-Nummer im Impressum angezeigt." : undefined}
        >
          <Input id="legal-vat" value={values.vatId} onChange={set("vatId")} maxLength={40} disabled={busy || values.smallBusiness} aria-invalid={invalid("vatId")} autoComplete="off" />
        </Field>
        <Field
          label="Handelsregister / UID (optional)"
          htmlFor="legal-register"
          error={fields.register}
          hint={values.noRegister ? "Ist als «nicht eingetragen» markiert – die Angabe wird im Impressum nicht angezeigt." : undefined}
        >
          <Input id="legal-register" value={values.register} onChange={set("register")} maxLength={200} disabled={busy || values.noRegister} aria-invalid={invalid("register")} autoComplete="off" />
        </Field>
      </div>

      <fieldset className="space-y-3 rounded-xl border border-zinc-800 bg-surface p-4">
        <legend className="px-1 text-sm font-semibold text-white">Handelsregister &amp; Mehrwertsteuer: Status des Vereins</legend>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={values.smallBusiness}
            onChange={setFlag("smallBusiness")}
            disabled={busy}
            className="mt-1 h-4 w-4 rounded border-zinc-700 accent-emerald-400"
          />
          <span className="text-sm">
            <span className="font-medium text-white">Der Verein ist nicht mehrwertsteuerpflichtig</span>
            <span className="mt-0.5 block text-zinc-400">
              Im Impressum steht dann, dass keine Mehrwertsteuer ausgewiesen wird; eine MWST-Nummer wird nicht angegeben.
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
            <span className="font-medium text-white">Kein Handelsregistereintrag vorhanden</span>
            <span className="mt-0.5 block text-zinc-400">Im Impressum steht dann, dass der Verein nicht im Handelsregister eingetragen ist.</span>
          </span>
        </label>
        <p className="text-xs text-zinc-500">
          Ob diese Zeilen im Impressum erscheinen, steuern die Schalter «Handelsregister / UID» und «MWST-Nummer» weiter unten.
        </p>
      </fieldset>

      <div className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-base font-semibold text-white">Impressum: was angezeigt wird</h3>
          <PreviewLink href="/impressum" label="Vorschau" />
        </div>
        <Warnings items={imprintWarnings(visible)} />
        {IMPRINT_GROUPS.map((g) => {
          const items = IMPRINT_ITEMS.filter((i) => i.group === g.id);
          return (
            <SwitchGroup
              key={g.id}
              title={g.title}
              description={g.description}
              on={items.filter((i) => show[i.key]).length}
              total={items.length}
              onAll={setImprintAll(g.id)}
              disabled={busy}
            >
              {items.map((i) => (
                <ToggleRow
                  key={i.key}
                  id={`legal-show-${i.key}`}
                  checked={show[i.key]}
                  onChange={setImprint(i.key)}
                  label={`${i.label} im Impressum anzeigen`}
                  description={i.description}
                  warning={emptyShown.has(i.key) ? "Feld ist leer – im Impressum erscheint dazu nichts." : undefined}
                  disabled={busy}
                />
              ))}
            </SwitchGroup>
          );
        })}
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-base font-semibold text-white">Datenschutzerklärung: welche Abschnitte angezeigt werden</h3>
          <PreviewLink href="/datenschutz" label="Vorschau" />
        </div>
        <p className="text-sm text-zinc-400">
          Immer enthalten: {PRIVACY_ALWAYS.join(", ")}. Die übrigen Abschnitte hängen an Funktionen; schalte nur ab, was nicht genutzt wird.
          Nummerierung, Inhaltsverzeichnis und Querverweise passen sich an.
        </p>
        <Warnings items={privacyWarnings(privacy)} />
        {PRIVACY_GROUPS.map((g: { id: PrivacyGroup; title: string; description: string }) => {
          const items = PRIVACY_ITEMS.filter((i) => i.group === g.id);
          return (
            <SwitchGroup
              key={g.id}
              title={g.title}
              description={g.description}
              on={items.filter((i) => privacy[i.key]).length}
              total={items.length}
              onAll={(value) => setPrivacy((p) => setPrivacyGroup(p, g.id, value))}
              disabled={busy}
            >
              {items.map((i) => (
                <ToggleRow
                  key={i.key}
                  id={`legal-privacy-${i.key}`}
                  checked={privacy[i.key]}
                  onChange={(next) => setPrivacy((p) => ({ ...p, [i.key]: next }))}
                  label={`${i.label} in der Datenschutzerklärung anzeigen`}
                  description={i.description}
                  disabled={busy}
                />
              ))}
            </SwitchGroup>
          );
        })}
        <p className="text-xs text-zinc-500">
          {stand ? `Stand der Datenschutzerklärung: ${stand}. ` : "Der Stand der Datenschutzerklärung wird beim ersten Speichern festgehalten. "}
          Er wird beim Speichern automatisch erneuert, wenn sich die Erklärung durch Änderungen hier verändert.
        </p>
      </div>

      <Notice variant="info">
        Die Hinweise zu UWG und revDSG sind eine Orientierung und keine Rechtsberatung. Die Warnungen blockieren nichts: Der Verein
        entscheidet selbst, was er anzeigt, und prüft bei Zweifeln mit einer Fachperson.
      </Notice>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-zinc-400">Die Vorschau zeigt den gespeicherten Stand: erst speichern, dann ansehen.</p>
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
          {busy ? "Speichern …" : "Speichern"}
        </Button>
      </div>
    </form>
  );
}
