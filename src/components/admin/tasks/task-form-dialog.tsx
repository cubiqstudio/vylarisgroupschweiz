"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { api } from "@/lib/api-client";
import { Modal } from "@/components/admin/core/modal";
import { Notice } from "@/components/admin/core/notice";
import { useToast } from "@/components/admin/core/toast";
import { describeError } from "@/components/admin/settings/form-utils";
import { TASK_PRIORITIES, TASK_PRIORITY_LABEL, TASK_STATUSES, TASK_STATUS_LABEL } from "@/lib/verein/constants";
import type { TaskOptions, TaskView } from "./types";

/** Dialog zum Anlegen (task = null) und Bearbeiten einer Aufgabe. */
export function TaskFormDialog({ open, task, options, onClose }: { open: boolean; task: TaskView | null; options: TaskOptions; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [assignee, setAssignee] = useState(task?.assignee ?? "");
  const [dueDate, setDueDate] = useState(task?.dueInput ?? "");
  const [priority, setPriority] = useState(task?.priority ?? "NORMAL");
  const [status, setStatus] = useState(task?.status ?? "OFFEN");
  const [meetingId, setMeetingId] = useState(task?.meetingId ?? "");
  const [resolutionId, setResolutionId] = useState(task?.resolutionId ?? "");

  const resolutions = options.resolutions.filter((r) => !meetingId || r.meetingId === meetingId);
  const known = new Set(options.assignees.map((a) => a.value));
  const groups: Array<"Verwaltung" | "Vorstand"> = ["Verwaltung", "Vorstand"];

  const close = () => !busy && onClose();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErrors({});
    setFormError(null);
    const body = { title, description, assignee, dueDate, priority, status, meetingId, resolutionId };
    try {
      if (task) await api(`/api/admin/tasks/${encodeURIComponent(task.id)}`, { method: "PATCH", body });
      else await api("/api/admin/tasks", { method: "POST", body });
      toast.success(task ? "Die Aufgabe wurde gespeichert." : "Die Aufgabe wurde angelegt.");
      onClose();
      router.refresh();
    } catch (err) {
      const d = describeError(err, "Die Aufgabe konnte nicht gespeichert werden.");
      setErrors(d.fields);
      setFormError(d.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={close} title={task ? "Aufgabe bearbeiten" : "Neue Aufgabe"} description="Aufgaben des Vorstands mit Verantwortlichen und Frist." size="lg" dismissible={!busy}>
      <form onSubmit={submit} noValidate className="space-y-4">
        {formError && <Notice variant="error">{formError}</Notice>}
        <Field label="Titel" htmlFor="t-title" error={errors.title}>
          <Input id="t-title" value={title} maxLength={150} required onChange={(e) => setTitle(e.target.value)} disabled={busy} />
        </Field>
        <Field label="Beschreibung (optional)" htmlFor="t-desc" error={errors.description}>
          <Textarea id="t-desc" rows={3} maxLength={5000} value={description} onChange={(e) => setDescription(e.target.value)} disabled={busy} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Verantwortlich" htmlFor="t-assignee" error={errors.assignee}>
            <Select id="t-assignee" value={assignee} onChange={(e) => setAssignee(e.target.value)} disabled={busy}>
              <option value="">Niemand zugeteilt</option>
              {groups.map((g) => {
                const items = options.assignees.filter((a) => a.group === g);
                return items.length ? (
                  <optgroup key={g} label={g === "Verwaltung" ? "Konten der Verwaltung" : "Weitere Vorstandsmitglieder"}>
                    {items.map((a) => (
                      <option key={a.value} value={a.value}>
                        {a.label}
                      </option>
                    ))}
                  </optgroup>
                ) : null;
              })}
              {assignee && !known.has(assignee) && <option value={assignee}>{task?.assigneeName || "Bisherige Person"}</option>}
            </Select>
          </Field>
          <Field label="Frist (optional)" htmlFor="t-due" error={errors.dueDate}>
            <Input id="t-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={busy} />
          </Field>
          <Field label="Priorität" htmlFor="t-prio" error={errors.priority}>
            <Select id="t-prio" value={priority} onChange={(e) => setPriority(e.target.value)} disabled={busy}>
              {TASK_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {TASK_PRIORITY_LABEL[p]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status" htmlFor="t-status" error={errors.status}>
            <Select id="t-status" value={status} onChange={(e) => setStatus(e.target.value)} disabled={busy}>
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {TASK_STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Sitzung (optional)" htmlFor="t-meeting" error={errors.meetingId}>
            <Select
              id="t-meeting"
              value={meetingId}
              onChange={(e) => {
                setMeetingId(e.target.value);
                setResolutionId("");
              }}
              disabled={busy}
            >
              <option value="">Keine Sitzung</option>
              {options.meetings.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title} ({m.dateText})
                </option>
              ))}
              {meetingId && !options.meetings.some((m) => m.id === meetingId) && <option value={meetingId}>{task?.meetingTitle || "Bisherige Sitzung"}</option>}
            </Select>
          </Field>
          <Field label="Beschluss (optional)" htmlFor="t-res" error={errors.resolutionId}>
            <Select id="t-res" value={resolutionId} onChange={(e) => setResolutionId(e.target.value)} disabled={busy || (!meetingId && resolutions.length === 0)}>
              <option value="">Kein Beschluss</option>
              {resolutions.map((r) => (
                <option key={r.id} value={r.id}>
                  Beschluss {r.number}: {r.text.slice(0, 60)}
                </option>
              ))}
              {resolutionId && !options.resolutions.some((r) => r.id === resolutionId) && <option value={resolutionId}>{task?.resolutionLabel || "Bisheriger Beschluss"}</option>}
            </Select>
          </Field>
        </div>
        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={close} disabled={busy}>
            Abbrechen
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Bitte warten …" : task ? "Speichern" : "Aufgabe anlegen"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
