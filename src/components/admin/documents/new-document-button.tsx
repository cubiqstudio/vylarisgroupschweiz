"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/admin/core/modal";
import { Notice } from "@/components/admin/core/notice";
import { useToast } from "@/components/admin/core/toast";
import { DOCUMENT_CATEGORIES, DOCUMENT_CATEGORY_LABEL, DOCUMENT_VISIBILITIES, DOCUMENT_VISIBILITY_LABEL, type DocumentVisibility } from "@/lib/verein/constants";
import { DOCUMENT_ACCEPT, VISIBILITY_HINT } from "@/lib/verein/documents-meta";
import { precheckFile, sendForm } from "./upload";

export type MeetingChoice = { id: string; label: string };

/** Knopf «Dokument hochladen» mit Dialog (Datei, Titel, Kategorie, Sichtbarkeit, optionale Sitzung). */
/** `allowBoard`: Die Person darf Dokumente «Nur Vorstand» anlegen (Einzelrecht je Rolle). */
export function NewDocumentButton({ meetings, allowBoard = true }: { meetings: MeetingChoice[]; allowBoard?: boolean }) {
  const defaultVisibility: DocumentVisibility = allowBoard ? "VORSTAND" : "MITGLIEDER";
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("SONSTIGES");
  const [visibility, setVisibility] = useState<DocumentVisibility>(defaultVisibility);
  const [meetingId, setMeetingId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function reset() {
    setFile(null);
    setTitle("");
    setDescription("");
    setCategory("SONSTIGES");
    setVisibility(defaultVisibility);
    setMeetingId("");
    setErrors({});
    setFormError(null);
  }
  function openDialog() {
    reset();
    setOpen(true);
  }
  const close = () => !busy && setOpen(false);

  function onFile(f: File | null) {
    setFile(f);
    // Titel aus dem Dateinamen vorschlagen, solange noch keiner eingegeben ist
    if (f && !title.trim()) setTitle(f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim().slice(0, 150));
  }

  async function submit(e: FormEvent) {
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
    body.set("title", title);
    body.set("description", description);
    body.set("category", category);
    body.set("visibility", visibility);
    body.set("meetingId", meetingId);
    const res = await sendForm("/api/admin/documents", body);
    setBusy(false);
    if (!res.ok) {
      setErrors(res.fields);
      setFormError(res.message);
      return;
    }
    toast.success("Das Dokument wurde hochgeladen.");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button type="button" onClick={openDialog}>
        <Upload className="h-4 w-4" aria-hidden />
        Dokument hochladen
      </Button>
      <Modal open={open} onClose={close} title="Dokument hochladen" description="PDF, Bild, Text oder Office-Datei bis 10 MB. Der Dateityp wird am Inhalt geprüft." size="md" dismissible={!busy}>
        <form onSubmit={submit} noValidate className="space-y-4">
          {formError && <Notice variant="error">{formError}</Notice>}
          <Field label="Datei" htmlFor="doc-file" error={errors.file} hint="Erlaubt: PDF, PNG, JPEG, Word (DOCX), Excel (XLSX), OpenDocument (ODT, ODS), Text (TXT).">
            <input
              id="doc-file"
              type="file"
              accept={DOCUMENT_ACCEPT}
              required
              disabled={busy}
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-zinc-300 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-100 hover:file:bg-zinc-700"
            />
          </Field>
          <Field label="Titel" htmlFor="doc-title" error={errors.title}>
            <Input id="doc-title" value={title} maxLength={150} required onChange={(e) => setTitle(e.target.value)} disabled={busy} />
          </Field>
          <Field label="Beschreibung (optional)" htmlFor="doc-desc" error={errors.description}>
            <Textarea id="doc-desc" rows={2} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} disabled={busy} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Kategorie" htmlFor="doc-cat" error={errors.category}>
              <Select id="doc-cat" value={category} onChange={(e) => setCategory(e.target.value)} disabled={busy}>
                {DOCUMENT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {DOCUMENT_CATEGORY_LABEL[c]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Sichtbarkeit" htmlFor="doc-vis" error={errors.visibility}>
              <Select id="doc-vis" value={visibility} onChange={(e) => setVisibility(e.target.value as DocumentVisibility)} disabled={busy}>
                {DOCUMENT_VISIBILITIES.filter((v) => allowBoard || v !== "VORSTAND").map((v) => (
                  <option key={v} value={v}>
                    {DOCUMENT_VISIBILITY_LABEL[v]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <p className="-mt-2 text-xs text-zinc-500">{VISIBILITY_HINT[visibility]}</p>
          {visibility === "OEFFENTLICH" && <Notice variant="warning">Öffentliche Dokumente kann jede Person ohne Anmeldung herunterladen. Bitte keine Personendaten veröffentlichen.</Notice>}
          {meetings.length > 0 && (
            <Field label="Zu einer Sitzung gehörend (optional)" htmlFor="doc-meeting" hint="Zum Beispiel ein Protokoll." error={errors.meetingId}>
              <Select id="doc-meeting" value={meetingId} onChange={(e) => setMeetingId(e.target.value)} disabled={busy}>
                <option value="">Keine Sitzung</option>
                {meetings.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </Field>
          )}
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
    </>
  );
}
