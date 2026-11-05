"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { BellRing, Copy, EyeOff, Megaphone, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { api } from "@/lib/api-client";
import { ConfirmDialog } from "@/components/admin/core/confirm-dialog";
import { Modal } from "@/components/admin/core/modal";
import { Notice } from "@/components/admin/core/notice";
import { useToast } from "@/components/admin/core/toast";
import { describeError } from "@/components/admin/settings/form-utils";

type Props = {
  event: {
    id: string;
    title: string;
    status: string;
    /** «JJJJ-MM-TTTHH:mm» (Zürcher Zeit), Vorgabe für die Kopie */
    startsAtLocal: string;
    started: boolean;
    activeRegistrations: number;
    unremindedRegistrations: number;
  };
};

type Dialog = null | "cancel" | "copy" | "delete" | "reminders" | "unpublish";

/** Aktionen auf einem Anlass: veröffentlichen, zurückziehen, absagen, kopieren, Erinnerung versenden, löschen. Jede wirkungsvolle Aktion fragt nach. */
export function EventActions({ event }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [notify, setNotify] = useState(true);
  const [copyStart, setCopyStart] = useState(event.startsAtLocal);
  const [copyError, setCopyError] = useState<string | null>(null);

  const close = () => !busy && setDialog(null);

  async function run<T>(fn: () => Promise<T>, onDone: (r: T) => void, fallback: string) {
    if (busy) return;
    setBusy(true);
    try {
      const r = await fn();
      onDone(r);
      setDialog(null);
      router.refresh();
    } catch (err) {
      const d = describeError(err, fallback);
      toast.error(d.message);
      setCopyError(Object.values(d.fields)[0] ?? null);
      if (dialog !== "copy") setDialog(null);
    } finally {
      setBusy(false);
    }
  }

  const post = (body: unknown) => api<Record<string, unknown>>(`/api/admin/events/${encodeURIComponent(event.id)}/actions`, { method: "POST", body });

  const publish = () =>
    run(
      () => post({ action: "publish" }),
      () => toast.success("Der Anlass ist veröffentlicht."),
      "Veröffentlichen fehlgeschlagen.",
    );
  const unpublish = () =>
    run(
      () => post({ action: "unpublish" }),
      () => toast.success("Der Anlass ist wieder ein Entwurf."),
      "Zurückziehen fehlgeschlagen.",
    );
  const cancelEvent = (e: FormEvent) => {
    e.preventDefault();
    return run(
      () => post({ action: "cancel", reason, notify }),
      (r) => {
        const mail = r.mail as { mailed: number; failed: number; noEmail: number } | null;
        toast.success(mail ? `Der Anlass ist abgesagt. ${mail.mailed} ${mail.mailed === 1 ? "Mail" : "Mails"} versendet${mail.failed ? `, ${mail.failed} fehlgeschlagen` : ""}${mail.noEmail ? `, ${mail.noEmail} ohne E-Mail-Adresse` : ""}.` : "Der Anlass ist abgesagt.");
      },
      "Absagen fehlgeschlagen.",
    );
  };
  const copy = async (e: FormEvent) => {
    e.preventDefault();
    setCopyError(null);
    await run(
      () => post({ action: "duplicate", startsAt: copyStart }),
      (r) => {
        toast.success("Die Kopie ist als Entwurf angelegt.");
        router.push(`/admin/events/${String(r.id)}`);
      },
      "Kopieren fehlgeschlagen.",
    );
  };
  const remind = () =>
    run(
      () => post({ action: "reminders" }),
      (r) => {
        const s = r as unknown as { mailed: number; failed: number; noEmail: number };
        toast.success(s.mailed === 0 && s.failed === 0 && s.noEmail === 0 ? "Alle Angemeldeten haben die Erinnerung schon erhalten." : `${s.mailed} ${s.mailed === 1 ? "Erinnerung" : "Erinnerungen"} versendet${s.failed ? `, ${s.failed} fehlgeschlagen` : ""}${s.noEmail ? `, ${s.noEmail} ohne E-Mail-Adresse` : ""}.`);
      },
      "Erinnerungen konnten nicht versendet werden.",
    );
  const remove = () =>
    run(
      () => api(`/api/admin/events/${encodeURIComponent(event.id)}`, { method: "DELETE" }),
      () => {
        toast.success("Der Anlass wurde gelöscht.");
        router.push("/admin/events");
      },
      "Löschen fehlgeschlagen.",
    );

  const published = event.status === "VEROEFFENTLICHT";
  const cancelled = event.status === "ABGESAGT";
  const canRemind = published && !event.started;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {!published && (
          <Button type="button" onClick={publish} disabled={busy}>
            <Megaphone className="h-4 w-4" aria-hidden />
            {cancelled ? "Wieder ansetzen und veröffentlichen" : "Veröffentlichen"}
          </Button>
        )}
        {published && (
          <Button type="button" variant="secondary" onClick={() => (event.activeRegistrations > 0 ? toast.error("Es gibt Anmeldungen. Sage den Anlass ab, statt ihn zurückzuziehen.") : setDialog("unpublish"))} disabled={busy}>
            <EyeOff className="h-4 w-4" aria-hidden />
            Zurückziehen
          </Button>
        )}
        {canRemind && (
          <Button type="button" variant="secondary" onClick={() => setDialog("reminders")} disabled={busy}>
            <BellRing className="h-4 w-4" aria-hidden />
            Erinnerung senden
          </Button>
        )}
        <Button type="button" variant="secondary" onClick={() => setDialog("copy")} disabled={busy}>
          <Copy className="h-4 w-4" aria-hidden />
          Kopieren
        </Button>
        {published && (
          <Button type="button" variant="danger" onClick={() => setDialog("cancel")} disabled={busy}>
            <XCircle className="h-4 w-4" aria-hidden />
            Anlass absagen
          </Button>
        )}
        <Button type="button" variant="danger" onClick={() => setDialog("delete")} disabled={busy}>
          <Trash2 className="h-4 w-4" aria-hidden />
          Löschen
        </Button>
      </div>

      <ConfirmDialog
        open={dialog === "unpublish"}
        title="Anlass zurückziehen?"
        description={`«${event.title}» wird wieder zum Entwurf und ist für Besucher und Mitglieder nicht mehr sichtbar.`}
        confirmLabel="Zurückziehen"
        busy={busy}
        onConfirm={unpublish}
        onCancel={close}
      />
      <ConfirmDialog
        open={dialog === "reminders"}
        title="Erinnerung jetzt senden?"
        description={`Alle angemeldeten Personen mit E-Mail-Adresse, die noch keine Erinnerung erhalten haben (${event.unremindedRegistrations}), bekommen eine Mail zu «${event.title}». Jede Anmeldung wird höchstens einmal erinnert.`}
        confirmLabel="Erinnerung senden"
        busy={busy}
        onConfirm={remind}
        onCancel={close}
      />
      <ConfirmDialog
        open={dialog === "delete"}
        title="Anlass löschen?"
        description={`«${event.title}» wird samt allen Anmeldungen endgültig gelöscht. Wurde der Anlass durchgeführt, behalte ihn besser als Verlauf. Ein bevorstehender Anlass mit Anmeldungen muss zuerst abgesagt werden.`}
        confirmLabel="Endgültig löschen"
        danger
        busy={busy}
        onConfirm={remove}
        onCancel={close}
      />

      <Modal open={dialog === "cancel"} onClose={close} title="Anlass absagen?" description={`«${event.title}» wird als abgesagt gekennzeichnet und aus dem Kalender-Feed als abgesagt geführt. Die Anmeldungen bleiben zur Übersicht erhalten.`} size="sm" dismissible={!busy}>
        <form onSubmit={cancelEvent} className="space-y-4">
          <Field label="Grund (optional)" htmlFor="cancel-reason" hint="Erscheint in der Mail an die Angemeldeten.">
            <Textarea id="cancel-reason" rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} disabled={busy} data-autofocus />
          </Field>
          <label className="flex items-start gap-3 text-sm text-zinc-300">
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} disabled={busy} className="mt-0.5 size-4 shrink-0 accent-emerald-400" />
            <span>
              Angemeldete und Wartende per Mail informieren
              <span className="block text-xs text-zinc-500">{event.activeRegistrations} {event.activeRegistrations === 1 ? "Anmeldung" : "Anmeldungen"} (ohne E-Mail-Adresse geht keine Mail).</span>
            </span>
          </label>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={close} disabled={busy}>
              Abbrechen
            </Button>
            <Button type="submit" variant="danger" disabled={busy}>
              {busy ? "Bitte warten …" : "Anlass absagen"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={dialog === "copy"} onClose={close} title="Anlass kopieren" description="Die Kopie ist ein Entwurf ohne Anmeldungen. Dauer und Abstand des Anmeldeschlusses bleiben gleich." size="sm" dismissible={!busy}>
        <form onSubmit={copy} className="space-y-4">
          {copyError && <Notice variant="error">{copyError}</Notice>}
          <Field label="Neuer Beginn" htmlFor="copy-start" hint="Zürcher Zeit.">
            <Input id="copy-start" type="datetime-local" required value={copyStart} onChange={(e) => setCopyStart(e.target.value)} disabled={busy} />
          </Field>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={close} disabled={busy}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Bitte warten …" : "Kopie anlegen"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
