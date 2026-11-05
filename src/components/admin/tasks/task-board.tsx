"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, Bell, CalendarClock, MessageSquare, Plus, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { PILL } from "@/components/admin/core/styles";
import { ConfirmDialog } from "@/components/admin/core/confirm-dialog";
import { useToast } from "@/components/admin/core/toast";
import { describeError } from "@/components/admin/settings/form-utils";
import { TASK_PRIORITY_LABEL, TASK_PRIORITY_TONE, TASK_STATUSES, TASK_STATUS_LABEL, TONE_CLASS, type TaskPriority, type TaskStatus } from "@/lib/verein/constants";
import { neighbourStatus } from "@/lib/verein/tasks-lib";
import { TaskDetailDialog } from "./task-detail-dialog";
import { TaskFormDialog } from "./task-form-dialog";
import type { TaskOptions, TaskView } from "./types";

const COLUMN_TONE: Record<TaskStatus, string> = {
  OFFEN: "border-amber-500/30",
  IN_ARBEIT: "border-sky-500/30",
  ERLEDIGT: "border-emerald-500/30",
};

type Props = {
  tasks: TaskView[];
  options: TaskOptions;
  canWrite: boolean;
  /** Anzahl überfälliger Aufgaben mit Verantwortlichen (für «Überfällige erinnern») */
  overdueCount: number;
  doneHidden: number;
};

/** Board mit den Spalten Offen / In Arbeit / Erledigt. Statuswechsel per Knopf, Details und Bearbeiten im Dialog (ohne Drag-and-drop). */
export function TaskBoard({ tasks, options, canWrite, overdueCount, doneHidden }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState<{ task: TaskView | null } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [moving, setMoving] = useState<string | null>(null);
  const [remindAll, setRemindAll] = useState(false);
  const [busy, setBusy] = useState(false);

  const detail = detailId ? (tasks.find((t) => t.id === detailId) ?? null) : null;

  async function move(t: TaskView, to: TaskStatus) {
    if (moving) return;
    setMoving(t.id);
    try {
      await api(`/api/admin/tasks/${encodeURIComponent(t.id)}`, { method: "PATCH", body: { status: to } });
      toast.success(`«${t.title}» ist jetzt ${TASK_STATUS_LABEL[to].toLowerCase()}.`);
      router.refresh();
    } catch (err) {
      toast.error(describeError(err, "Der Status konnte nicht geändert werden.").message);
    } finally {
      setMoving(null);
    }
  }

  async function runRemindAll() {
    if (busy) return;
    setBusy(true);
    try {
      const r = await api<{ sent: number; failed: number; skipped: number; errors: string[] }>("/api/admin/tasks/remind-overdue", { method: "POST", body: {} });
      if (r.sent > 0) toast.success(r.sent === 1 ? "Eine Erinnerung wurde gesendet." : `${r.sent} Erinnerungen wurden gesendet.`);
      if (r.sent === 0 && r.failed === 0) toast.success("Es gab nichts zu senden: alle Verantwortlichen wurden kürzlich erinnert.");
      if (r.failed > 0) toast.error(`${r.failed} ${r.failed === 1 ? "Erinnerung konnte" : "Erinnerungen konnten"} nicht gesendet werden${r.errors[0] ? `: ${r.errors[0]}` : "."}`);
      setRemindAll(false);
      router.refresh();
    } catch (err) {
      toast.error(describeError(err, "Die Erinnerungen konnten nicht gesendet werden.").message);
      setRemindAll(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {canWrite && (
        <div className="mb-6 flex flex-wrap gap-2">
          <Button type="button" onClick={() => setForm({ task: null })}>
            <Plus className="h-4 w-4" aria-hidden />
            Neue Aufgabe
          </Button>
          {overdueCount > 0 && (
            <Button type="button" variant="secondary" onClick={() => setRemindAll(true)}>
              <Bell className="h-4 w-4" aria-hidden />
              Überfällige erinnern ({overdueCount})
            </Button>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {TASK_STATUSES.map((status) => {
          const items = tasks.filter((t) => t.status === status);
          return (
            <section key={status} aria-labelledby={`col-${status}`} className={cn("rounded-2xl border bg-zinc-900/30 p-3", COLUMN_TONE[status])}>
              <h2 id={`col-${status}`} className="mb-3 flex items-center justify-between px-1 text-sm font-semibold text-white">
                {TASK_STATUS_LABEL[status]}
                <span className="tabular-nums text-xs font-normal text-zinc-500">{items.length}</span>
              </h2>
              {items.length === 0 ? (
                <p className="rounded-lg border border-dashed border-zinc-800 px-3 py-6 text-center text-sm text-zinc-500">{status === "OFFEN" ? "Keine offenen Aufgaben." : status === "IN_ARBEIT" ? "Nichts in Arbeit." : "Noch nichts erledigt."}</p>
              ) : (
                <ul className="space-y-3">
                  {items.map((t) => {
                    const prev = neighbourStatus(t.status, "prev");
                    const next = neighbourStatus(t.status, "next");
                    return (
                      <li key={t.id}>
                        <Card className={cn("p-4", t.overdue && "border-rose-500/40")}>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={cn(PILL, TONE_CLASS[TASK_PRIORITY_TONE[t.priority as TaskPriority] ?? "zinc"])}>{TASK_PRIORITY_LABEL[t.priority as TaskPriority] ?? t.priority}</span>
                            {t.overdue && (
                              <span className={cn(PILL, TONE_CLASS.rose)}>
                                <AlertTriangle className="h-3 w-3" aria-hidden />
                                Überfällig
                              </span>
                            )}
                          </div>
                          <button type="button" onClick={() => setDetailId(t.id)} className="mt-2 block w-full rounded text-left text-sm font-medium text-white hover:text-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 [overflow-wrap:anywhere]">
                            {t.title}
                          </button>
                          <ul className="mt-2 space-y-1 text-xs text-zinc-400">
                            <li className="flex items-center gap-1.5">
                              <UserRound className="h-3.5 w-3.5 shrink-0" aria-hidden />
                              <span className="sr-only">Verantwortlich: </span>
                              {t.assigneeName || <span className="text-zinc-600">Niemand zugeteilt</span>}
                            </li>
                            {(t.dueText || (status === "ERLEDIGT" && t.doneText)) && (
                              <li className={cn("flex items-center gap-1.5", t.overdue && "text-rose-300")}>
                                <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                <span className="sr-only">Frist: </span>
                                {status === "ERLEDIGT" && t.doneText ? t.doneText : t.dueText}
                              </li>
                            )}
                            {t.meetingTitle && <li className="truncate">Sitzung: {t.meetingTitle}</li>}
                            {t.commentCount > 0 && (
                              <li className="flex items-center gap-1.5">
                                <MessageSquare className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                {t.commentCount === 1 ? "1 Kommentar" : `${t.commentCount} Kommentare`}
                              </li>
                            )}
                          </ul>
                          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-zinc-800 pt-3">
                            {canWrite && prev && (
                              <Button type="button" size="sm" variant="ghost" disabled={moving === t.id} onClick={() => move(t, prev)}>
                                <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                                {TASK_STATUS_LABEL[prev]}
                                <span className="sr-only"> (zurück verschieben: {t.title})</span>
                              </Button>
                            )}
                            {canWrite && next && (
                              <Button type="button" size="sm" variant="secondary" disabled={moving === t.id} onClick={() => move(t, next)}>
                                {TASK_STATUS_LABEL[next]}
                                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                                <span className="sr-only"> (weiter verschieben: {t.title})</span>
                              </Button>
                            )}
                            <Button type="button" size="sm" variant="ghost" className="ml-auto" onClick={() => setDetailId(t.id)}>
                              Details
                              <span className="sr-only">: {t.title}</span>
                            </Button>
                          </div>
                        </Card>
                      </li>
                    );
                  })}
                </ul>
              )}
              {status === "ERLEDIGT" && doneHidden > 0 && <p className="mt-3 px-1 text-xs text-zinc-500">{doneHidden === 1 ? "Eine ältere erledigte Aufgabe" : `${doneHidden} ältere erledigte Aufgaben`} werden hier nicht angezeigt. Nutze die Suche, um sie zu finden.</p>}
            </section>
          );
        })}
      </div>

      {tasks.length === 0 && (
        <p className="mt-6 text-center text-sm text-zinc-500">{canWrite ? "Noch keine Aufgaben: lege die erste mit «Neue Aufgabe» an oder erzeuge sie aus einem Beschluss." : "Noch keine Aufgaben."}</p>
      )}

      {form && <TaskFormDialog key={form.task?.id ?? "neu"} open task={form.task} options={options} onClose={() => setForm(null)} />}
      {detail && !form && (
        <TaskDetailDialog
          key={detail.id}
          task={detail}
          canWrite={canWrite}
          onClose={() => setDetailId(null)}
          onEdit={() => {
            setDetailId(null);
            setForm({ task: detail });
          }}
        />
      )}
      <ConfirmDialog
        open={remindAll}
        title="Überfällige Aufgaben: Erinnerungen senden?"
        description={`Die Verantwortlichen von ${overdueCount} überfälligen ${overdueCount === 1 ? "Aufgabe erhalten" : "Aufgaben erhalten"} eine E-Mail. Wer in den letzten 20 Stunden schon erinnert wurde, wird übersprungen.`}
        confirmLabel="Erinnerungen senden"
        busy={busy}
        onConfirm={runRemindAll}
        onCancel={() => setRemindAll(false)}
      />
    </>
  );
}
