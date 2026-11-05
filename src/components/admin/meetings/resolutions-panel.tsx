"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Gavel, ListPlus, Pencil, Plus, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { api } from "@/lib/api-client";
import { RESOLUTION_RESULTS, RESOLUTION_RESULT_LABEL, TASK_PRIORITIES, TASK_PRIORITY_LABEL, TASK_STATUS_LABEL, labelOf } from "@/lib/verein/constants";
import { MAJORITY_LABEL, MAJORITY_RULES, tallyResolution, voteSummary, type MajorityRule } from "@/lib/verein/meetings-lib";
import { ConfirmDialog } from "@/components/admin/core/confirm-dialog";
import { Modal } from "@/components/admin/core/modal";
import { Notice } from "@/components/admin/core/notice";
import { useToast } from "@/components/admin/core/toast";
import { describeError } from "@/components/admin/settings/form-utils";
import { EmptyState } from "@/components/admin/licenses/empty-state";
import { MemberPicker, type PickedMember } from "@/components/admin/members/member-picker";
import { ResultPill } from "./pills";

export type ResolutionRow = {
  id: string;
  number: number;
  text: string;
  agendaItemId: string | null;
  agendaTitle: string;
  votesYes: number | null;
  votesNo: number | null;
  abstentions: number | null;
  majority: string;
  result: string;
  recusal: string;
  tasks: Array<{ id: string; title: string; status: string }>;
};

type Form = { id: string | null; agendaItemId: string; text: string; yes: string; no: string; abst: string; majority: MajorityRule; result: string; recusal: string };
const BLANK: Form = { id: null, agendaItemId: "", text: "", yes: "", no: "", abst: "", majority: "EINFACH", result: "ANGENOMMEN", recusal: "" };

const toCount = (s: string): number | null => (s.trim() === "" ? null : Number(s));

type TaskForm = { resolution: ResolutionRow; title: string; description: string; dueDate: string; assignee: PickedMember | null; priority: string };

/** Beschlüsse der Sitzung: Text, Auszählung (Ja/Nein/Enthaltung), Ergebnis nach Mehrheitsregel, Ausstand und Aufgabe aus Beschluss. */
export function ResolutionsPanel({
  meetingId,
  items,
  agenda,
  presentVoters,
  canWrite,
  canCreateTask,
  canViewTasks,
  locked,
}: {
  meetingId: string;
  items: ResolutionRow[];
  agenda: Array<{ id: string; title: string }>;
  presentVoters: number;
  canWrite: boolean;
  canCreateTask: boolean;
  canViewTasks: boolean;
  locked: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const editable = canWrite && !locked;
  const base = `/api/admin/meetings/${encodeURIComponent(meetingId)}/resolutions`;
  const [form, setForm] = useState<Form | null>(null);
  const [resultTouched, setResultTouched] = useState(false);
  const [remove, setRemove] = useState<ResolutionRow | null>(null);
  const [task, setTask] = useState<TaskForm | null>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const tally = useMemo(
    () => (form ? tallyResolution({ yes: toCount(form.yes), no: toCount(form.no), abstentions: toCount(form.abst), majority: form.majority, presentVoters }) : null),
    [form, presentVoters],
  );

  function openForm(f: Form, touched: boolean) {
    setErrors({});
    setFormError(null);
    setResultTouched(touched);
    setForm(f);
  }

  /** Zahlen oder Mehrheitsregel ändern: Ergebnis mitführen, solange es nicht von Hand gewählt wurde. */
  function change(patch: Partial<Form>) {
    setForm((f) => {
      if (!f) return f;
      const next = { ...f, ...patch };
      if (!resultTouched && ("yes" in patch || "no" in patch || "majority" in patch)) {
        const t = tallyResolution({ yes: toCount(next.yes), no: toCount(next.no), majority: next.majority, presentVoters });
        if (t.result) next.result = t.result;
      }
      return next;
    });
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form || busy) return;
    setBusy(true);
    setErrors({});
    setFormError(null);
    const body = {
      agendaItemId: form.agendaItemId,
      text: form.text.trim(),
      votesYes: toCount(form.yes) ?? "",
      votesNo: toCount(form.no) ?? "",
      abstentions: toCount(form.abst) ?? "",
      majority: form.majority,
      result: form.result,
      recusal: form.recusal.trim(),
    };
    try {
      if (form.id) await api(`${base}/${encodeURIComponent(form.id)}`, { method: "PATCH", body });
      else await api(base, { method: "POST", body });
      toast.success(form.id ? "Beschluss gespeichert." : "Beschluss erfasst.");
      setForm(null);
      router.refresh();
    } catch (err) {
      const d = describeError(err, "Der Beschluss konnte nicht gespeichert werden.");
      setErrors({ ...d.fields, yes: d.fields.votesYes ?? "", no: d.fields.votesNo ?? "", abst: d.fields.abstentions ?? "" });
      setFormError(d.message);
    } finally {
      setBusy(false);
    }
  }

  async function doRemove() {
    if (!remove || busy) return;
    setBusy(true);
    try {
      await api(`${base}/${encodeURIComponent(remove.id)}`, { method: "DELETE" });
      toast.success("Beschluss gelöscht.");
      setRemove(null);
      router.refresh();
    } catch (err) {
      toast.error(describeError(err, "Der Beschluss konnte nicht gelöscht werden.").message);
    } finally {
      setBusy(false);
    }
  }

  async function saveTask(e: FormEvent) {
    e.preventDefault();
    if (!task || busy) return;
    setBusy(true);
    setErrors({});
    setFormError(null);
    try {
      await api(`${base}/${encodeURIComponent(task.resolution.id)}/task`, {
        method: "POST",
        body: { title: task.title.trim(), description: task.description, dueDate: task.dueDate, assigneeMemberId: task.assignee?.id ?? "", priority: task.priority },
      });
      toast.success("Aufgabe angelegt.");
      setTask(null);
      router.refresh();
    } catch (err) {
      const d = describeError(err, "Die Aufgabe konnte nicht angelegt werden.");
      setErrors(d.fields);
      setFormError(d.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="res-h" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="res-h" className="text-lg font-semibold text-white">
          Beschlüsse
        </h2>
        {editable && (
          <Button type="button" onClick={() => openForm(BLANK, false)}>
            <Plus className="h-4 w-4" aria-hidden />
            Beschluss erfassen
          </Button>
        )}
      </div>
      {locked && <Notice variant="info">Das Protokoll ist genehmigt und gesperrt. Beschlüsse lassen sich nicht mehr ändern. Hebe dafür die Genehmigung mit einer Begründung auf (Reiter «Protokoll»).</Notice>}

      {items.length === 0 ? (
        <EmptyState icon={Gavel} title="Noch keine Beschlüsse" text="Halte hier fest, was beschlossen wurde, mit Abstimmungsergebnis. Die Beschlüsse erscheinen im Beschlussregister und im Protokoll-Entwurf." />
      ) : (
        <ol className="space-y-3">
          {items.map((r) => (
            <li key={r.id}>
              <Card className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs uppercase tracking-wide text-zinc-500">
                      Beschluss {r.number}
                      {r.agendaTitle && <> · {r.agendaTitle}</>}
                    </p>
                    <p className="mt-1 whitespace-pre-line text-zinc-100">{r.text}</p>
                    <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-zinc-400">
                      <ResultPill result={r.result} />
                      {voteSummary(r) ? <span>{voteSummary(r)}</span> : <span>Ohne Auszählung</span>}
                      <span className="text-zinc-600" aria-hidden>
                        ·
                      </span>
                      <span>{MAJORITY_LABEL[r.majority as MajorityRule]?.split(" (")[0] ?? r.majority}</span>
                    </p>
                    {r.recusal.trim() && (
                      <p className="mt-1.5 text-sm text-zinc-400">
                        <span className="font-medium text-zinc-300">Ausstand:</span> {r.recusal}
                      </p>
                    )}
                    {r.tasks.length > 0 && (
                      <ul className="mt-2 space-y-0.5 text-sm text-zinc-400">
                        {r.tasks.map((t) => (
                          <li key={t.id}>
                            Aufgabe: {canViewTasks ? <Link href="/admin/tasks" className="text-emerald-400 hover:underline">{t.title}</Link> : t.title} ({labelOf(TASK_STATUS_LABEL, t.status)})
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-1" role="group" aria-label={`Aktionen für Beschluss ${r.number}`}>
                    {canCreateTask && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setErrors({});
                          setFormError(null);
                          setTask({ resolution: r, title: r.text.length > 120 ? `${r.text.slice(0, 117)}…` : r.text, description: "", dueDate: "", assignee: null, priority: "NORMAL" });
                        }}
                      >
                        <ListPlus className="h-4 w-4" aria-hidden />
                        Aufgabe erstellen
                      </Button>
                    )}
                    {editable && (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="px-2"
                          aria-label={`Beschluss ${r.number} bearbeiten`}
                          onClick={() =>
                            openForm(
                              {
                                id: r.id,
                                agendaItemId: r.agendaItemId ?? "",
                                text: r.text,
                                yes: r.votesYes === null ? "" : String(r.votesYes),
                                no: r.votesNo === null ? "" : String(r.votesNo),
                                abst: r.abstentions === null ? "" : String(r.abstentions),
                                majority: (MAJORITY_RULES as readonly string[]).includes(r.majority) ? (r.majority as MajorityRule) : "EINFACH",
                                result: r.result,
                                recusal: r.recusal,
                              },
                              true,
                            )
                          }
                        >
                          <Pencil className="h-4 w-4" aria-hidden />
                        </Button>
                        <Button type="button" variant="ghost" size="sm" className="px-2 text-rose-300 hover:text-rose-200" aria-label={`Beschluss ${r.number} löschen`} onClick={() => setRemove(r)}>
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ol>
      )}

      <Modal open={form !== null} onClose={() => !busy && setForm(null)} title={form?.id ? "Beschluss bearbeiten" : "Beschluss erfassen"} size="lg" dismissible={!busy}>
        {form && (
          <form onSubmit={save} noValidate className="space-y-4">
            <Field label="Zu Traktandum (optional)" htmlFor="res-agenda" error={errors.agendaItemId}>
              <Select id="res-agenda" value={form.agendaItemId} onChange={(e) => change({ agendaItemId: e.target.value })}>
                <option value="">Kein Traktandum</option>
                {agenda.map((a, i) => (
                  <option key={a.id} value={a.id}>
                    {i + 1}. {a.title}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Beschluss" htmlFor="res-text" error={errors.text} hint="Wortlaut des Beschlusses, wie er ins Protokoll kommt.">
              <Textarea id="res-text" rows={3} maxLength={2000} value={form.text} aria-invalid={Boolean(errors.text)} onChange={(e) => change({ text: e.target.value })} />
            </Field>
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium text-zinc-300">Abstimmung</legend>
              <div className="grid grid-cols-3 gap-3">
                {(
                  [
                    ["yes", "Ja"],
                    ["no", "Nein"],
                    ["abst", "Enthaltungen"],
                  ] as const
                ).map(([key, label]) => (
                  <Field key={key} label={label} htmlFor={`res-${key}`} error={errors[key]}>
                    <Input id={`res-${key}`} type="number" inputMode="numeric" min={0} max={100000} value={form[key]} aria-invalid={Boolean(errors[key])} onChange={(e) => change({ [key]: e.target.value } as Partial<Form>)} />
                  </Field>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-zinc-500">Leer lassen, wenn nicht ausgezählt wurde (z. B. einstimmig ohne Zählung). Anwesende Stimmberechtigte: {presentVoters}.</p>
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Mehrheitsregel" htmlFor="res-majority" error={errors.majority} hint="Voreinstellung: einfaches Mehr der abgegebenen Stimmen. Gemäss Statuten anpassen.">
                <Select id="res-majority" value={form.majority} onChange={(e) => change({ majority: e.target.value as MajorityRule })}>
                  {MAJORITY_RULES.map((m) => (
                    <option key={m} value={m}>
                      {MAJORITY_LABEL[m]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Ergebnis" htmlFor="res-result" error={errors.result}>
                <Select
                  id="res-result"
                  value={form.result}
                  onChange={(e) => {
                    setResultTouched(true);
                    change({ result: e.target.value });
                  }}
                >
                  {RESOLUTION_RESULTS.map((r) => (
                    <option key={r} value={r}>
                      {RESOLUTION_RESULT_LABEL[r]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            {tally && (
              <Notice variant={tally.tie || tally.result === null ? "warning" : "info"}>
                <p>
                  {tally.result ? `Rechnerisch: ${RESOLUTION_RESULT_LABEL[tally.result]}. ` : ""}
                  {tally.note}
                </p>
                {tally.result && tally.result !== form.result && form.result !== "VERSCHOBEN" && (
                  <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={() => { setResultTouched(false); change({ result: tally.result! }); }}>
                    <Wand2 className="h-4 w-4" aria-hidden />
                    Rechnerisches Ergebnis übernehmen
                  </Button>
                )}
                <p className="mt-1 text-xs opacity-80">Das Ergebnis ist ein Vorschlag. Massgeblich sind die Statuten und die Feststellung der Sitzungsleitung.</p>
              </Notice>
            )}
            <Field
              label="Ausstand (optional)"
              htmlFor="res-recusal"
              error={errors.recusal}
              hint="Wer bei diesem Beschluss nicht mitgestimmt hat. Nach ZGB Art. 68 hat ein Mitglied kein Stimmrecht, wenn es um ein Rechtsgeschäft oder einen Rechtsstreit zwischen ihm, seinem Ehegatten oder einer in gerader Linie verwandten Person und dem Verein geht. Die Statuten gehen vor."
            >
              <Input id="res-recusal" value={form.recusal} maxLength={500} onChange={(e) => change({ recusal: e.target.value })} placeholder="Name und Grund" />
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

      <Modal open={task !== null} onClose={() => !busy && setTask(null)} title="Aufgabe aus Beschluss" description={task ? `Beschluss ${task.resolution.number}: Die Aufgabe wird mit diesem Beschluss verknüpft.` : undefined} size="md" dismissible={!busy}>
        {task && (
          <form onSubmit={saveTask} noValidate className="space-y-4">
            <Field label="Titel" htmlFor="task-title" error={errors.title}>
              <Input id="task-title" value={task.title} maxLength={200} aria-invalid={Boolean(errors.title)} onChange={(e) => setTask({ ...task, title: e.target.value })} />
            </Field>
            <Field label="Beschreibung (optional)" htmlFor="task-desc" error={errors.description} hint="Leer = Text des Beschlusses.">
              <Textarea id="task-desc" rows={3} maxLength={2000} value={task.description} onChange={(e) => setTask({ ...task, description: e.target.value })} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Fällig bis (optional)" htmlFor="task-due" error={errors.dueDate}>
                <Input id="task-due" type="date" value={task.dueDate} aria-invalid={Boolean(errors.dueDate)} onChange={(e) => setTask({ ...task, dueDate: e.target.value })} />
              </Field>
              <Field label="Priorität" htmlFor="task-prio" error={errors.priority}>
                <Select id="task-prio" value={task.priority} onChange={(e) => setTask({ ...task, priority: e.target.value })}>
                  {TASK_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {TASK_PRIORITY_LABEL[p]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <MemberPicker label="Zuständig (optional)" value={task.assignee} onChange={(m) => setTask({ ...task, assignee: m })} error={errors.assigneeMemberId} />
            {formError && <Notice variant="error">{formError}</Notice>}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => setTask(null)} disabled={busy}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Wird gespeichert …" : "Aufgabe anlegen"}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={remove !== null}
        title="Beschluss löschen?"
        description={remove ? `Beschluss ${remove.number} wird gelöscht. Verknüpfte Aufgaben bleiben erhalten, verlieren aber die Zuordnung zum Beschluss. Die späteren Beschlüsse werden neu nummeriert.` : ""}
        confirmLabel="Löschen"
        danger
        busy={busy}
        onConfirm={doRemove}
        onCancel={() => !busy && setRemove(null)}
      />
    </section>
  );
}
