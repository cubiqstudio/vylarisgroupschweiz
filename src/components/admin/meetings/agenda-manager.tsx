"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ListOrdered, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Markdown } from "@/components/ui/markdown";
import { api } from "@/lib/api-client";
import { ConfirmDialog } from "@/components/admin/core/confirm-dialog";
import { Modal } from "@/components/admin/core/modal";
import { Notice } from "@/components/admin/core/notice";
import { useToast } from "@/components/admin/core/toast";
import { describeError } from "@/components/admin/settings/form-utils";
import { EmptyState } from "@/components/admin/licenses/empty-state";

export type AgendaRow = { id: string; title: string; description: string; motion: string; resolutionCount: number };

type Form = { id: string | null; title: string; description: string; motion: string };
const BLANK: Form = { id: null, title: "", description: "", motion: "" };

/** Traktandenliste: hinzufügen, ändern, löschen, mit Auf/Ab-Knöpfen umordnen. */
export function AgendaManager({ meetingId, items, canWrite, locked }: { meetingId: string; items: AgendaRow[]; canWrite: boolean; locked: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const editable = canWrite && !locked;
  const base = `/api/admin/meetings/${encodeURIComponent(meetingId)}/agenda`;
  const [form, setForm] = useState<Form | null>(null);
  const [remove, setRemove] = useState<AgendaRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [moving, setMoving] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function openForm(f: Form) {
    setErrors({});
    setFormError(null);
    setForm(f);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form || busy) return;
    setBusy(true);
    setErrors({});
    setFormError(null);
    const body = { title: form.title.trim(), description: form.description, motion: form.motion };
    try {
      if (form.id) await api(`${base}/${encodeURIComponent(form.id)}`, { method: "PATCH", body });
      else await api(base, { method: "POST", body });
      toast.success(form.id ? "Traktandum gespeichert." : "Traktandum hinzugefügt.");
      setForm(null);
      router.refresh();
    } catch (err) {
      const d = describeError(err, "Das Traktandum konnte nicht gespeichert werden.");
      setErrors(d.fields);
      setFormError(d.message);
    } finally {
      setBusy(false);
    }
  }

  async function move(id: string, direction: "up" | "down") {
    if (moving) return;
    setMoving(id);
    try {
      await api(`${base}/${encodeURIComponent(id)}`, { method: "PATCH", body: { direction } });
      router.refresh();
    } catch (err) {
      toast.error(describeError(err, "Das Traktandum konnte nicht verschoben werden.").message);
    } finally {
      setMoving(null);
    }
  }

  async function doRemove() {
    if (!remove || busy) return;
    setBusy(true);
    try {
      await api(`${base}/${encodeURIComponent(remove.id)}`, { method: "DELETE" });
      toast.success("Traktandum gelöscht.");
      setRemove(null);
      router.refresh();
    } catch (err) {
      toast.error(describeError(err, "Das Traktandum konnte nicht gelöscht werden.").message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="agenda-h" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="agenda-h" className="text-lg font-semibold text-white">
          Traktanden
        </h2>
        {editable && (
          <Button type="button" onClick={() => openForm(BLANK)}>
            <Plus className="h-4 w-4" aria-hidden />
            Traktandum hinzufügen
          </Button>
        )}
      </div>
      {locked && <Notice variant="info">Das Protokoll ist genehmigt und gesperrt. Die Traktanden lassen sich nicht mehr ändern.</Notice>}

      {items.length === 0 ? (
        <EmptyState icon={ListOrdered} title="Noch keine Traktanden" text="Erfasse die Punkte der Tagesordnung. Sie erscheinen in der Einladung und im Protokoll-Entwurf." />
      ) : (
        <ol className="space-y-3">
          {items.map((it, i) => (
            <li key={it.id}>
              <Card className="p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-sm font-semibold tabular-nums text-zinc-200" aria-hidden>
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-white">
                      <span className="sr-only">Traktandum {i + 1}: </span>
                      {it.title}
                    </h3>
                    {it.description.trim() && <Markdown size="sm" className="mt-2">{it.description}</Markdown>}
                    {it.motion.trim() && (
                      <p className="mt-2 text-sm text-zinc-300">
                        <span className="font-medium text-zinc-200">Antrag:</span> {it.motion}
                      </p>
                    )}
                    {it.resolutionCount > 0 && (
                      <p className="mt-2 text-xs text-zinc-500">
                        {it.resolutionCount} {it.resolutionCount === 1 ? "Beschluss" : "Beschlüsse"} erfasst
                      </p>
                    )}
                  </div>
                  {editable && (
                    <div className="flex shrink-0 items-center gap-1" role="group" aria-label={`Aktionen für Traktandum ${i + 1}`}>
                      <Button type="button" variant="ghost" size="sm" className="px-2" disabled={i === 0 || moving !== null} onClick={() => move(it.id, "up")} aria-label={`Traktandum ${i + 1} nach oben`}>
                        <ArrowUp className="h-4 w-4" aria-hidden />
                      </Button>
                      <Button type="button" variant="ghost" size="sm" className="px-2" disabled={i === items.length - 1 || moving !== null} onClick={() => move(it.id, "down")} aria-label={`Traktandum ${i + 1} nach unten`}>
                        <ArrowDown className="h-4 w-4" aria-hidden />
                      </Button>
                      <Button type="button" variant="ghost" size="sm" className="px-2" onClick={() => openForm({ id: it.id, title: it.title, description: it.description, motion: it.motion })} aria-label={`Traktandum ${i + 1} bearbeiten`}>
                        <Pencil className="h-4 w-4" aria-hidden />
                      </Button>
                      <Button type="button" variant="ghost" size="sm" className="px-2 text-rose-300 hover:text-rose-200" onClick={() => setRemove(it)} aria-label={`Traktandum ${i + 1} löschen`}>
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ol>
      )}

      <Modal open={form !== null} onClose={() => !busy && setForm(null)} title={form?.id ? "Traktandum bearbeiten" : "Traktandum hinzufügen"} size="md" dismissible={!busy}>
        {form && (
          <form onSubmit={save} noValidate className="space-y-4">
            <Field label="Titel" htmlFor="agenda-title" error={errors.title}>
              <Input id="agenda-title" value={form.title} maxLength={200} autoComplete="off" aria-invalid={Boolean(errors.title)} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </Field>
            <Field label="Beschreibung (optional, Markdown)" htmlFor="agenda-desc" error={errors.description}>
              <Textarea id="agenda-desc" rows={4} maxLength={5000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <Field label="Antrag (optional)" htmlFor="agenda-motion" error={errors.motion} hint="Der Wortlaut des Antrags, über den abgestimmt werden soll.">
              <Textarea id="agenda-motion" rows={3} maxLength={2000} value={form.motion} onChange={(e) => setForm({ ...form, motion: e.target.value })} />
            </Field>
            {formError && <Notice variant="error">{formError}</Notice>}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => setForm(null)} disabled={busy}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Wird gespeichert …" : "Speichern"}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={remove !== null}
        title="Traktandum löschen?"
        description={remove ? `«${remove.title}» wird gelöscht.${remove.resolutionCount > 0 ? " Zugehörige Beschlüsse bleiben erhalten, verlieren aber die Zuordnung zum Traktandum." : ""}` : ""}
        confirmLabel="Löschen"
        danger
        busy={busy}
        onConfirm={doRemove}
        onCancel={() => !busy && setRemove(null)}
      />
    </section>
  );
}
