"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { Notice } from "@/components/admin/core/notice";
import { useToast } from "@/components/admin/core/toast";
import { call } from "@/components/admin/fees/fetch";
import { TRANSACTION_DIRECTIONS, TRANSACTION_DIRECTION_LABEL, type TransactionDirection } from "@/lib/verein/constants";
import { parseChf } from "@/lib/verein/money";
import { RECEIPT_ACCEPT, uploadReceipt } from "./receipt-upload";

export type AccountOption = { id: string; kind: string; number: string; name: string; active: boolean };

export type TransactionFormValues = {
  bookingDate: string;
  direction: string;
  amount: string;
  categoryId: string;
  counterAccountId: string;
  text: string;
  voucherRef: string;
};

const LABELS: Record<string, { category: string; counter: string; counterHint: string }> = {
  EINNAHME: { category: "Einnahmenkonto", counter: "Eingegangen auf", counterHint: "Bank oder Kasse, auf die das Geld gegangen ist." },
  AUSGABE: { category: "Ausgabenkonto", counter: "Bezahlt von", counterHint: "Bank oder Kasse, von der bezahlt wurde." },
  UMBUCHUNG: { category: "Von (Quelle)", counter: "Nach (Ziel)", counterHint: "Verschiebung zwischen Vermögenskonten, z. B. Bargeld auf die Bank. Sie ändert das Ergebnis nicht." },
};

const KIND_FOR: Record<string, string> = { EINNAHME: "EINNAHMEN", AUSGABE: "AUSGABEN", UMBUCHUNG: "VERMOEGEN" };

/**
 * Formular für neue und bestehende Buchungen. Neu: mit optionalem Beleg und «Speichern und weitere erfassen».
 * Bearbeiten: die Buchungsart bleibt fest (für eine andere Art stornieren und neu erfassen).
 */
export function TransactionForm({
  accounts,
  initial,
  editId,
  onDone,
  onCancel,
}: {
  accounts: AccountOption[];
  initial: TransactionFormValues;
  editId?: string;
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const uid = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [v, setV] = useState<TransactionFormValues>(() => {
    const assets = accounts.filter((a) => a.kind === "VERMOEGEN" && a.active);
    return !editId && !initial.counterAccountId && assets.length === 1 ? { ...initial, counterAccountId: assets[0]!.id } : initial;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const set = <K extends keyof TransactionFormValues>(k: K, value: TransactionFormValues[K]) => setV((s) => ({ ...s, [k]: value }));
  const isEdit = Boolean(editId);

  const labels = LABELS[v.direction] ?? LABELS.EINNAHME!;
  const categories = accounts.filter((a) => a.kind === KIND_FOR[v.direction] && (a.active || a.id === initial.categoryId));
  const counters = accounts.filter((a) => a.kind === "VERMOEGEN" && (a.active || a.id === initial.counterAccountId) && !(v.direction === "UMBUCHUNG" && a.id === v.categoryId));
  const missing = categories.length === 0 || accounts.filter((a) => a.kind === "VERMOEGEN" && a.active).length === 0;
  const parsed = parseChf(v.amount);

  function changeDirection(direction: string) {
    setV((s) => ({ ...s, direction, categoryId: accounts.some((a) => a.id === s.categoryId && a.kind === KIND_FOR[direction]) ? s.categoryId : "" }));
  }

  async function submit(e: { preventDefault(): void }, again = false) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setFields({});
    const file = fileRef.current?.files?.[0];
    const body = { bookingDate: v.bookingDate, amount: v.amount, categoryId: v.categoryId, counterAccountId: v.counterAccountId, text: v.text, voucherRef: v.voucherRef };
    const res = isEdit
      ? await call<{ id: string }>(`/api/admin/ledger/transactions/${encodeURIComponent(editId!)}`, "PATCH", body)
      : await call<{ id: string; voucherNo: string }>("/api/admin/ledger/transactions", "POST", { ...body, direction: v.direction });
    if (!res.ok) {
      setBusy(false);
      setError(res.message);
      setFields(res.fields);
      return;
    }
    if (isEdit) {
      toast.success("Die Buchung wurde gespeichert.");
      setBusy(false);
      onDone?.();
      router.refresh();
      return;
    }
    const created = res.data as { id: string; voucherNo: string };
    let receiptNote = "";
    if (file) {
      const problem = await uploadReceipt(created.id, file);
      if (problem) receiptNote = ` Der Beleg konnte nicht angehängt werden: ${problem} Du kannst ihn in der Buchung nachreichen.`;
    }
    setBusy(false);
    if (receiptNote) toast.error(`Buchung ${created.voucherNo} gespeichert.${receiptNote}`);
    else toast.success(`Buchung ${created.voucherNo} gespeichert.`);
    if (again) {
      setV((s) => ({ ...s, amount: "", text: "", voucherRef: "" }));
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } else {
      router.push(`/admin/ledger/${created.id}`);
      router.refresh();
    }
  }

  return (
    <form onSubmit={(e) => submit(e)} className="space-y-5" noValidate>
      {error && <Notice variant="error">{error}</Notice>}

      <fieldset className="space-y-2" disabled={busy}>
        <legend className="text-sm font-medium text-zinc-300">Art der Buchung</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Art der Buchung">
          {TRANSACTION_DIRECTIONS.map((d) => (
            <label
              key={d}
              className={`inline-flex h-10 cursor-pointer items-center rounded-lg px-4 text-sm font-medium ring-1 ring-inset transition-colors focus-within:ring-2 focus-within:ring-emerald-400/50 ${
                v.direction === d ? "bg-zinc-800 text-white ring-zinc-600" : "bg-zinc-900/50 text-zinc-400 ring-zinc-800 hover:bg-zinc-900"
              } ${isEdit && v.direction !== d ? "pointer-events-none opacity-40" : ""}`}
            >
              <input type="radio" name={`${uid}-direction`} value={d} checked={v.direction === d} onChange={() => changeDirection(d)} disabled={isEdit} className="sr-only" />
              {TRANSACTION_DIRECTION_LABEL[d as TransactionDirection]}
            </label>
          ))}
        </div>
        {isEdit && <p className="text-xs text-zinc-500">Die Art lässt sich nicht ändern. Storniere die Buchung und erfasse sie neu.</p>}
      </fieldset>

      {missing && (
        <Notice variant="warning">
          Für diese Art fehlen Konten.{" "}
          <Link href="/admin/ledger/accounts" className="font-medium underline underline-offset-2">
            Konten anlegen
          </Link>{" "}
          (mindestens ein {v.direction === "UMBUCHUNG" ? "Vermögenskonto" : v.direction === "EINNAHME" ? "Einnahmenkonto" : "Ausgabenkonto"} und ein Vermögenskonto wie Bank oder Kasse).
        </Notice>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Datum" htmlFor={`${uid}-date`} error={fields.bookingDate}>
          <Input id={`${uid}-date`} type="date" value={v.bookingDate} onChange={(e) => set("bookingDate", e.target.value)} required disabled={busy} aria-invalid={Boolean(fields.bookingDate)} />
        </Field>
        <Field label="Betrag in CHF" htmlFor={`${uid}-amount`} error={fields.amount} hint="Zum Beispiel 120.50 oder 1’250.00">
          <Input id={`${uid}-amount`} inputMode="decimal" value={v.amount} onChange={(e) => set("amount", e.target.value)} required disabled={busy} aria-invalid={Boolean(fields.amount)} autoComplete="off" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={labels.category} htmlFor={`${uid}-cat`} error={fields.categoryId}>
          <Select id={`${uid}-cat`} value={v.categoryId} onChange={(e) => set("categoryId", e.target.value)} required disabled={busy} aria-invalid={Boolean(fields.categoryId)}>
            <option value="">Bitte wählen</option>
            {categories.map((a) => (
              <option key={a.id} value={a.id}>
                {a.number} {a.name}
                {a.active ? "" : " (inaktiv)"}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={labels.counter} htmlFor={`${uid}-counter`} error={fields.counterAccountId} hint={labels.counterHint}>
          <Select id={`${uid}-counter`} value={v.counterAccountId} onChange={(e) => set("counterAccountId", e.target.value)} required disabled={busy} aria-invalid={Boolean(fields.counterAccountId)}>
            <option value="">Bitte wählen</option>
            {counters.map((a) => (
              <option key={a.id} value={a.id}>
                {a.number} {a.name}
                {a.active ? "" : " (inaktiv)"}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Buchungstext" htmlFor={`${uid}-text`} error={fields.text} hint="Wofür oder von wem? Erscheint in der Kasse und im Kassenbericht.">
        <Input id={`${uid}-text`} value={v.text} onChange={(e) => set("text", e.target.value)} maxLength={200} required disabled={busy} aria-invalid={Boolean(fields.text)} />
      </Field>
      <Field label="Beleg-Referenz (optional)" htmlFor={`${uid}-ref`} error={fields.voucherRef} hint="Zum Beispiel die Rechnungsnummer der Lieferantin oder des Lieferanten.">
        <Input id={`${uid}-ref`} value={v.voucherRef} onChange={(e) => set("voucherRef", e.target.value)} maxLength={100} disabled={busy} />
      </Field>

      {!isEdit && (
        <Field label="Beleg als Datei (optional)" htmlFor={`${uid}-file`} error={fields.file} hint="PDF, PNG, JPEG oder WebP, höchstens 5 MB. Weitere Belege kannst du in der Buchung ergänzen.">
          <input
            id={`${uid}-file`}
            ref={fileRef}
            type="file"
            accept={RECEIPT_ACCEPT}
            disabled={busy}
            className="block w-full text-sm text-zinc-300 file:mr-3 file:h-10 file:cursor-pointer file:rounded-lg file:border-0 file:bg-zinc-800 file:px-4 file:text-sm file:font-medium file:text-zinc-100 hover:file:bg-zinc-700"
          />
        </Field>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel ? (
          <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
            Abbrechen
          </Button>
        ) : (
          <Link href="/admin/ledger" className="inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-semibold text-zinc-300 hover:bg-zinc-900 hover:text-white">
            Abbrechen
          </Link>
        )}
        {!isEdit && (
          <Button type="button" variant="secondary" disabled={busy || parsed === null || parsed <= 0} onClick={(e) => submit(e, true)}>
            Speichern und weitere erfassen
          </Button>
        )}
        <Button type="submit" disabled={busy || parsed === null || parsed <= 0}>
          {busy ? "Bitte warten …" : "Speichern"}
        </Button>
      </div>
    </form>
  );
}
