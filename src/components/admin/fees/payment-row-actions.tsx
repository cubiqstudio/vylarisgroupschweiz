"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { BookCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/form";
import { ConfirmDialog } from "@/components/admin/core/confirm-dialog";
import { Modal } from "@/components/admin/core/modal";
import { Notice } from "@/components/admin/core/notice";
import { useToast } from "@/components/admin/core/toast";
import { call } from "./fetch";
import type { AccountOption } from "./payment-dialog";

/** Zahlung löschen bzw. nachbuchen. Löschen entfernt auch die Buchung (nur im offenen Geschäftsjahr). */
export function PaymentRowActions({
  id,
  label,
  booked,
  canWrite,
  canBook,
  accounts,
}: {
  id: string;
  label: string;
  booked: boolean;
  canWrite: boolean;
  canBook: boolean;
  accounts: { assets: AccountOption[]; incomes: AccountOption[] };
}) {
  const router = useRouter();
  const toast = useToast();
  const uid = useId();
  const [dialog, setDialog] = useState<null | "delete" | "book">(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [asset, setAsset] = useState(accounts.assets.length === 1 ? accounts.assets[0]!.id : "");
  const [income, setIncome] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});

  if (!canWrite) return null;

  async function remove() {
    setBusy(true);
    setError("");
    const res = await call(`/api/admin/fees/payments/${encodeURIComponent(id)}`, "DELETE");
    setBusy(false);
    if (!res.ok) return setError(res.message);
    toast.success("Zahlung gelöscht.");
    setDialog(null);
    router.refresh();
  }

  async function book(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setFields({});
    const res = await call<{ voucherNo: string }>(`/api/admin/fees/payments/${encodeURIComponent(id)}/book`, "POST", { assetAccountId: asset, incomeAccountId: income || null });
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      setFields(res.fields);
      return;
    }
    toast.success(`Zahlung gebucht (Beleg ${res.data.voucherNo}).`);
    setDialog(null);
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {!booked && canBook && (
          <Button type="button" variant="secondary" size="sm" onClick={() => setDialog("book")}>
            <BookCheck className="h-4 w-4" aria-hidden />
            Nachbuchen<span className="sr-only"> ({label})</span>
          </Button>
        )}
        <Button type="button" variant="danger" size="sm" onClick={() => setDialog("delete")}>
          <Trash2 className="h-4 w-4" aria-hidden />
          Löschen<span className="sr-only"> ({label})</span>
        </Button>
      </div>

      <ConfirmDialog
        open={dialog === "delete"}
        title="Zahlung löschen?"
        description={`Die Zahlung (${label}) wird samt ihrer Buchung entfernt und die Rechnung neu berechnet. Das wird im Änderungsprotokoll festgehalten.${error ? ` Fehler: ${error}` : ""}`}
        confirmLabel="Löschen"
        danger
        busy={busy}
        onConfirm={remove}
        onCancel={() => {
          setDialog(null);
          setError("");
        }}
      />

      <Modal open={dialog === "book"} onClose={() => !busy && setDialog(null)} title="Zahlung nachbuchen" description={`Zahlung ${label} in der Kasse als Einnahme buchen.`} size="sm" dismissible={!busy}>
        <form onSubmit={book} className="space-y-4">
          {error && <Notice variant="error">{error}</Notice>}
          <Field label="Eingegangen auf" htmlFor={`${uid}-asset`} error={fields.assetAccountId}>
            <Select id={`${uid}-asset`} value={asset} onChange={(e) => setAsset(e.target.value)} required data-autofocus>
              <option value="">Bitte wählen</option>
              {accounts.assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.number} {a.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Ertragskonto" htmlFor={`${uid}-income`} error={fields.incomeAccountId} hint="Leer lassen, wenn die Rechnung ein Ertragskonto vorgibt.">
            <Select id={`${uid}-income`} value={income} onChange={(e) => setIncome(e.target.value)}>
              <option value="">Gemäss Rechnung</option>
              {accounts.incomes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.number} {a.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setDialog(null)} disabled={busy}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={busy || !asset}>
              {busy ? "Bitte warten …" : "Buchen"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
