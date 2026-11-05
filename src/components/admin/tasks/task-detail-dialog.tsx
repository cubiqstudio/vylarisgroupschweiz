"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Bell, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/form";
import { api } from "@/lib/api-client";
import { ConfirmDialog } from "@/components/admin/core/confirm-dialog";
import { Modal } from "@/components/admin/core/modal";
import { Notice } from "@/components/admin/core/notice";
import { useToast } from "@/components/admin/core/toast";
import { describeError } from "@/components/admin/settings/form-utils";
import { formatDateTimeCh } from "@/lib/verein/dates";
import type { TaskComment, TaskView } from "./types";

type Loaded = { comments: Array<{ id: string; body: string; authorName: string; createdAt: string }> };

/** Details einer Aufgabe: Beschreibung, Kommentare, Erinnerung an die verantwortliche Person, Löschen. */
export function TaskDetailDialog({
  task,
  canWrite,
  onClose,
  onEdit,
}: {
  task: TaskView;
  canWrite: boolean;
  onClose: () => void;
  onEdit: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [comments, setComments] = useState<TaskComment[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sub, setSub] = useState<"remind" | "delete" | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    const ctrl = new AbortController();
    api<Loaded>(`/api/admin/tasks/${encodeURIComponent(task.id)}`, { signal: ctrl.signal })
      .then((t) => setComments(t.comments))
      .catch((err) => {
        if (!ctrl.signal.aborted) setLoadError(describeError(err, "Die Kommentare konnten nicht geladen werden.").message);
      });
    return () => ctrl.abort();
  }, [task.id]);

  async function addComment(e: FormEvent) {
    e.preventDefault();
    if (busy || !body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const c = await api<TaskComment>(`/api/admin/tasks/${encodeURIComponent(task.id)}/comments`, { method: "POST", body: { body } });
      setComments((prev) => [...(prev ?? []), c]);
      setBody("");
      router.refresh();
    } catch (err) {
      setError(describeError(err, "Der Kommentar konnte nicht gespeichert werden.").message);
    } finally {
      setBusy(false);
    }
  }

  async function remind() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await api<{ to: string }>(`/api/admin/tasks/${encodeURIComponent(task.id)}/remind`, { method: "POST", body: { note } });
      toast.success(`Die Erinnerung wurde an ${res.to} gesendet.`);
      setSub(null);
      setNote("");
      router.refresh();
    } catch (err) {
      toast.error(describeError(err, "Die Erinnerung konnte nicht gesendet werden.").message);
      setSub(null);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (busy) return;
    setBusy(true);
    try {
      await api(`/api/admin/tasks/${encodeURIComponent(task.id)}`, { method: "DELETE" });
      toast.success("Die Aufgabe wurde gelöscht.");
      onClose();
      router.refresh();
    } catch (err) {
      toast.error(describeError(err, "Die Aufgabe konnte nicht gelöscht werden.").message);
      setSub(null);
      setBusy(false);
    }
  }

  const canRemind = canWrite && task.assignee !== "" && task.status !== "ERLEDIGT";

  return (
    <>
      <Modal open={sub === null} onClose={() => !busy && onClose()} title={task.title} size="lg" dismissible={!busy}>
        <div className="space-y-5">
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-zinc-500">Verantwortlich</dt>
              <dd className="mt-0.5 text-zinc-200">{task.assigneeName || <span className="text-zinc-500">Niemand zugeteilt</span>}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-zinc-500">Frist</dt>
              <dd className={task.overdue ? "mt-0.5 font-medium text-rose-300" : "mt-0.5 text-zinc-200"}>{task.dueText || <span className="text-zinc-500">Keine Frist</span>}</dd>
            </div>
            {task.meetingTitle && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-zinc-500">Sitzung</dt>
                <dd className="mt-0.5 text-zinc-200">{task.meetingTitle}</dd>
              </div>
            )}
            {task.resolutionLabel && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-zinc-500">Beschluss</dt>
                <dd className="mt-0.5 text-zinc-200 [overflow-wrap:anywhere]">{task.resolutionLabel}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs uppercase tracking-wide text-zinc-500">Angelegt von</dt>
              <dd className="mt-0.5 text-zinc-200">{task.createdByName || "–"}</dd>
            </div>
            {task.lastReminderText && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-zinc-500">Letzte Erinnerung</dt>
                <dd className="mt-0.5 text-zinc-200">{task.lastReminderText}</dd>
              </div>
            )}
          </dl>

          {task.description && <p className="whitespace-pre-wrap rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-sm leading-relaxed text-zinc-300 [overflow-wrap:anywhere]">{task.description}</p>}

          <section aria-labelledby="comments-heading">
            <h3 id="comments-heading" className="mb-2 text-sm font-semibold text-white">
              Kommentare
            </h3>
            {loadError && <Notice variant="error">{loadError}</Notice>}
            {!loadError && comments === null && <p className="text-sm text-zinc-500">Wird geladen …</p>}
            {comments && comments.length === 0 && <p className="text-sm text-zinc-500">Noch keine Kommentare.</p>}
            {comments && comments.length > 0 && (
              <ul className="space-y-2">
                {comments.map((c) => (
                  <li key={c.id} className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2">
                    <p className="text-xs text-zinc-500">
                      {c.authorName || "Unbekannt"} · {formatDateTimeCh(new Date(c.createdAt))}
                    </p>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm text-zinc-200 [overflow-wrap:anywhere]">{c.body}</p>
                  </li>
                ))}
              </ul>
            )}
            {canWrite && (
              <form onSubmit={addComment} noValidate className="mt-3 space-y-2">
                {error && <Notice variant="error">{error}</Notice>}
                <Field label="Kommentar schreiben" htmlFor="c-body">
                  <Textarea id="c-body" rows={2} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} disabled={busy} />
                </Field>
                <div className="flex justify-end">
                  <Button type="submit" size="sm" disabled={busy || !body.trim()}>
                    Kommentar speichern
                  </Button>
                </div>
              </form>
            )}
          </section>

          {canWrite && (
            <div className="flex flex-col gap-2 border-t border-zinc-800 pt-4 sm:flex-row sm:flex-wrap sm:justify-end">
              {canRemind && (
                <Button type="button" variant="secondary" onClick={() => setSub("remind")}>
                  <Bell className="h-4 w-4" aria-hidden />
                  Erinnerung senden
                </Button>
              )}
              <Button type="button" variant="secondary" onClick={onEdit}>
                <Pencil className="h-4 w-4" aria-hidden />
                Bearbeiten
              </Button>
              <Button type="button" variant="danger" onClick={() => setSub("delete")}>
                <Trash2 className="h-4 w-4" aria-hidden />
                Löschen
              </Button>
            </div>
          )}
        </div>
      </Modal>

      <Modal open={sub === "remind"} onClose={() => !busy && setSub(null)} title="Erinnerung senden" description={`${task.assigneeName} erhält eine E-Mail zu dieser Aufgabe. Pro Aufgabe ist höchstens eine Erinnerung innert 20 Stunden möglich.`} size="sm" dismissible={!busy}>
        <div className="space-y-4">
          <Field label="Eigene Nachricht (optional)" htmlFor="r-note">
            <Textarea id="r-note" rows={3} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} disabled={busy} />
          </Field>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setSub(null)} disabled={busy}>
              Abbrechen
            </Button>
            <Button type="button" onClick={remind} disabled={busy}>
              {busy ? "Wird gesendet …" : "Erinnerung senden"}
            </Button>
          </div>
        </div>
      </Modal>
      <ConfirmDialog
        open={sub === "delete"}
        title="Aufgabe löschen?"
        description={`«${task.title}» wird mit allen Kommentaren gelöscht. Das lässt sich nicht rückgängig machen.`}
        confirmLabel="Löschen"
        danger
        busy={busy}
        onConfirm={remove}
        onCancel={() => setSub(null)}
      />
    </>
  );
}
