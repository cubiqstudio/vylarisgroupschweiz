"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, Loader2, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { api, ApiClientError } from "@/lib/api-client";
import {
  INCIDENT_SEVERITIES,
  INCIDENT_SEVERITY_LABEL,
  INCIDENT_STATUSES,
  INCIDENT_STATUS_LABEL,
  label,
} from "@/lib/constants";
import { cn, formatDateTime } from "@/lib/utils";
import { ConfirmDialog } from "./confirm-dialog";
import { Modal } from "./modal";
import { Notice } from "./notice";
import { INCIDENT_SEVERITY_STYLE, INCIDENT_STATUS_STYLE, PILL } from "./styles";
import { useToast } from "./toast";
import type { IncidentDTO, ServiceOption } from "./types";

function sortIncidents(list: IncidentDTO[]): IncidentDTO[] {
  return [...list].sort((a, b) => {
    const aActive = a.status !== "RESOLVED" ? 0 : 1;
    const bActive = b.status !== "RESOLVED" ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;
    return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
  });
}

const pad = (n: number) => String(n).padStart(2, "0");
/** ISO-String -> Wert für <input type="datetime-local"> (Ortszeit des Browsers). */
function toLocalInput(iso: string | Date): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function IncidentManager({
  initial,
  services,
  openNew = false,
}: {
  initial: IncidentDTO[];
  services: ServiceOption[];
  openNew?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [incidents, setIncidents] = useState<IncidentDTO[]>(() => sortIncidents(initial));
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<IncidentDTO | "new" | null>(null);

  // Erst nach der Hydration öffnen: das Formular nutzt die Ortszeit des Browsers (sonst Hydration-Abweichung).
  useEffect(() => {
    if (openNew) setEditing("new");
  }, [openNew]);
  const [toDelete, setToDelete] = useState<IncidentDTO | null>(null);
  const [deleting, setDeleting] = useState(false);

  function setBusy(id: string, busy: boolean) {
    setPending((prev) => {
      const next = new Set(prev);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function changeStatus(incident: IncidentDTO, status: string, successMessage?: string) {
    if (status === incident.status) return;
    const previous = incident;
    setBusy(incident.id, true);
    setIncidents((list) => sortIncidents(list.map((i) => (i.id === incident.id ? { ...i, status } : i))));
    try {
      const saved = await api<IncidentDTO>(`/api/admin/incidents/${incident.id}`, { method: "PATCH", body: { status } });
      setIncidents((list) => sortIncidents(list.map((i) => (i.id === incident.id ? saved : i))));
      toast.success(successMessage ?? `«${incident.title}»: ${label(INCIDENT_STATUS_LABEL, status)}.`);
      router.refresh();
    } catch (err) {
      setIncidents((list) => sortIncidents(list.map((i) => (i.id === incident.id ? previous : i))));
      toast.error(err instanceof ApiClientError ? err.message : "Status konnte nicht geändert werden.");
    } finally {
      setBusy(incident.id, false);
    }
  }

  function onSaved(saved: IncidentDTO, created: boolean) {
    setIncidents((list) => sortIncidents(created ? [saved, ...list] : list.map((i) => (i.id === saved.id ? saved : i))));
    setEditing(null);
    toast.success(created ? "Statusmeldung wurde veröffentlicht." : "Statusmeldung wurde gespeichert.");
    router.refresh();
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api(`/api/admin/incidents/${toDelete.id}`, { method: "DELETE" });
      setIncidents((list) => list.filter((i) => i.id !== toDelete.id));
      toast.success("Statusmeldung wurde gelöscht.");
      setToDelete(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Meldung konnte nicht gelöscht werden.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section aria-labelledby="incidents-heading" className="scroll-mt-6" id="meldungen">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="incidents-heading" className="text-lg font-semibold tracking-tight text-white">
            Statusmeldungen
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-400">
            Störungen und Wartungsarbeiten. Aktive Meldungen stehen oben und werden öffentlich angezeigt, bis du sie als behoben markierst.
          </p>
        </div>
        <Button type="button" onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4" aria-hidden="true" /> Neue Meldung
        </Button>
      </div>

      {incidents.length === 0 ? (
        <Card className="px-6 py-12 text-center">
          <p className="text-base font-medium text-white">Keine Statusmeldungen vorhanden</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-400">
            Bei Störungen oder geplanten Wartungen legst du hier eine Meldung an, damit Besucher informiert sind.
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-zinc-800">
            {incidents.map((i) => {
              const resolved = i.status === "RESOLVED";
              const busy = pending.has(i.id);
              return (
                <li key={i.id} className={cn("px-4 py-4 sm:px-5", resolved && "opacity-75")}>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white">{i.title}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <span className={cn(PILL, INCIDENT_SEVERITY_STYLE[i.severity])}>{label(INCIDENT_SEVERITY_LABEL, i.severity)}</span>
                        <span className={cn(PILL, INCIDENT_STATUS_STYLE[i.status])}>{label(INCIDENT_STATUS_LABEL, i.status)}</span>
                        {i.service && <span className="text-xs text-zinc-500">Betrifft: {i.service.name}</span>}
                      </div>
                      <p className="mt-2 line-clamp-2 whitespace-pre-line text-sm text-zinc-400">{i.body}</p>
                      <p className="mt-2 text-xs text-zinc-500">
                        Beginn {formatDateTime(i.startedAt)}
                        {i.resolvedAt && ` · Behoben ${formatDateTime(i.resolvedAt)}`}
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:max-w-md lg:justify-end">
                      <div className="flex flex-wrap items-center gap-2">
                        <label htmlFor={`inc-status-${i.id}`} className="sr-only">
                          Fortschritt von {i.title}
                        </label>
                        <Select
                          id={`inc-status-${i.id}`}
                          value={i.status}
                          disabled={busy}
                          onChange={(e) => changeStatus(i, e.target.value)}
                          className="h-8! w-auto! min-w-40 py-0"
                        >
                          {INCIDENT_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {INCIDENT_STATUS_LABEL[s]}
                            </option>
                          ))}
                        </Select>
                        {!resolved && (
                          <Button
                            type="button"
                            size="sm"
                            disabled={busy}
                            onClick={() => changeStatus(i, "RESOLVED", `«${i.title}» wurde als behoben markiert.`)}
                          >
                            <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" /> Als behoben markieren
                          </Button>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(i)}>
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Bearbeiten
                          <span className="sr-only">: {i.title}</span>
                        </Button>
                        <Button type="button" variant="danger" size="sm" onClick={() => setToDelete(i)}>
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Löschen
                          <span className="sr-only">: {i.title}</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Neue Statusmeldung" : "Statusmeldung bearbeiten"}
        description="Die Meldung erscheint nach dem Speichern auf der öffentlichen Statusseite."
        size="lg"
      >
        {editing !== null && (
          <IncidentForm
            incident={editing === "new" ? undefined : editing}
            services={services}
            onCancel={() => setEditing(null)}
            onSaved={onSaved}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={toDelete !== null}
        danger
        busy={deleting}
        title="Statusmeldung löschen?"
        description={toDelete ? `«${toDelete.title}» wird dauerhaft entfernt, auch aus dem öffentlichen Verlauf.` : ""}
        confirmLabel="Endgültig löschen"
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </section>
  );
}

function IncidentForm({
  incident,
  services,
  onCancel,
  onSaved,
}: {
  incident?: IncidentDTO;
  services: ServiceOption[];
  onCancel: () => void;
  onSaved: (saved: IncidentDTO, created: boolean) => void;
}) {
  const [title, setTitle] = useState(incident?.title ?? "");
  const [body, setBody] = useState(incident?.body ?? "");
  const [severity, setSeverity] = useState(incident?.severity ?? "MINOR");
  const [status, setStatus] = useState(incident?.status ?? "INVESTIGATING");
  const [serviceId, setServiceId] = useState(incident?.serviceId ?? "");
  const [startedAt, setStartedAt] = useState(() => toLocalInput(incident?.startedAt ?? new Date()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setError(null);

    const started = startedAt ? new Date(startedAt) : null;
    if (!started || Number.isNaN(started.getTime())) {
      setFields({ startedAt: "Bitte Datum und Uhrzeit angeben." });
      setError("Bitte prüfe die markierten Felder.");
      return;
    }
    setFields({});

    const payload = { title, body, severity, status, serviceId: serviceId || null, startedAt: started.toISOString() };
    setBusy(true);
    try {
      const saved = incident
        ? await api<IncidentDTO>(`/api/admin/incidents/${incident.id}`, { method: "PATCH", body: payload })
        : await api<IncidentDTO>("/api/admin/incidents", { method: "POST", body: payload });
      onSaved(saved, !incident);
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
      <Field label="Titel" htmlFor="i-title" error={fields.title}>
        <Input id="i-title" value={title} required maxLength={160} autoFocus aria-invalid={invalid("title")} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label="Beschreibung" htmlFor="i-body" error={fields.body} hint="Was ist passiert, was ist betroffen, was wird getan? Wird öffentlich angezeigt.">
        <Textarea id="i-body" rows={5} value={body} required maxLength={5000} aria-invalid={invalid("body")} onChange={(e) => setBody(e.target.value)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Schweregrad" htmlFor="i-severity" error={fields.severity}>
          <Select id="i-severity" value={severity} onChange={(e) => setSeverity(e.target.value)}>
            {INCIDENT_SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {INCIDENT_SEVERITY_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Fortschritt" htmlFor="i-status" error={fields.status}>
          <Select id="i-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            {INCIDENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {INCIDENT_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Betroffener Service" htmlFor="i-service" error={fields.serviceId} hint="Optional.">
          <Select id="i-service" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
            <option value="">Kein bestimmter Service</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Beginn" htmlFor="i-started" error={fields.startedAt} hint="In der Ortszeit deines Browsers.">
          <Input
            id="i-started"
            type="datetime-local"
            value={startedAt}
            required
            aria-invalid={invalid("startedAt")}
            onChange={(e) => setStartedAt(e.target.value)}
          />
        </Field>
      </div>
      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          Abbrechen
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
          {busy ? "Speichern …" : incident ? "Speichern" : "Meldung veröffentlichen"}
        </Button>
      </div>
    </form>
  );
}
