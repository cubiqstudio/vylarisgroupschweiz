"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Save, UserMinus, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { api } from "@/lib/api-client";
import { ATTENDANCE_STATUSES, ATTENDANCE_STATUS_LABEL } from "@/lib/verein/constants";
import { quorumHint } from "@/lib/verein/meetings-lib";
import { ConfirmDialog } from "@/components/admin/core/confirm-dialog";
import { Notice } from "@/components/admin/core/notice";
import { useToast } from "@/components/admin/core/toast";
import { describeError } from "@/components/admin/settings/form-utils";
import { EmptyState } from "@/components/admin/licenses/empty-state";
import { MemberPicker, type PickedMember } from "@/components/admin/members/member-picker";
import { RsvpPill } from "./pills";

export type AttendanceRow = { memberId: string; memberNumber: number; name: string; status: string; canVote: boolean; note: string; rsvp: "" | "ZUSAGE" | "ABSAGE" };

/** Anwesenheitsliste: Status, Stimmrecht und Bemerkung je Person; Beschlussfähigkeit nur als Hinweis nach der Mindestzahl aus den Statuten. */
export function AttendancePanel({ meetingId, rows, quorumMin, canWrite, locked }: { meetingId: string; rows: AttendanceRow[]; quorumMin: number | null; canWrite: boolean; locked: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const editable = canWrite && !locked;
  const base = `/api/admin/meetings/${encodeURIComponent(meetingId)}/attendance`;
  const [local, setLocal] = useState<AttendanceRow[]>(rows);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<PickedMember | null>(null);
  const [remove, setRemove] = useState<AttendanceRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Nach dem Neuladen der Seite die Serverdaten übernehmen
  useEffect(() => setLocal(rows), [rows]);

  const dirty = useMemo(() => JSON.stringify(local) !== JSON.stringify(rows), [local, rows]);
  const present = local.filter((r) => r.status === "ANWESEND");
  const voters = present.filter((r) => r.canVote).length;
  const excused = local.filter((r) => r.status === "ENTSCHULDIGT").length;
  const hint = quorumHint({ presentVoters: voters, quorumMin });

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const patch = (id: string, change: Partial<AttendanceRow>) => setLocal((l) => l.map((r) => (r.memberId === id ? { ...r, ...change } : r)));

  async function act(body: Record<string, unknown>, done: string) {
    if (busy) return false;
    setBusy(true);
    setError(null);
    try {
      await api(base, { method: "POST", body });
      toast.success(done);
      router.refresh();
      return true;
    } catch (err) {
      const message = describeError(err, "Die Aktion ist fehlgeschlagen.").message;
      setError(message);
      toast.error(message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  const save = () => act({ action: "save", rows: local.map((r) => ({ memberId: r.memberId, status: r.status, canVote: r.canVote, note: r.note })) }, "Anwesenheit gespeichert.");

  return (
    <section aria-labelledby="att-h" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="att-h" className="text-lg font-semibold text-white">
          Anwesenheit
        </h2>
        {editable && local.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {local.some((r) => r.rsvp === "ZUSAGE" && r.status !== "ANWESEND") && (
              <Button type="button" variant="secondary" onClick={() => setLocal((l) => l.map((r) => (r.rsvp === "ZUSAGE" ? { ...r, status: "ANWESEND" } : r)))}>
                Zusagen als anwesend übernehmen
              </Button>
            )}
            <Button type="button" onClick={save} disabled={busy || !dirty}>
              <Save className="h-4 w-4" aria-hidden />
              {busy ? "Wird gespeichert …" : "Anwesenheit speichern"}
            </Button>
          </div>
        )}
      </div>

      {locked && <Notice variant="info">Das Protokoll ist genehmigt und gesperrt. Die Anwesenheit lässt sich nicht mehr ändern.</Notice>}
      {error && <Notice variant="error">{error}</Notice>}

      {local.length === 0 ? (
        <>
          <EmptyState icon={Users} title="Noch keine Anwesenheitsliste" text="Erstelle die Liste aus den aktiven Mitgliedern (Vorstandssitzung: aus den aktiven Ämtern). Danach hakst du ab, wer anwesend oder entschuldigt ist." />
          {editable && (
            <div className="flex justify-center">
              <Button type="button" onClick={() => act({ action: "init" }, "Anwesenheitsliste erstellt.")} disabled={busy}>
                <Users className="h-4 w-4" aria-hidden />
                Anwesenheitsliste erstellen
              </Button>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="text-sm text-zinc-300" aria-live="polite">
            <span className="font-medium text-white">{present.length}</span> anwesend, davon <span className="font-medium text-white">{voters}</span> stimmberechtigt · <span className="font-medium text-white">{excused}</span> entschuldigt
          </p>
          {hint.state !== "none" && <Notice variant={hint.state === "ok" ? "success" : "warning"}>{hint.text}</Notice>}
          {hint.state === "none" && <p className="text-xs text-zinc-500">{hint.text}</p>}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto" role="region" aria-label="Anwesenheitsliste" tabIndex={0}>
              <table className="w-full min-w-[46rem] text-left text-sm">
                <thead className="border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">Name</th>
                    <th scope="col" className="px-4 py-3 font-medium">Rückmeldung</th>
                    <th scope="col" className="px-4 py-3 font-medium">Status</th>
                    <th scope="col" className="px-4 py-3 font-medium">Stimmrecht</th>
                    <th scope="col" className="px-4 py-3 font-medium">Bemerkung</th>
                    {editable && (
                      <th scope="col" className="px-4 py-3">
                        <span className="sr-only">Entfernen</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {local.map((r) => (
                    <tr key={r.memberId}>
                      <td className="px-4 py-2 text-zinc-200">
                        {r.name} <span className="text-xs text-zinc-500">Nr. {r.memberNumber}</span>
                      </td>
                      <td className="px-4 py-2">
                        <RsvpPill rsvp={r.rsvp} />
                      </td>
                      <td className="px-4 py-2">
                        <label className="sr-only" htmlFor={`st-${r.memberId}`}>
                          Status von {r.name}
                        </label>
                        <Select id={`st-${r.memberId}`} value={r.status} disabled={!editable} className="h-9 w-40" onChange={(e) => patch(r.memberId, { status: e.target.value })}>
                          {ATTENDANCE_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {ATTENDANCE_STATUS_LABEL[s]}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="checkbox"
                          id={`vote-${r.memberId}`}
                          checked={r.canVote}
                          disabled={!editable}
                          onChange={(e) => patch(r.memberId, { canVote: e.target.checked })}
                          className="h-4 w-4 rounded border-zinc-600 bg-surface accent-emerald-400"
                        />
                        <label htmlFor={`vote-${r.memberId}`} className="ml-2 text-zinc-300">
                          <span className="sr-only">{r.name}: </span>stimmberechtigt
                        </label>
                      </td>
                      <td className="px-4 py-2">
                        <label className="sr-only" htmlFor={`note-${r.memberId}`}>
                          Bemerkung zu {r.name}
                        </label>
                        <Input id={`note-${r.memberId}`} value={r.note} maxLength={200} disabled={!editable} className="h-9 min-w-40" onChange={(e) => patch(r.memberId, { note: e.target.value })} />
                      </td>
                      {editable && (
                        <td className="px-4 py-2 text-right">
                          <Button type="button" variant="ghost" size="sm" className="px-2 text-rose-300 hover:text-rose-200" disabled={dirty} onClick={() => setRemove(r)} aria-label={`${r.name} von der Liste entfernen`}>
                            <UserMinus className="h-4 w-4" aria-hidden />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          {dirty && editable && <p className="text-sm text-amber-300">Ungespeicherte Änderungen. Speichere die Anwesenheit, bevor du die Seite verlässt.</p>}
        </>
      )}

      {editable && (
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-medium text-zinc-300">Person ergänzen</h3>
          {dirty && <p className="mb-3 text-xs text-amber-300">Speichere zuerst die Änderungen oben, bevor du Personen ergänzt oder entfernst.</p>}
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <MemberPicker label="Mitglied suchen (aktive Mitglieder)" value={picked} onChange={setPicked} disabled={busy || dirty} />
            <div className="flex gap-2">
              {local.length > 0 && (
                <Button type="button" variant="secondary" disabled={busy || dirty} onClick={() => act({ action: "init" }, "Liste mit fehlenden Personen ergänzt.")}>
                  Fehlende ergänzen
                </Button>
              )}
              <Button
                type="button"
                disabled={busy || dirty || !picked}
                onClick={async () => {
                  if (picked && (await act({ action: "add", memberId: picked.id }, "Person hinzugefügt."))) setPicked(null);
                }}
              >
                <UserPlus className="h-4 w-4" aria-hidden />
                Hinzufügen
              </Button>
            </div>
          </div>
        </Card>
      )}

      <ConfirmDialog
        open={remove !== null}
        title="Person von der Liste entfernen?"
        description={remove ? `${remove.name} wird von der Anwesenheitsliste dieser Sitzung entfernt, samt Rückmeldung und Bemerkung.` : ""}
        confirmLabel="Entfernen"
        danger
        busy={busy}
        onConfirm={async () => {
          if (remove && (await act({ action: "remove", memberId: remove.memberId }, "Person entfernt."))) setRemove(null);
        }}
        onCancel={() => !busy && setRemove(null)}
      />
    </section>
  );
}
