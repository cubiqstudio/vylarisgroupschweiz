"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Download, FileText, Pencil, Paperclip, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { ConfirmDialog } from "@/components/admin/core/confirm-dialog";
import { Modal } from "@/components/admin/core/modal";
import { Notice } from "@/components/admin/core/notice";
import { useToast } from "@/components/admin/core/toast";
import { call } from "@/components/admin/fees/fetch";
import { TransactionForm, type AccountOption, type TransactionFormValues } from "./transaction-form";
import { RECEIPT_ACCEPT, uploadReceipt } from "./receipt-upload";

export type ReceiptView = { id: string; fileName: string; sizeLabel: string; uploadedByName: string; createdLabel: string };

/** Schaltflächen der Buchung: bearbeiten, stornieren, Beleg hinzufügen. Gesperrte Aktionen erklären den Grund. */
export function TransactionActions({
  id,
  voucherNo,
  canWrite,
  accounts,
  initial,
  editBlock,
  reverseBlock,
  today,
  reverseNote,
}: {
  id: string;
  voucherNo: string;
  canWrite: boolean;
  accounts: AccountOption[];
  initial: TransactionFormValues;
  editBlock: string | null;
  reverseBlock: string | null;
  today: string;
  reverseNote?: string;
}) {
  const [edit, setEdit] = useState(false);
  const [reverse, setReverse] = useState(false);
  if (!canWrite) return null;
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" onClick={() => setEdit(true)} disabled={editBlock !== null}>
          <Pencil className="h-4 w-4" aria-hidden />
          Bearbeiten
        </Button>
        <Button type="button" variant="danger" onClick={() => setReverse(true)} disabled={reverseBlock !== null}>
          <Undo2 className="h-4 w-4" aria-hidden />
          Stornieren
        </Button>
      </div>
      {(editBlock || reverseBlock) && (
        <ul className="mt-3 space-y-1 text-sm text-zinc-400">
          {editBlock && <li>Bearbeiten nicht möglich: {editBlock}</li>}
          {reverseBlock && <li>Stornieren nicht möglich: {reverseBlock}</li>}
        </ul>
      )}
      {edit && (
        <Modal open onClose={() => setEdit(false)} title={`Buchung ${voucherNo} bearbeiten`} description="Änderungen stehen im Änderungsprotokoll." size="lg">
          <TransactionForm accounts={accounts} initial={initial} editId={id} onDone={() => setEdit(false)} onCancel={() => setEdit(false)} />
        </Modal>
      )}
      {reverse && <ReverseDialog id={id} voucherNo={voucherNo} today={today} note={reverseNote} onClose={() => setReverse(false)} />}
    </>
  );
}

function ReverseDialog({ id, voucherNo, today, note, onClose }: { id: string; voucherNo: string; today: string; note?: string; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const uid = useId();
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setFields({});
    const res = await call<{ id: string; voucherNo: string }>(`/api/admin/ledger/transactions/${encodeURIComponent(id)}/reverse`, "POST", { reason, bookingDate: date });
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      setFields(res.fields);
      return;
    }
    toast.success(`Buchung ${voucherNo} storniert. Gegenbuchung ${res.data.voucherNo}.`);
    onClose();
    router.refresh();
  }

  return (
    <Modal open onClose={() => !busy && onClose()} title={`Buchung ${voucherNo} stornieren`} description="Die Buchung bleibt erhalten. Eine Gegenbuchung hebt ihre Wirkung auf." size="md" dismissible={!busy}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <Notice variant="error">{error}</Notice>}
        {note && <Notice variant="warning">{note}</Notice>}
        <Field label="Grund" htmlFor={`${uid}-reason`} error={fields.reason} hint="Zum Beispiel «Doppelt gebucht» oder «Falscher Betrag». Der Grund steht im Protokoll.">
          <Input id={`${uid}-reason`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={150} required data-autofocus disabled={busy} aria-invalid={Boolean(fields.reason)} />
        </Field>
        <Field label="Datum der Gegenbuchung" htmlFor={`${uid}-date`} error={fields.bookingDate} hint="Sie muss in einem offenen Geschäftsjahr liegen.">
          <Input id={`${uid}-date`} type="date" value={date} onChange={(e) => setDate(e.target.value)} required disabled={busy} />
        </Field>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Abbrechen
          </Button>
          <Button type="submit" variant="danger" disabled={busy || reason.trim() === ""}>
            {busy ? "Bitte warten …" : "Buchung stornieren"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Belege einer Buchung: herunterladen, hinzufügen (mit Schreibrecht), entfernen (nur im offenen Geschäftsjahr). */
export function ReceiptPanel({
  transactionId,
  receipts,
  canWrite,
  removeBlock,
  maxReached,
}: {
  transactionId: string;
  receipts: ReceiptView[];
  canWrite: boolean;
  removeBlock: string | null;
  maxReached: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const uid = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState<ReceiptView | null>(null);

  async function upload(e: FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file || busy) {
      if (!file) setError("Bitte eine Datei wählen.");
      return;
    }
    setBusy(true);
    setError("");
    const problem = await uploadReceipt(transactionId, file);
    setBusy(false);
    if (problem) {
      setError(problem);
      return;
    }
    if (fileRef.current) fileRef.current.value = "";
    toast.success("Der Beleg wurde hinzugefügt.");
    router.refresh();
  }

  async function remove() {
    if (!removing || busy) return;
    setBusy(true);
    const res = await call<{ id: string }>(`/api/admin/ledger/receipts/${encodeURIComponent(removing.id)}`, "DELETE");
    setBusy(false);
    setRemoving(null);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success("Der Beleg wurde entfernt.");
    router.refresh();
  }

  return (
    <div>
      {receipts.length === 0 ? (
        <p className="text-sm text-zinc-400">Noch kein Beleg angehängt.</p>
      ) : (
        <ul className="divide-y divide-zinc-800 rounded-xl border border-zinc-800">
          {receipts.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <FileText className="h-5 w-5 shrink-0 text-zinc-500" aria-hidden />
                <div className="min-w-0">
                  <p className="break-all text-sm font-medium text-zinc-100">{r.fileName}</p>
                  <p className="text-xs text-zinc-500">
                    {r.sizeLabel} · hochgeladen von {r.uploadedByName || "unbekannt"} am {r.createdLabel}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <a href={`/api/admin/ledger/receipts/${encodeURIComponent(r.id)}`} download className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-semibold text-zinc-300 hover:bg-zinc-900 hover:text-white">
                  <Download className="h-4 w-4" aria-hidden />
                  Herunterladen
                  <span className="sr-only">: {r.fileName}</span>
                </a>
                {canWrite && removeBlock === null && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setRemoving(r)} disabled={busy}>
                    <Trash2 className="h-4 w-4" aria-hidden />
                    Entfernen
                    <span className="sr-only">: {r.fileName}</span>
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {canWrite && removeBlock && receipts.length > 0 && <p className="mt-2 text-xs text-zinc-500">{removeBlock}</p>}

      {canWrite &&
        (maxReached ? (
          <p className="mt-3 text-sm text-zinc-400">Die Höchstzahl an Belegen pro Buchung ist erreicht.</p>
        ) : (
          <form onSubmit={upload} className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end" noValidate>
            <div className="min-w-0 flex-1">
              <label htmlFor={`${uid}-file`} className="mb-1.5 block text-sm font-medium text-zinc-300">
                Beleg hinzufügen
              </label>
              <input
                id={`${uid}-file`}
                ref={fileRef}
                type="file"
                accept={RECEIPT_ACCEPT}
                disabled={busy}
                aria-describedby={`${uid}-hint`}
                className="block w-full text-sm text-zinc-300 file:mr-3 file:h-10 file:cursor-pointer file:rounded-lg file:border-0 file:bg-zinc-800 file:px-4 file:text-sm file:font-medium file:text-zinc-100 hover:file:bg-zinc-700"
              />
              <p id={`${uid}-hint`} className="mt-1 text-xs text-zinc-500">
                PDF, PNG, JPEG oder WebP, höchstens 5 MB.
              </p>
            </div>
            <Button type="submit" variant="secondary" disabled={busy}>
              <Paperclip className="h-4 w-4" aria-hidden />
              {busy ? "Lade hoch …" : "Hochladen"}
            </Button>
          </form>
        ))}
      {error && (
        <Notice variant="error" className="mt-3">
          {error}
        </Notice>
      )}

      <ConfirmDialog
        open={removing !== null}
        title="Beleg entfernen?"
        description={removing ? `Der Beleg «${removing.fileName}» wird von der Buchung entfernt. Das Entfernen steht im Änderungsprotokoll.` : ""}
        confirmLabel="Beleg entfernen"
        danger
        busy={busy}
        onConfirm={remove}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
}
