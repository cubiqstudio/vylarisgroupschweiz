"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2, MailCheck, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { api } from "@/lib/api-client";
import { ConfirmDialog } from "@/components/admin/core/confirm-dialog";
import { Modal } from "@/components/admin/core/modal";
import { Notice } from "@/components/admin/core/notice";
import { useToast } from "@/components/admin/core/toast";
import { describeError } from "@/components/admin/settings/form-utils";

type Dialog = "complete" | "cancel" | "reopen" | "mark-invited" | "delete" | null;

/** Statuswechsel einer Sitzung: durchgeführt, absagen, wieder öffnen, als eingeladen markieren, löschen. Jeder Schritt braucht eine Bestätigung. */
export function MeetingStatusActions({
  meeting,
  canWrite,
}: {
  meeting: { id: string; title: string; status: string; invitationCount: number; minutesApproved: boolean };
  canWrite: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [notify, setNotify] = useState(true);
  const [sentOn, setSentOn] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  if (!canWrite) return null;
  const open = meeting.status === "GEPLANT" || meeting.status === "EINGELADEN";
  const deletable = meeting.status === "GEPLANT" && meeting.invitationCount === 0 && !meeting.minutesApproved;
  const canReopen = (meeting.status === "ABGESAGT" || meeting.status === "DURCHGEFUEHRT") && !meeting.minutesApproved;
  const url = `/api/admin/meetings/${encodeURIComponent(meeting.id)}`;

  function show(d: Dialog) {
    setError(null);
    setFieldErrors({});
    setReason("");
    setSentOn("");
    setNotify(meeting.invitationCount > 0);
    setDialog(d);
  }

  async function run(body: Record<string, unknown>, done: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      const res = await api<{ mails?: { sent: number; failed: number } }>(`${url}/actions`, { method: "POST", body });
      toast.success(done);
      if (res?.mails) {
        if (res.mails.failed > 0) toast.error(`Absage: ${res.mails.sent} Mails versendet, ${res.mails.failed} fehlgeschlagen.`);
        else toast.success(`Absage an ${res.mails.sent} ${res.mails.sent === 1 ? "Person" : "Personen"} versendet.`);
      }
      setDialog(null);
      router.refresh();
    } catch (err) {
      const d = describeError(err, "Die Aktion ist fehlgeschlagen.");
      setError(d.message);
      setFieldErrors(d.fields);
      if (dialog === "complete" || dialog === "reopen") toast.error(d.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await api(url, { method: "DELETE" });
      toast.success("Sitzung gelöscht.");
      router.push("/admin/meetings");
      router.refresh();
    } catch (err) {
      const message = describeError(err, "Die Sitzung konnte nicht gelöscht werden.").message;
      setError(message);
      toast.error(message);
      setBusy(false);
    }
  }

  const submit = (fn: () => void) => (e: FormEvent) => {
    e.preventDefault();
    fn();
  };
  const close = () => !busy && setDialog(null);

  return (
    <>
      <div className="flex flex-wrap gap-2" role="group" aria-label={`Aktionen für ${meeting.title}`}>
        {open && (
          <Button type="button" variant="secondary" onClick={() => show("complete")}>
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            Als durchgeführt markieren
          </Button>
        )}
        {meeting.status === "GEPLANT" && (
          <Button type="button" variant="secondary" onClick={() => show("mark-invited")}>
            <MailCheck className="h-4 w-4" aria-hidden />
            Als eingeladen markieren
          </Button>
        )}
        {open && (
          <Button type="button" variant="danger" onClick={() => show("cancel")}>
            <Ban className="h-4 w-4" aria-hidden />
            Absagen
          </Button>
        )}
        {canReopen && (
          <Button type="button" variant="secondary" onClick={() => show("reopen")}>
            <RotateCcw className="h-4 w-4" aria-hidden />
            Wieder öffnen
          </Button>
        )}
        {deletable && (
          <Button type="button" variant="danger" onClick={() => show("delete")}>
            <Trash2 className="h-4 w-4" aria-hidden />
            Löschen
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={dialog === "complete"}
        title="Sitzung als durchgeführt markieren?"
        description="Danach lässt sich das Protokoll genehmigen. Du kannst die Sitzung später wieder öffnen, solange das Protokoll nicht genehmigt ist."
        confirmLabel="Als durchgeführt markieren"
        busy={busy}
        onConfirm={() => run({ action: "complete" }, "Sitzung als durchgeführt markiert.")}
        onCancel={close}
      />
      <ConfirmDialog
        open={dialog === "reopen"}
        title="Sitzung wieder öffnen?"
        description="Die Sitzung wird wieder als geplant bzw. eingeladen geführt."
        confirmLabel="Wieder öffnen"
        busy={busy}
        onConfirm={() => run({ action: "reopen" }, "Sitzung wieder geöffnet.")}
        onCancel={close}
      />
      <ConfirmDialog
        open={dialog === "delete"}
        title="Sitzung löschen?"
        description={`«${meeting.title}» wird mit Traktanden, Anwesenheit und Beschlüssen endgültig gelöscht. Das lässt sich nicht rückgängig machen.`}
        confirmLabel="Endgültig löschen"
        danger
        busy={busy}
        onConfirm={remove}
        onCancel={close}
      />

      <Modal open={dialog === "cancel"} onClose={close} title="Sitzung absagen" description="Die Sitzung bleibt mit allen Unterlagen erhalten, gilt aber als abgesagt." size="sm" dismissible={!busy}>
        <form onSubmit={submit(() => run({ action: "cancel", reason: reason.trim(), notify: meeting.invitationCount > 0 && notify }, "Sitzung abgesagt."))} noValidate className="space-y-4">
          <Field label="Grund (optional)" htmlFor="cancel-reason" error={fieldErrors.reason}>
            <Textarea id="cancel-reason" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          {meeting.invitationCount > 0 ? (
            <div className="flex items-start gap-2.5">
              <input id="cancel-notify" type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-600 bg-surface accent-emerald-400" />
              <label htmlFor="cancel-notify" className="text-sm text-zinc-300">
                Die {meeting.invitationCount} eingeladenen Personen per E-Mail über die Absage informieren
              </label>
            </div>
          ) : null}
          {error && <Notice variant="error">{error}</Notice>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={close} disabled={busy}>
              Abbrechen
            </Button>
            <Button type="submit" variant="danger" disabled={busy}>
              {busy ? "Bitte warten …" : "Sitzung absagen"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={dialog === "mark-invited"} onClose={close} title="Als eingeladen markieren" description="Für Einladungen, die du nicht über diese Software versendet hast (z. B. per Post). Es wird keine E-Mail verschickt." size="sm" dismissible={!busy}>
        <form onSubmit={submit(() => run({ action: "mark-invited", sentOn }, "Sitzung als eingeladen markiert."))} noValidate className="space-y-4">
          <Field label="Datum der Einladung" htmlFor="invited-on" error={fieldErrors.sentOn} hint="Leer = heute. Massgebend für die Prüfung der Einladungsfrist.">
            <Input id="invited-on" type="date" value={sentOn} onChange={(e) => setSentOn(e.target.value)} aria-invalid={Boolean(fieldErrors.sentOn)} />
          </Field>
          {error && <Notice variant="error">{error}</Notice>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={close} disabled={busy}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Bitte warten …" : "Markieren"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
