"use client";

import { useDeferredValue, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, Loader2, Pencil, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Markdown } from "@/components/ui/markdown";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Notice } from "@/components/admin/core/notice";
import { useToast } from "@/components/admin/core/toast";
import { describeError } from "@/components/admin/settings/form-utils";
import { flagsOf, type EventFormValues } from "./event-values";

const VISIBILITY: Array<{ value: EventFormValues["visibility"]; label: string; hint: string }> = [
  { value: "members", label: "Nur für Mitglieder", hint: "Erscheint im Mitgliederportal, nicht auf der öffentlichen Website." },
  { value: "public_members", label: "Öffentlich sichtbar, Anmeldung nur für Mitglieder", hint: "Besucher sehen den Anlass, angemeldet werden können aber nur Mitglieder." },
  { value: "public_guests", label: "Öffentlich, auch Gäste dürfen sich anmelden", hint: "Gäste melden sich mit Name und E-Mail-Adresse an und erhalten eine Bestätigung mit Abmelde-Link." },
];

/**
 * Formular für einen Anlass. `create` legt neu an (Entwurf oder gleich veröffentlicht), `edit` ändert.
 * `notifiable`: bei der Änderung können die Angemeldeten über neue Zeit oder neuen Ort informiert werden.
 */
export function EventForm({ mode, eventId, initial, notifiable = false, readOnly = false }: { mode: "create" | "edit"; eventId?: string; initial: EventFormValues; notifiable?: boolean; readOnly?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [v, setV] = useState<EventFormValues>(initial);
  const [publish, setPublish] = useState(false);
  const [notify, setNotify] = useState(false);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const preview = useDeferredValue(v.description);

  const set = <K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) => {
    setV((s) => ({ ...s, [key]: value }));
    setErrors((e) => (e[key] || e.isPublic || e.membersOnly ? { ...e, [key]: "", isPublic: "", membersOnly: "" } : e));
  };
  const bind = (key: keyof Omit<EventFormValues, "visibility">) => ({
    id: `ev-${key}`,
    name: key,
    value: v[key],
    onChange: (e: { target: { value: string } }) => set(key, e.target.value),
    "aria-invalid": errors[key] ? (true as const) : undefined,
    disabled: busy || readOnly,
  });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || readOnly) return;
    setBusy(true);
    setFormError(null);
    setErrors({});
    const body: Record<string, unknown> = {
      title: v.title,
      description: v.description,
      location: v.location,
      startsAt: v.startsAt,
      endsAt: v.endsAt,
      capacity: v.capacity,
      registrationDeadline: v.registrationDeadline,
      ...flagsOf(v.visibility),
    };
    try {
      if (mode === "create") {
        const res = await api<{ id: string }>("/api/admin/events", { method: "POST", body: { ...body, status: publish ? "VEROEFFENTLICHT" : "ENTWURF" } });
        toast.success(publish ? "Der Anlass wurde angelegt und veröffentlicht." : "Der Anlass wurde als Entwurf gespeichert.");
        router.push(`/admin/events/${res.id}`);
      } else {
        const res = await api<{ warning: string | null; mail: { mailed: number; failed: number; noEmail: number } | null }>(`/api/admin/events/${encodeURIComponent(eventId ?? "")}`, {
          method: "PATCH",
          body: { ...body, notify: notifiable && notify },
        });
        toast.success("Änderungen gespeichert.");
        if (res.mail) toast.success(`${res.mail.mailed} ${res.mail.mailed === 1 ? "Mail" : "Mails"} über die Änderung versendet${res.mail.failed ? `, ${res.mail.failed} fehlgeschlagen` : ""}${res.mail.noEmail ? `, ${res.mail.noEmail} ohne E-Mail-Adresse` : ""}.`);
        if (res.warning) toast.error(res.warning);
        setNotify(false);
        router.refresh();
      }
    } catch (err) {
      const d = describeError(err, "Speichern fehlgeschlagen.");
      setErrors(d.fields);
      setFormError(d.message);
      toast.error(d.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={busy} className="space-y-6">
      {formError && <Notice variant="error">{formError}</Notice>}

      <Card className="p-5">
        <h2 className="text-base font-semibold text-white">Anlass</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Titel" htmlFor="ev-title" error={errors.title} className="sm:col-span-2">
            <Input {...bind("title")} required maxLength={120} autoComplete="off" />
          </Field>
          <Field label="Beginn" htmlFor="ev-startsAt" error={errors.startsAt} hint="Zürcher Zeit.">
            <Input {...bind("startsAt")} type="datetime-local" required />
          </Field>
          <Field label="Ende (optional)" htmlFor="ev-endsAt" error={errors.endsAt}>
            <Input {...bind("endsAt")} type="datetime-local" />
          </Field>
          <Field label="Ort (optional)" htmlFor="ev-location" error={errors.location} className="sm:col-span-2">
            <Input {...bind("location")} maxLength={200} autoComplete="off" />
          </Field>
          <div className="sm:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="ev-description" className="block text-sm font-medium text-zinc-300">
                Beschreibung <span className="font-normal text-zinc-500">(Markdown)</span>
              </label>
              <div role="group" aria-label="Ansicht" className="flex gap-1">
                {(
                  [
                    ["write", "Schreiben", Pencil],
                    ["preview", "Vorschau", Eye],
                  ] as const
                ).map(([key, label, Icon]) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={tab === key}
                    onClick={() => setTab(key)}
                    className={cn("inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium ring-1 ring-inset", tab === key ? "bg-zinc-900 text-white ring-zinc-700" : "text-zinc-400 ring-zinc-800 hover:text-zinc-100")}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-1.5">
              {tab === "write" ? (
                <Textarea {...bind("description")} rows={8} maxLength={20000} placeholder={"Worum geht es, was soll man mitbringen, wie kommt man hin?"} />
              ) : (
                <div className="min-h-40 rounded-lg border border-zinc-700 p-4" aria-live="polite">
                  {preview.trim() ? <Markdown>{preview}</Markdown> : <p className="text-sm text-zinc-500">Sobald du Text schreibst, erscheint hier die Vorschau.</p>}
                </div>
              )}
            </div>
            {errors.description && (
              <p role="alert" className="mt-1.5 text-xs text-rose-400">
                {errors.description}
              </p>
            )}
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-base font-semibold text-white">Anmeldung</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Anzahl Plätze (optional)" htmlFor="ev-capacity" error={errors.capacity} hint="Personen inklusive Begleitung. Leer = unbegrenzt. Ist der Anlass voll, kommen weitere Anmeldungen auf die Warteliste.">
            <Input {...bind("capacity")} type="number" min={1} max={10000} inputMode="numeric" />
          </Field>
          <Field label="Anmeldeschluss (optional)" htmlFor="ev-registrationDeadline" error={errors.registrationDeadline} hint="Leer = bis zum Beginn.">
            <Input {...bind("registrationDeadline")} type="datetime-local" />
          </Field>
        </div>
        <fieldset className="mt-5" disabled={busy || readOnly}>
          <legend className="text-sm font-medium text-zinc-300">Sichtbarkeit und Zugang</legend>
          <div className="mt-2 space-y-2">
            {VISIBILITY.map((o) => (
              <label key={o.value} className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm", v.visibility === o.value ? "border-emerald-500/40 bg-emerald-500/5" : "border-zinc-800 hover:border-zinc-700")}>
                <input type="radio" name="visibility" value={o.value} checked={v.visibility === o.value} onChange={() => set("visibility", o.value)} className="mt-0.5 size-4 shrink-0 accent-emerald-400" />
                <span>
                  <span className="block font-medium text-zinc-100">{o.label}</span>
                  <span className="block text-xs text-zinc-500">{o.hint}</span>
                </span>
              </label>
            ))}
          </div>
          {(errors.membersOnly || errors.isPublic) && (
            <p role="alert" className="mt-1.5 text-xs text-rose-400">
              {errors.membersOnly || errors.isPublic}
            </p>
          )}
        </fieldset>
      </Card>

      {!readOnly && (
        <div className="space-y-4">
          {mode === "create" && (
            <label className="flex items-start gap-3 text-sm text-zinc-300">
              <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} disabled={busy} className="mt-0.5 size-4 shrink-0 accent-emerald-400" />
              <span>
                Gleich veröffentlichen
                <span className="block text-xs text-zinc-500">Ohne Häkchen bleibt der Anlass ein Entwurf, den nur der Vorstand sieht.</span>
              </span>
            </label>
          )}
          {mode === "edit" && notifiable && (
            <label className="flex items-start gap-3 text-sm text-zinc-300">
              <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} disabled={busy} className="mt-0.5 size-4 shrink-0 accent-emerald-400" />
              <span>
                Angemeldete über die Änderung informieren
                <span className="block text-xs text-zinc-500">Sendet eine Mail, wenn sich Titel, Zeit oder Ort geändert haben.</span>
              </span>
            </label>
          )}
          <Button type="submit" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
            {busy ? "Speichere …" : mode === "create" ? "Anlass anlegen" : "Änderungen speichern"}
          </Button>
        </div>
      )}
    </form>
  );
}
