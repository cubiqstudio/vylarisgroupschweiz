"use client";

import { Button } from "@/components/ui/button";
import { Modal } from "./modal";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Bestätigen",
  cancelLabel = "Abbrechen",
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal open={open} onClose={() => !busy && onCancel()} title={title} description={description} size="sm" dismissible={!busy}>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={busy} data-autofocus>
          {cancelLabel}
        </Button>
        <Button type="button" variant={danger ? "danger" : "primary"} onClick={onConfirm} disabled={busy}>
          {busy ? "Bitte warten …" : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
