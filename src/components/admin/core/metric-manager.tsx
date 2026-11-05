"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Select } from "@/components/ui/form";
import { api, ApiClientError } from "@/lib/api-client";
import { METRIC_KINDS, METRIC_KIND_LABEL, STATUSES, STATUS_LABEL, label, type ComponentStatus } from "@/lib/constants";
import { formatDateTime, formatUptime, slugify } from "@/lib/utils";
import { ConfirmDialog } from "./confirm-dialog";
import { Modal } from "./modal";
import { Notice } from "./notice";
import { StatusToggle } from "./status-toggle";
import { useToast } from "./toast";
import type { MetricDTO } from "./types";

function sortMetrics(list: MetricDTO[]): MetricDTO[] {
  return [...list].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "de"));
}

export function MetricManager({ initial }: { initial: MetricDTO[] }) {
  const router = useRouter();
  const toast = useToast();
  const [metrics, setMetrics] = useState<MetricDTO[]>(() => sortMetrics(initial));
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<MetricDTO | "new" | null>(null);
  const [toDelete, setToDelete] = useState<MetricDTO | null>(null);
  const [deleting, setDeleting] = useState(false);

  function setBusy(id: string, busy: boolean) {
    setPending((prev) => {
      const next = new Set(prev);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function changeStatus(metric: MetricDTO, status: ComponentStatus) {
    const previous = metric.status;
    setBusy(metric.id, true);
    setMetrics((list) => list.map((m) => (m.id === metric.id ? { ...m, status } : m)));
    try {
      const saved = await api<MetricDTO>(`/api/admin/metrics/${metric.id}`, { method: "PATCH", body: { status } });
      setMetrics((list) => list.map((m) => (m.id === metric.id ? { ...m, updatedAt: saved?.updatedAt ?? m.updatedAt } : m)));
      toast.success(`${metric.name}: Status auf „${STATUS_LABEL[status]}“ gesetzt.`);
      router.refresh();
    } catch (err) {
      setMetrics((list) => list.map((m) => (m.id === metric.id ? { ...m, status: previous } : m)));
      toast.error(err instanceof ApiClientError ? err.message : "Status konnte nicht geändert werden.");
    } finally {
      setBusy(metric.id, false);
    }
  }

  function onSaved(saved: MetricDTO, created: boolean) {
    setMetrics((list) => sortMetrics(created ? [...list, saved] : list.map((m) => (m.id === saved.id ? saved : m))));
    setEditing(null);
    toast.success(created ? `„${saved.name}“ wurde angelegt.` : `„${saved.name}“ wurde gespeichert.`);
    router.refresh();
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api(`/api/admin/metrics/${toDelete.id}`, { method: "DELETE" });
      setMetrics((list) => list.filter((m) => m.id !== toDelete.id));
      toast.success(`„${toDelete.name}“ wurde gelöscht.`);
      setToDelete(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Komponente konnte nicht gelöscht werden.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section aria-labelledby="metrics-heading" className="scroll-mt-6" id="komponenten">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="metrics-heading" className="text-lg font-semibold tracking-tight text-white">
            Infrastruktur-Komponenten
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-400">
            Server, Netzwerk, Datenbanken und Speicher, wie sie auf der öffentlichen Statusseite erscheinen. Werte pflegst du manuell.
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4" aria-hidden="true" /> Komponente hinzufügen
        </Button>
      </div>

      {metrics.length === 0 ? (
        <Card className="px-6 py-12 text-center">
          <p className="text-base font-medium text-white">Noch keine Komponenten angelegt</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-400">
            Lege Komponenten wie „Hosting-Cluster“ oder „Datenbank“ an, damit Besucher ihren Betriebszustand auf der Statusseite sehen.
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-zinc-800">
            {metrics.map((m) => (
              <li key={m.id} className="flex flex-col gap-4 px-4 py-4 sm:px-5 xl:flex-row xl:items-center xl:gap-6">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-white">{m.name}</p>
                    <Badge>{label(METRIC_KIND_LABEL, m.kind)}</Badge>
                  </div>
                  <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
                    {m.location && <span>{m.location}</span>}
                    <span>Uptime {formatUptime(m.uptime)}</span>
                    <span>{m.responseMs !== null ? `Antwortzeit ${m.responseMs} ms` : "Keine Antwortzeit"}</span>
                    <span>Aktualisiert {formatDateTime(m.updatedAt)}</span>
                  </p>
                </div>
                <StatusToggle
                  label={`Status von ${m.name}`}
                  value={m.status}
                  disabled={pending.has(m.id)}
                  onChange={(next) => changeStatus(m, next)}
                  className="self-start"
                />
                <div className="flex shrink-0 items-center gap-2">
                  <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(m)}>
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Bearbeiten
                    <span className="sr-only">: {m.name}</span>
                  </Button>
                  <Button type="button" variant="danger" size="sm" onClick={() => setToDelete(m)}>
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Löschen
                    <span className="sr-only">: {m.name}</span>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Komponente hinzufügen" : "Komponente bearbeiten"}
        description="Die Angaben erscheinen nach dem Speichern auf der öffentlichen Statusseite."
      >
        {editing !== null && (
          <MetricForm metric={editing === "new" ? undefined : editing} onCancel={() => setEditing(null)} onSaved={onSaved} />
        )}
      </Modal>

      <ConfirmDialog
        open={toDelete !== null}
        danger
        busy={deleting}
        title="Komponente löschen?"
        description={toDelete ? `„${toDelete.name}“ wird dauerhaft von der Statusseite entfernt.` : ""}
        confirmLabel="Endgültig löschen"
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </section>
  );
}

function MetricForm({
  metric,
  onCancel,
  onSaved,
}: {
  metric?: MetricDTO;
  onCancel: () => void;
  onSaved: (saved: MetricDTO, created: boolean) => void;
}) {
  const [name, setName] = useState(metric?.name ?? "");
  const [slug, setSlug] = useState(metric?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(metric));
  const [kind, setKind] = useState(metric?.kind ?? "SERVER");
  const [location, setLocation] = useState(metric?.location ?? "");
  const [status, setStatus] = useState(metric?.status ?? "OPERATIONAL");
  const [uptime, setUptime] = useState(metric ? String(metric.uptime).replace(".", ",") : "100");
  const [responseMs, setResponseMs] = useState(metric?.responseMs != null ? String(metric.responseMs) : "");
  const [sortOrder, setSortOrder] = useState(String(metric?.sortOrder ?? 0));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setError(null);

    const local: Record<string, string> = {};
    const uptimeNum = Number(uptime.trim().replace(",", "."));
    if (uptime.trim() === "" || Number.isNaN(uptimeNum)) local.uptime = "Bitte eine Zahl zwischen 0 und 100 angeben.";
    const respTrim = responseMs.trim();
    const respNum = respTrim === "" ? null : Number(respTrim);
    if (respNum !== null && (!Number.isInteger(respNum) || respNum < 0)) local.responseMs = "Bitte eine ganze Zahl ab 0 angeben.";
    const sortNum = Number(sortOrder.trim());
    if (sortOrder.trim() === "" || !Number.isInteger(sortNum)) local.sortOrder = "Bitte eine ganze Zahl angeben.";
    if (Object.keys(local).length > 0) {
      setFields(local);
      setError("Bitte prüfe die markierten Felder.");
      return;
    }
    setFields({});

    const body = { name, slug, kind, location, status, uptime: uptimeNum, responseMs: respNum, sortOrder: sortNum };
    setBusy(true);
    try {
      const saved = metric
        ? await api<MetricDTO>(`/api/admin/metrics/${metric.id}`, { method: "PATCH", body })
        : await api<MetricDTO>("/api/admin/metrics", { method: "POST", body });
      onSaved(saved, !metric);
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

  const invalid = (k: string) => (fields[k] ? true : undefined);

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {error && <Notice variant="error">{error}</Notice>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="m-name" error={fields.name}>
          <Input
            id="m-name"
            value={name}
            required
            maxLength={80}
            autoFocus
            aria-invalid={invalid("name")}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
          />
        </Field>
        <Field label="Slug" htmlFor="m-slug" error={fields.slug}>
          <Input
            id="m-slug"
            value={slug}
            required
            maxLength={80}
            spellCheck={false}
            autoCapitalize="none"
            className="font-mono"
            aria-invalid={invalid("slug")}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
          />
        </Field>
        <Field label="Art" htmlFor="m-kind" error={fields.kind}>
          <Select id="m-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
            {METRIC_KINDS.map((k) => (
              <option key={k} value={k}>
                {METRIC_KIND_LABEL[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Standort / Bereich" htmlFor="m-location" error={fields.location} hint="Optional, z. B. eine Region oder Bezeichnung.">
          <Input id="m-location" value={location} maxLength={80} aria-invalid={invalid("location")} onChange={(e) => setLocation(e.target.value)} />
        </Field>
        <Field label="Status" htmlFor="m-status" error={fields.status}>
          <Select id="m-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Uptime (%)" htmlFor="m-uptime" error={fields.uptime}>
          <Input id="m-uptime" inputMode="decimal" value={uptime} required aria-invalid={invalid("uptime")} onChange={(e) => setUptime(e.target.value)} />
        </Field>
        <Field label="Antwortzeit (ms)" htmlFor="m-resp" error={fields.responseMs} hint="Optional.">
          <Input
            id="m-resp"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={responseMs}
            aria-invalid={invalid("responseMs")}
            onChange={(e) => setResponseMs(e.target.value)}
          />
        </Field>
        <Field label="Sortierung" htmlFor="m-sort" error={fields.sortOrder}>
          <Input id="m-sort" type="number" min={0} max={9999} step={1} value={sortOrder} required aria-invalid={invalid("sortOrder")} onChange={(e) => setSortOrder(e.target.value)} />
        </Field>
      </div>
      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          Abbrechen
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
          {busy ? "Speichern …" : "Speichern"}
        </Button>
      </div>
    </form>
  );
}
