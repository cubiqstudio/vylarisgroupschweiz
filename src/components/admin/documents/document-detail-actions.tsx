"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Download, FilePlus2, Pencil, Trash2 } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { api } from "@/lib/api-client";
import { ConfirmDialog } from "@/components/admin/core/confirm-dialog";
import { Modal } from "@/components/admin/core/modal";
import { Notice } from "@/components/admin/core/notice";
import { useToast } from "@/components/admin/core/toast";
import { describeError } from "@/components/admin/settings/form-utils";
import { DOCUMENT_CATEGORIES, DOCUMENT_CATEGORY_LABEL, DOCUMENT_VISIBILITIES, DOCUMENT_VISIBILITY_LABEL, type DocumentVisibility } from "@/lib/verein/constants";
import { DOCUMENT_ACCEPT, VISIBILITY_HINT } from "@/lib/verein/documents-meta";
import type { MeetingChoice } from "./new-document-button";
import { precheckFile, sendForm } from "./upload";

type Dialog = "edit" | "version" | "archive" | "delete" | null;

export type DocumentDetailActionsProps = {
  doc: { id: string; title: string; description: string; category: string; visibility: string; meetingId: string | null; archived: boolean; currentVersion: number };
  meetings: MeetingChoice[];
  canWrite: boolean;
  /** Die Person darf «Nur Vorstand» wählen (Einzelrecht je Rolle). */
  allowBoard?: boolean;
};

/** Aktionen auf einem Dokument: Download, Angaben bearbeiten, neue Version, Archivieren, Löschen (mit Bestätigung). */
export function DocumentDetailActions({ doc, meetings, canWrite, allowBoard = true }: DocumentDetailActionsProps) {
  const router = useRouter();
  const toast = useToast();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const [title, setTitle] = useState(doc.title);
  const [description, setDescription] = useState(doc.description);
  const [category, setCategory] = useState(doc.category);
  const [visibility, setVisibility] = useState(doc.visibility as DocumentVisibility);
  const [meetingId, setMeetingId] = useState(doc.meetingId ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [changeNote, setChangeNote] = useState("");

  function open(d: Dialog) {
    setErrors({});
    setFormError(null);
    setTitle(doc.title);
    setDescription(doc.description);
    setCategory(doc.category);
    setVisibility(doc.visibility as DocumentVisibility);
    setMeetingId(doc.meetingId ?? "");
    setFile(null);
    setChangeNote("");
    setDialog(d);
  }
  const close = () => !busy && setDialog(null);

  async function patch(body: Record<string, unknown>, success: string) {
    if (busy) return;
    setBusy(true);
    setErrors({});
    setFormError(null);
    try {
      await api(`/api/admin/documents/${encodeURIComponent(doc.id)}`, { method: "PATCH", body });
      toast.success(success);
      setDialog(null);
      router.refresh();
    } catch (err) {
      const d = describeError(err, "Die Änderung ist fehlgeschlagen.");
      setErrors(d.fields);
      setFormError(d.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (busy) return;
    setBusy(true);
    try {
      await api(`/api/admin/documents/${encodeURIComponent(doc.id)}`, { method: "DELETE" });
      toast.success("Das Dokument wurde gelöscht.");
      router.push("/admin/documents");
      router.refresh();
    } catch (err) {
      toast.error(describeError(err, "Das Dokument konnte nicht gelöscht werden.").message);
      setBusy(false);
      setDialog(null);
    }
  }

  async function uploadVersion(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const pre = precheckFile(file);
    if (pre) {
      setErrors({ file: pre });
      setFormError("Bitte prüfe die markierten Felder.");
      return;
    }
    setBusy(true);
    setErrors({});
    setFormError(null);
    const body = new FormData();
    body.set("file", file as File);
    body.set("changeNote", changeNote);
    const res = await sendForm(`/api/admin/documents/${encodeURIComponent(doc.id)}/versions`, body);
    setBusy(false);
    if (!res.ok) {
      setErrors(res.fields);
      setFormError(res.message);
      return;
    }
    toast.success("Die neue Version wurde hochgeladen.");
    setDialog(null);
    router.refresh();
  }

  const submitEdit = (e: FormEvent) => {
    e.preventDefault();
    void patch({ title, description, category, visibility, meetingId }, "Die Änderungen wurden gespeichert.");
  };

  return (
    <>
      <div className="flex flex-wrap gap-2" role="group" aria-label={`Aktionen für ${doc.title}`}>
        <a href={`/api/admin/documents/${encodeURIComponent(doc.id)}/download`} download className={buttonClass("primary", "md")}>
          <Download className="h-4 w-4" aria-hidden />
          Herunterladen
        </a>
        {canWrite && (
          <>
            <Button type="button" variant="secondary" onClick={() => open("version")}>
              <FilePlus2 className="h-4 w-4" aria-hidden />
              Neue Version
            </Button>
            <Button type="button" variant="secondary" onClick={() => open("edit")}>
              <Pencil className="h-4 w-4" aria-hidden />
              Bearbeiten
            </Button>
            <Button type="button" variant="secondary" onClick={() => open("archive")}>
              {doc.archived ? <ArchiveRestore className="h-4 w-4" aria-hidden /> : <Archive className="h-4 w-4" aria-hidden />}
              {doc.archived ? "Wiederherstellen" : "Archivieren"}
            </Button>
            <Button type="button" variant="danger" onClick={() => open("delete")}>
              <Trash2 className="h-4 w-4" aria-hidden />
              Löschen
            </Button>
          </>
        )}
      </div>

      <Modal open={dialog === "edit"} onClose={close} title="Dokument bearbeiten" description="Titel, Kategorie und Sichtbarkeit ändern. Die Datei bleibt unverändert." size="md" dismissible={!busy}>
        <form onSubmit={submitEdit} noValidate className="space-y-4">
          {formError && <Notice variant="error">{formError}</Notice>}
          <Field label="Titel" htmlFor="e-title" error={errors.title}>
            <Input id="e-title" value={title} maxLength={150} required onChange={(e) => setTitle(e.target.value)} disabled={busy} />
          </Field>
          <Field label="Beschreibung (optional)" htmlFor="e-desc" error={errors.description}>
            <Textarea id="e-desc" rows={2} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} disabled={busy} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Kategorie" htmlFor="e-cat" error={errors.category}>
              <Select id="e-cat" value={category} onChange={(e) => setCategory(e.target.value)} disabled={busy}>
                {DOCUMENT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {DOCUMENT_CATEGORY_LABEL[c]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Sichtbarkeit" htmlFor="e-vis" error={errors.visibility}>
              <Select id="e-vis" value={visibility} onChange={(e) => setVisibility(e.target.value as DocumentVisibility)} disabled={busy}>
                {DOCUMENT_VISIBILITIES.filter((v) => allowBoard || v !== "VORSTAND").map((v) => (
                  <option key={v} value={v}>
                    {DOCUMENT_VISIBILITY_LABEL[v]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <p className="-mt-2 text-xs text-zinc-500">{VISIBILITY_HINT[visibility]}</p>
          {visibility === "OEFFENTLICH" && doc.visibility !== "OEFFENTLICH" && (
            <Notice variant="warning">Mit dieser Änderung kann jede Person ohne Anmeldung die aktuelle Fassung herunterladen. Frühere Fassungen bleiben der Verwaltung vorbehalten.</Notice>
          )}
          {(meetings.length > 0 || doc.meetingId) && (
            <Field label="Zu einer Sitzung gehörend (optional)" htmlFor="e-meeting" error={errors.meetingId}>
              <Select id="e-meeting" value={meetingId} onChange={(e) => setMeetingId(e.target.value)} disabled={busy}>
                <option value="">Keine Sitzung</option>
                {meetings.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
                {doc.meetingId && !meetings.some((m) => m.id === doc.meetingId) && <option value={doc.meetingId}>Bisherige Sitzung</option>}
              </Select>
            </Field>
          )}
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={close} disabled={busy}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Bitte warten …" : "Speichern"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={dialog === "version"}
        onClose={close}
        title="Neue Version hochladen"
        description={`Die aktuelle Fassung ist Version ${doc.currentVersion}. Sie bleibt im Verlauf abrufbar; die neue Datei wird Version ${doc.currentVersion + 1}.`}
        size="md"
        dismissible={!busy}
      >
        <form onSubmit={uploadVersion} noValidate className="space-y-4">
          {formError && <Notice variant="error">{formError}</Notice>}
          <Field label="Datei" htmlFor="v-file" error={errors.file} hint="Bis 10 MB. Der Dateityp wird am Inhalt geprüft.">
            <input
              id="v-file"
              type="file"
              accept={DOCUMENT_ACCEPT}
              required
              disabled={busy}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-zinc-300 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-100 hover:file:bg-zinc-700"
            />
          </Field>
          <Field label="Was hat sich geändert? (optional)" htmlFor="v-note" error={errors.changeNote}>
            <Input id="v-note" value={changeNote} maxLength={300} onChange={(e) => setChangeNote(e.target.value)} disabled={busy} />
          </Field>
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={close} disabled={busy}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Wird hochgeladen …" : "Hochladen"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={dialog === "archive"}
        title={doc.archived ? "Dokument wiederherstellen?" : "Dokument archivieren?"}
        description={
          doc.archived
            ? "Das Dokument ist danach wieder gemäss seiner Sichtbarkeit abrufbar."
            : "Archivierte Dokumente verschwinden für Mitglieder und Besuchende, bleiben aber in der Verwaltung erhalten und können jederzeit wiederhergestellt werden."
        }
        confirmLabel={doc.archived ? "Wiederherstellen" : "Archivieren"}
        busy={busy}
        onConfirm={() => patch({ archived: !doc.archived }, doc.archived ? "Das Dokument wurde wiederhergestellt." : "Das Dokument wurde archiviert.")}
        onCancel={close}
      />
      <ConfirmDialog
        open={dialog === "delete"}
        title="Dokument löschen?"
        description={`«${doc.title}» wird mit allen Versionen endgültig gelöscht. Das lässt sich nicht rückgängig machen. Archivieren ist die mildere Alternative.`}
        confirmLabel="Endgültig löschen"
        danger
        busy={busy}
        onConfirm={remove}
        onCancel={close}
      />
    </>
  );
}
