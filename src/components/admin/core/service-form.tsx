"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { api, ApiClientError } from "@/lib/api-client";
import { SERVICE_CATEGORIES, STATUSES, STATUS_LABEL } from "@/lib/constants";
import { slugify } from "@/lib/utils";
import { ConfirmDialog } from "./confirm-dialog";
import { EnglishSection } from "./english-section";
import { Notice } from "./notice";
import { useToast } from "./toast";
import type { ServiceDTO } from "./types";

type FormState = {
  name: string;
  slug: string;
  tagline: string;
  description: string;
  category: string;
  url: string;
  repoUrl: string;
  status: string;
  uptime: string;
  featured: boolean;
  comingSoon: boolean;
  sortOrder: string;
  nameEn: string;
  taglineEn: string;
  descriptionEn: string;
};

function initialState(s?: ServiceDTO): FormState {
  return {
    name: s?.name ?? "",
    slug: s?.slug ?? "",
    tagline: s?.tagline ?? "",
    description: s?.description ?? "",
    category: s?.category ?? "",
    url: s?.url ?? "",
    repoUrl: s?.repoUrl ?? "",
    status: s?.status ?? "OPERATIONAL",
    uptime: s ? String(s.uptime).replace(".", ",") : "100",
    featured: s?.featured ?? false,
    comingSoon: s?.comingSoon ?? false,
    sortOrder: String(s?.sortOrder ?? 0),
    nameEn: s?.nameEn ?? "",
    taglineEn: s?.taglineEn ?? "",
    descriptionEn: s?.descriptionEn ?? "",
  };
}

export function ServiceForm({ service }: { service?: ServiceDTO }) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState<FormState>(() => initialState(service));
  const [slugTouched, setSlugTouched] = useState(Boolean(service));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setError(null);

    const local: Record<string, string> = {};
    const uptime = Number(form.uptime.trim().replace(",", "."));
    if (form.uptime.trim() === "" || Number.isNaN(uptime)) local.uptime = "Bitte eine Zahl zwischen 0 und 100 angeben.";
    const sortOrder = Number(form.sortOrder.trim());
    if (form.sortOrder.trim() === "" || !Number.isInteger(sortOrder)) local.sortOrder = "Bitte eine ganze Zahl angeben.";
    if (Object.keys(local).length > 0) {
      setFields(local);
      setError("Bitte prüfe die markierten Felder.");
      return;
    }
    setFields({});

    const body = {
      name: form.name,
      slug: form.slug,
      tagline: form.tagline,
      description: form.description,
      category: form.category,
      url: form.url,
      repoUrl: form.repoUrl,
      status: form.status,
      uptime,
      featured: form.featured,
      comingSoon: form.comingSoon,
      sortOrder,
      // Leere Eingabe wird serverseitig als "keine englische Fassung" (null) gespeichert.
      nameEn: form.nameEn,
      taglineEn: form.taglineEn,
      descriptionEn: form.descriptionEn,
    };

    setBusy(true);
    try {
      if (service) {
        await api(`/api/admin/services/${service.id}`, { method: "PATCH", body });
        toast.success(`„${form.name}“ wurde gespeichert.`);
      } else {
        await api("/api/admin/services", { method: "POST", body });
        toast.success(`„${form.name}“ wurde angelegt.`);
      }
      router.push("/admin/services");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.fields ? "Bitte prüfe die markierten Felder." : err.message);
        setFields(err.fields ?? {});
      } else {
        setError("Speichern fehlgeschlagen. Bitte versuche es erneut.");
      }
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!service) return;
    setDeleting(true);
    try {
      await api(`/api/admin/services/${service.id}`, { method: "DELETE" });
      toast.success(`„${service.name}“ wurde gelöscht.`);
      router.push("/admin/services");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Service konnte nicht gelöscht werden.");
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  const invalid = (k: string) => (fields[k] ? true : undefined);
  const englishFilled = Boolean(service?.nameEn || service?.taglineEn || service?.descriptionEn);
  const englishError = Boolean(fields.nameEn || fields.taglineEn || fields.descriptionEn);

  return (
    <>
      <form onSubmit={onSubmit} noValidate className="space-y-6">
        {error && <Notice variant="error">{error}</Notice>}

        <Card className="space-y-5 p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-white">Allgemein</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Name" htmlFor="name" error={fields.name}>
              <Input
                id="name"
                value={form.name}
                required
                maxLength={80}
                aria-invalid={invalid("name")}
                onChange={(e) => {
                  const name = e.target.value;
                  setForm((f) => ({ ...f, name, slug: slugTouched ? f.slug : slugify(name) }));
                }}
              />
            </Field>
            <Field
              label="Slug"
              htmlFor="slug"
              error={fields.slug}
              hint={slugTouched ? "Eindeutiger Bezeichner in URLs." : "Wird automatisch aus dem Namen erzeugt."}
            >
              <Input
                id="slug"
                value={form.slug}
                required
                maxLength={80}
                spellCheck={false}
                autoCapitalize="none"
                className="font-mono"
                aria-invalid={invalid("slug")}
                onChange={(e) => {
                  setSlugTouched(true);
                  set("slug", e.target.value);
                }}
              />
            </Field>
          </div>

          <Field label="Kurzbeschreibung" htmlFor="tagline" error={fields.tagline} hint="Ein Satz, der unter dem Namen angezeigt wird (optional, max. 140 Zeichen).">
            <Input id="tagline" value={form.tagline} maxLength={140} aria-invalid={invalid("tagline")} onChange={(e) => set("tagline", e.target.value)} />
          </Field>

          <Field label="Beschreibung" htmlFor="description" error={fields.description} hint="Mindestens 10, höchstens 2000 Zeichen.">
            <Textarea
              id="description"
              rows={5}
              value={form.description}
              required
              maxLength={2000}
              aria-invalid={invalid("description")}
              onChange={(e) => set("description", e.target.value)}
            />
          </Field>

          <Field label="Kategorie" htmlFor="category" error={fields.category} hint="Aus der Liste wählen oder eine neue Kategorie eintippen.">
            <Input
              id="category"
              list="service-categories"
              value={form.category}
              required
              maxLength={60}
              autoComplete="off"
              aria-invalid={invalid("category")}
              onChange={(e) => set("category", e.target.value)}
            />
            <datalist id="service-categories">
              {SERVICE_CATEGORIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
        </Card>

        <EnglishSection
          filled={englishFilled}
          hasError={englishError}
          hint="Wird auf vylaris.net angezeigt. Felder, die du leer lässt, erscheinen dort in der deutschen Fassung."
        >
          <Field label="Name (Englisch)" htmlFor="nameEn" error={fields.nameEn}>
            <Input id="nameEn" value={form.nameEn} maxLength={80} lang="en" aria-invalid={invalid("nameEn")} onChange={(e) => set("nameEn", e.target.value)} />
          </Field>
          <Field label="Kurzbeschreibung (Englisch)" htmlFor="taglineEn" error={fields.taglineEn} hint="Optional, max. 140 Zeichen.">
            <Input id="taglineEn" value={form.taglineEn} maxLength={140} lang="en" aria-invalid={invalid("taglineEn")} onChange={(e) => set("taglineEn", e.target.value)} />
          </Field>
          <Field label="Beschreibung (Englisch)" htmlFor="descriptionEn" error={fields.descriptionEn} hint="Mindestens 10, höchstens 2000 Zeichen.">
            <Textarea
              id="descriptionEn"
              rows={5}
              value={form.descriptionEn}
              maxLength={2000}
              lang="en"
              aria-invalid={invalid("descriptionEn")}
              onChange={(e) => set("descriptionEn", e.target.value)}
            />
          </Field>
        </EnglishSection>

        <Card className="space-y-5 p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-white">Links</h2>
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={form.comingSoon}
              onChange={(e) => set("comingSoon", e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-zinc-700 bg-zinc-950 accent-emerald-400"
            />
            <span>
              <span className="font-medium text-zinc-200">Bald verfügbar (Coming Soon)</span>
              <span className="block text-xs text-zinc-500">
                Der Dienst wird als angekündigt angezeigt, ohne Links. Die Service-URL ist dann nicht nötig, und der Dienst erscheint nicht auf der Statusseite.
              </span>
            </span>
          </label>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Service-URL" htmlFor="url" error={fields.url} hint={form.comingSoon ? "Optional, solange der Dienst „Bald verfügbar“ ist." : undefined}>
              <Input
                id="url"
                type="url"
                inputMode="url"
                value={form.url}
                required={!form.comingSoon}
                placeholder="https://"
                aria-invalid={invalid("url")}
                onChange={(e) => set("url", e.target.value)}
              />
            </Field>
            <Field label="Quellcode-URL" htmlFor="repoUrl" error={fields.repoUrl} hint="Optional – Link zum Open-Source-Repository.">
              <Input
                id="repoUrl"
                type="url"
                inputMode="url"
                value={form.repoUrl}
                placeholder="https://"
                aria-invalid={invalid("repoUrl")}
                onChange={(e) => set("repoUrl", e.target.value)}
              />
            </Field>
          </div>
        </Card>

        <Card className="space-y-5 p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-white">Betrieb & Darstellung</h2>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Status" htmlFor="status" error={fields.status}>
              <Select id="status" value={form.status} onChange={(e) => set("status", e.target.value)}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Uptime (%)" htmlFor="uptime" error={fields.uptime} hint="Manuell gepflegt, 0–100.">
              <Input
                id="uptime"
                inputMode="decimal"
                value={form.uptime}
                required
                aria-invalid={invalid("uptime")}
                onChange={(e) => set("uptime", e.target.value)}
              />
            </Field>
            <Field label="Sortierung" htmlFor="sortOrder" error={fields.sortOrder} hint="Kleinere Zahlen stehen weiter oben.">
              <Input
                id="sortOrder"
                type="number"
                min={0}
                max={9999}
                step={1}
                value={form.sortOrder}
                required
                aria-invalid={invalid("sortOrder")}
                onChange={(e) => set("sortOrder", e.target.value)}
              />
            </Field>
          </div>
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={form.featured}
              onChange={(e) => set("featured", e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-zinc-700 bg-zinc-950 accent-emerald-400"
            />
            <span>
              <span className="font-medium text-zinc-200">Auf der Startseite hervorheben</span>
              <span className="block text-xs text-zinc-500">Hervorgehobene Services erscheinen prominent auf der öffentlichen Website.</span>
            </span>
          </label>
        </Card>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {service && (
              <Button type="button" variant="danger" onClick={() => setConfirmDelete(true)} disabled={busy}>
                <Trash2 className="h-4 w-4" aria-hidden="true" /> Service löschen
              </Button>
            )}
          </div>
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <Link
              href="/admin/services"
              className="inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-medium text-zinc-300 hover:bg-zinc-900 hover:text-white"
            >
              Abbrechen
            </Link>
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
              {busy ? "Speichern …" : service ? "Änderungen speichern" : "Service anlegen"}
            </Button>
          </div>
        </div>
      </form>

      {service && (
        <ConfirmDialog
          open={confirmDelete}
          danger
          busy={deleting}
          title="Service löschen?"
          description={`„${service.name}“ wird dauerhaft entfernt und verschwindet von der öffentlichen Website. Das lässt sich nicht rückgängig machen.`}
          confirmLabel="Endgültig löschen"
          onConfirm={onDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </>
  );
}
