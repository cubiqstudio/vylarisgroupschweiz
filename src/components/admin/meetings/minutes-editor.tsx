"use client";

import { useDeferredValue, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Eye, FileText, LockOpen, Pencil, Printer, Save, Wand2 } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Markdown } from "@/components/ui/markdown";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { buildMinutesDraft, type DraftAgenda, type DraftAttendance, type DraftResolution } from "@/lib/verein/meetings-lib";
import { ConfirmDialog } from "@/components/admin/core/confirm-dialog";
import { Modal } from "@/components/admin/core/modal";
import { Notice } from "@/components/admin/core/notice";
import { useToast } from "@/components/admin/core/toast";
import { describeError } from "@/components/admin/settings/form-utils";

export type MinutesDraftData = {
  meeting: { kind: string; title: string; startsAt: string; endsAt: string | null; location: string; quorumMin: number | null; leaderName: string | null; recorderName: string | null };
  agenda: DraftAgenda[];
  resolutions: DraftResolution[];
  attendance: DraftAttendance[];
};

type Props = {
  meetingId: string;
  status: string;
  minutes: string;
  approved: { on: string; by: string; note: string } | null;
  canWrite: boolean;
  draft: MinutesDraftData;
  printHref: string;
  /** Heutiges Datum «JJJJ-MM-TT» (Zürcher Zeit) als Vorgabe für die Genehmigung */
  today: string;
};

type Dialog = "approve" | "unapprove" | "draft" | null;
type Tab = "write" | "preview";

/** Protokoll als Markdown mit Live-Vorschau, Entwurf aus Traktanden und Beschlüssen, Genehmigung (danach gesperrt) und nachträglicher Änderung mit Begründung. */
export function MinutesEditor({ meetingId, status, minutes, approved, canWrite, draft, printHref, today }: Props) {
  const router = useRouter();
  const toast = useToast();
  const locked = approved !== null;
  const base = `/api/admin/meetings/${encodeURIComponent(meetingId)}/minutes`;
  const [text, setText] = useState(minutes);
  const [baseline, setBaseline] = useState(minutes);
  const [amending, setAmending] = useState(false);
  const [amendReason, setAmendReason] = useState("");
  const [tab, setTab] = useState<Tab>("write");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [on, setOn] = useState(today);
  const [by, setBy] = useState("");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const preview = useDeferredValue(text);
  const dirty = text !== baseline;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  // Serverstand übernehmen, wenn nichts Ungespeichertes vorliegt (nach Neuladen der Seite)
  useEffect(() => {
    if (!dirtyRef.current) {
      setText(minutes);
    }
    setBaseline(minutes);
  }, [minutes]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const writable = canWrite && (!locked || amending);

  function open(d: Dialog) {
    setError(null);
    setFields({});
    setDialog(d);
  }
  const close = () => !busy && setDialog(null);

  async function save() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setFields({});
    try {
      await api(base, { method: "PATCH", body: { minutes: text, amendReason: amendReason.trim() } });
      setBaseline(text);
      toast.success(locked ? "Nachträgliche Änderung gespeichert und im Änderungsprotokoll vermerkt." : "Protokoll gespeichert.");
      if (locked) {
        setAmending(false);
        setAmendReason("");
      }
      router.refresh();
    } catch (err) {
      const d = describeError(err, "Das Protokoll konnte nicht gespeichert werden.");
      setFields(d.fields);
      setError(d.message);
      toast.error(d.message);
    } finally {
      setBusy(false);
    }
  }

  function createDraft() {
    const m = draft.meeting;
    setText(
      buildMinutesDraft({
        meeting: { ...m, startsAt: new Date(m.startsAt), endsAt: m.endsAt ? new Date(m.endsAt) : null },
        agenda: draft.agenda,
        resolutions: draft.resolutions,
        attendance: draft.attendance,
      }),
    );
    setDialog(null);
    setTab("write");
  }

  async function post(path: string, body: Record<string, unknown>, done: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setFields({});
    try {
      await api(`${base}/${path}`, { method: "POST", body });
      toast.success(done);
      setDialog(null);
      router.refresh();
    } catch (err) {
      const d = describeError(err, "Die Aktion ist fehlgeschlagen.");
      setFields(d.fields);
      setError(d.message);
    } finally {
      setBusy(false);
    }
  }

  const submit = (fn: () => void) => (e: FormEvent) => {
    e.preventDefault();
    fn();
  };

  return (
    <section aria-labelledby="min-h" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="min-h" className="text-lg font-semibold text-white">
          Protokoll
        </h2>
        <div className="flex flex-wrap gap-2">
          <a href={printHref} className={buttonClass("secondary", "md")}>
            <Printer className="h-4 w-4" aria-hidden />
            Druckansicht
          </a>
          {canWrite && !locked && (
            <Button type="button" variant="secondary" onClick={() => (text.trim() ? open("draft") : createDraft())}>
              <Wand2 className="h-4 w-4" aria-hidden />
              Entwurf aus Traktanden und Beschlüssen
            </Button>
          )}
        </div>
      </div>

      {locked && approved && (
        <Notice variant="success">
          <p className="font-medium">
            Genehmigt am {approved.on} durch {approved.by}.
          </p>
          {approved.note && <p className="mt-1 whitespace-pre-line">{approved.note}</p>}
          <p className="mt-1 text-xs opacity-80">Das Protokoll ist gesperrt. Änderungen brauchen eine Begründung und stehen im Änderungsprotokoll.</p>
        </Notice>
      )}
      {!locked && status !== "DURCHGEFUEHRT" && <Notice variant="info">Zum Genehmigen muss die Sitzung als durchgeführt markiert sein (Reiter «Übersicht»).</Notice>}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <label htmlFor="minutes-text" className="text-sm font-medium text-zinc-300">
          Text <span className="font-normal text-zinc-500">(Markdown)</span>
        </label>
        <div role="tablist" aria-label="Editor-Ansicht" className="inline-flex rounded-lg border border-zinc-800 bg-zinc-950 p-0.5 lg:hidden">
          {(
            [
              ["write", "Schreiben", Pencil],
              ["preview", "Vorschau", Eye],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors", tab === key ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-zinc-200")}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={cn(tab === "preview" && "hidden", "lg:block")}>
          <Textarea
            id="minutes-text"
            value={text}
            readOnly={!writable}
            onChange={(e) => setText(e.target.value)}
            spellCheck
            maxLength={200000}
            placeholder={"# Protokoll\n\nSchreibe das Protokoll in Markdown, oder erstelle einen Entwurf aus den Traktanden und Beschlüssen."}
            className={cn("h-[26rem] resize-y font-mono text-[13px] leading-6 lg:h-[34rem]", !writable && "opacity-80")}
          />
        </div>
        <div className={cn(tab === "write" && "hidden", "lg:block")} aria-label="Vorschau">
          <div className="h-[26rem] overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900/40 p-5 lg:h-[34rem]">
            {preview.trim() ? <Markdown>{preview}</Markdown> : <p className="text-sm text-zinc-500">Sobald du Text schreibst, erscheint hier die Vorschau.</p>}
          </div>
        </div>
      </div>

      {canWrite && (
        <Card className="space-y-3 p-4">
          {locked && amending && (
            <Field label="Begründung der Änderung" htmlFor="amend-reason" error={fields.amendReason} hint="Pflicht bei genehmigten Protokollen. Die Begründung wird im Genehmigungsvermerk und im Änderungsprotokoll festgehalten.">
              <Input id="amend-reason" value={amendReason} maxLength={500} aria-invalid={Boolean(fields.amendReason)} onChange={(e) => setAmendReason(e.target.value)} />
            </Field>
          )}
          {error && dialog === null && <Notice variant="error">{error}</Notice>}
          <div className="flex flex-wrap items-center gap-3">
            <span className="mr-auto text-sm">{dirty ? <span className="text-amber-300">Ungespeicherte Änderungen</span> : <span className="text-zinc-500">Alles gespeichert</span>}</span>
            {!locked && (
              <>
                <Button type="button" variant="secondary" onClick={() => open("approve")} disabled={busy || dirty || status !== "DURCHGEFUEHRT" || !minutes.trim()} title={dirty ? "Speichere zuerst den Text." : undefined}>
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                  Protokoll genehmigen
                </Button>
                <Button type="button" onClick={save} disabled={busy || !dirty}>
                  <Save className="h-4 w-4" aria-hidden />
                  {busy ? "Wird gespeichert …" : "Speichern"}
                </Button>
              </>
            )}
            {locked && !amending && (
              <>
                <Button type="button" variant="secondary" onClick={() => setAmending(true)}>
                  <FileText className="h-4 w-4" aria-hidden />
                  Nachträglich ändern
                </Button>
                <Button type="button" variant="danger" onClick={() => open("unapprove")}>
                  <LockOpen className="h-4 w-4" aria-hidden />
                  Genehmigung aufheben
                </Button>
              </>
            )}
            {locked && amending && (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setAmending(false);
                    setAmendReason("");
                    setText(baseline);
                    setFields({});
                  }}
                  disabled={busy}
                >
                  Abbrechen
                </Button>
                <Button type="button" onClick={save} disabled={busy || !dirty}>
                  <Save className="h-4 w-4" aria-hidden />
                  {busy ? "Wird gespeichert …" : "Änderung speichern"}
                </Button>
              </>
            )}
          </div>
        </Card>
      )}

      <ConfirmDialog
        open={dialog === "draft"}
        title="Aktuellen Text ersetzen?"
        description="Der Entwurf aus Traktanden, Anwesenheit und Beschlüssen ersetzt den aktuellen Text im Editor. Gespeichert wird erst, wenn du auf «Speichern» klickst."
        confirmLabel="Entwurf erstellen"
        onConfirm={createDraft}
        onCancel={close}
      />

      <Modal open={dialog === "approve"} onClose={close} title="Protokoll genehmigen" description="Nach der Genehmigung ist das Protokoll gesperrt und für Mitglieder im Portal sichtbar (bei Versammlungen der Mitglieder)." size="sm" dismissible={!busy}>
        <form onSubmit={submit(() => post("approve", { approvedOn: on, approvedBy: by.trim(), note: note.trim() }, "Protokoll genehmigt."))} noValidate className="space-y-4">
          <Field label="Datum der Genehmigung" htmlFor="appr-on" error={fields.approvedOn}>
            <Input id="appr-on" type="date" value={on} max={today} aria-invalid={Boolean(fields.approvedOn)} onChange={(e) => setOn(e.target.value)} />
          </Field>
          <Field label="Genehmigt durch" htmlFor="appr-by" error={fields.approvedBy} hint="Das Organ, das genehmigt hat, z. B. «Vorstand» oder «Mitgliederversammlung».">
            <Input id="appr-by" value={by} maxLength={200} aria-invalid={Boolean(fields.approvedBy)} onChange={(e) => setBy(e.target.value)} />
          </Field>
          <Field label="Vermerk (optional)" htmlFor="appr-note" error={fields.note} hint="z. B. «genehmigt an der Sitzung vom …»">
            <Textarea id="appr-note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          {error && <Notice variant="error">{error}</Notice>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={close} disabled={busy}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Bitte warten …" : "Genehmigen"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={dialog === "unapprove"} onClose={close} title="Genehmigung aufheben" description="Das Protokoll ist danach wieder bearbeitbar, ebenso Anwesenheit, Traktanden und Beschlüsse. Der Vorgang steht im Änderungsprotokoll." size="sm" dismissible={!busy}>
        <form onSubmit={submit(() => post("unapprove", { reason: reason.trim() }, "Genehmigung aufgehoben."))} noValidate className="space-y-4">
          <Field label="Begründung" htmlFor="unappr-reason" error={fields.reason}>
            <Textarea id="unappr-reason" rows={3} maxLength={500} value={reason} aria-invalid={Boolean(fields.reason)} onChange={(e) => setReason(e.target.value)} />
          </Field>
          {error && <Notice variant="error">{error}</Notice>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={close} disabled={busy}>
              Abbrechen
            </Button>
            <Button type="submit" variant="danger" disabled={busy}>
              {busy ? "Bitte warten …" : "Genehmigung aufheben"}
            </Button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
