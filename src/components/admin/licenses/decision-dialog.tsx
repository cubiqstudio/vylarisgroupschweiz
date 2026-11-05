"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { Modal } from "@/components/admin/core/modal";

function DecisionForm({
  confirmLabel,
  danger,
  busy,
  noteHint,
  onSubmit,
  onCancel,
}: {
  confirmLabel: string;
  danger: boolean;
  busy: boolean;
  noteHint: string;
  onSubmit: (note: string) => void;
  onCancel: () => void;
}) {
  const [note, setNote] = useState("");
  const id = useId();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!busy) onSubmit(note.trim());
      }}
      className="space-y-4"
    >
      <div className="space-y-1.5">
        <label htmlFor={id} className="block text-sm font-medium text-zinc-300">
          Hinweis an den Nutzer (optional)
        </label>
        <Textarea id={id} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={4} disabled={busy} data-autofocus />
        <p className="flex justify-between gap-3 text-xs text-zinc-500">
          <span>{noteHint}</span>
          <span className="tabular-nums">{note.length}/500</span>
        </p>
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
          Abbrechen
        </Button>
        <Button type="submit" variant={danger ? "danger" : "primary"} disabled={busy}>
          {busy ? "Bitte warten …" : confirmLabel}
        </Button>
      </div>
    </form>
  );
}

/** Entscheidung (Freigeben, Ablehnen, Sperren …) mit optionalem Hinweis, der für den Nutzer sichtbar ist. */
export function DecisionDialog({
  open,
  title,
  description,
  confirmLabel,
  danger = false,
  busy = false,
  noteHint = "Der Hinweis wird dem Nutzer in seinem Konto angezeigt.",
  onSubmit,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  noteHint?: string;
  onSubmit: (note: string) => void;
  onCancel: () => void;
}) {
  return (
    <Modal open={open} onClose={() => !busy && onCancel()} title={title} description={description} size="sm" dismissible={!busy}>
      <DecisionForm confirmLabel={confirmLabel} danger={danger} busy={busy} noteHint={noteHint} onSubmit={onSubmit} onCancel={onCancel} />
    </Modal>
  );
}
