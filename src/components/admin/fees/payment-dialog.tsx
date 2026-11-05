"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { Modal } from "@/components/admin/core/modal";
import { Notice } from "@/components/admin/core/notice";
import { useToast } from "@/components/admin/core/toast";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABEL } from "@/lib/verein/constants";
import { toDateInputValue } from "@/lib/verein/dates";
import { formatChfWithCurrency, parseChf, toDecimalString } from "@/lib/verein/money";
import { call } from "./fetch";

export type AccountOption = { id: string; number: string; name: string };
export type PaymentTarget = { id: string; number: string; recipientName: string; openRappen: number; hasIncomeAccount: boolean };
export type MemberOption = { id: string; label: string };

type Result = {
  invoice: { number: string; status: string; openRappen: number; overpaidRappen: number } | null;
  booking: { status: "BOOKED"; voucherNo: string } | { status: "PENDING"; reason: string };
};

/** Zahlungseingang erfassen: zu einer Rechnung (Teil- und Überzahlung möglich) oder allgemein. Bucht in der Kassa, wenn Konten gewählt sind. */
export function PaymentDialog({
  open,
  onClose,
  invoice,
  accounts,
  members,
}: {
  open: boolean;
  onClose: () => void;
  invoice?: PaymentTarget;
  accounts: { assets: AccountOption[]; incomes: AccountOption[] };
  members?: MemberOption[];
}) {
  return (
    <Modal open={open} onClose={onClose} title="Zahlung erfassen" description={invoice ? `Rechnung ${invoice.number}, ${invoice.recipientName}` : "Zahlungseingang ohne Rechnung, z. B. eine Spende."} size="md">
      <PaymentForm invoice={invoice} accounts={accounts} members={members} onClose={onClose} />
    </Modal>
  );
}

function PaymentForm({ invoice, accounts, members, onClose }: { invoice?: PaymentTarget; accounts: { assets: AccountOption[]; incomes: AccountOption[] }; members?: MemberOption[]; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const uid = useId();
  const [amount, setAmount] = useState(invoice && invoice.openRappen > 0 ? toDecimalString(invoice.openRappen) : "");
  const [date, setDate] = useState(toDateInputValue(new Date()));
  const [method, setMethod] = useState<string>("UEBERWEISUNG");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [memberId, setMemberId] = useState("");
  const [asset, setAsset] = useState(accounts.assets.length === 1 ? accounts.assets[0]!.id : "");
  const [income, setIncome] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});

  const parsed = parseChf(amount);
  const over = invoice && parsed !== null && parsed > invoice.openRappen ? parsed - invoice.openRappen : 0;
  const part = invoice && parsed !== null && parsed > 0 && parsed < invoice.openRappen;
  const needIncome = asset !== "" && !(invoice?.hasIncomeAccount ?? false) && accounts.incomes.length > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setFields({});
    const url = invoice ? `/api/admin/invoices/${encodeURIComponent(invoice.id)}/payments` : "/api/admin/fees/payments";
    const res = await call<Result>(url, "POST", {
      receivedAt: date,
      amount,
      method,
      reference,
      note,
      ...(invoice ? {} : { memberId: memberId || null }),
      assetAccountId: asset || null,
      incomeAccountId: income || null,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      setFields(res.fields);
      return;
    }
    const r = res.data;
    const booking = r.booking.status === "BOOKED" ? ` Gebucht als ${r.booking.voucherNo}.` : " Noch nicht in der Kassa gebucht (nachbuchen unter «Zahlungen»).";
    if (r.invoice?.status === "BEZAHLT") toast.success(`Zahlung erfasst, Rechnung ${r.invoice.number} ist bezahlt.${r.invoice.overpaidRappen > 0 ? ` Überzahlung ${formatChfWithCurrency(r.invoice.overpaidRappen)}.` : ""}${booking}`);
    else toast.success(`Zahlung erfasst.${r.invoice ? ` Noch offen: ${formatChfWithCurrency(r.invoice.openRappen)}.` : ""}${booking}`);
    onClose();
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error && <Notice variant="error">{error}</Notice>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Betrag in CHF" htmlFor={`${uid}-amount`} error={fields.amount} hint={invoice ? `Offen: ${formatChfWithCurrency(invoice.openRappen)}` : undefined}>
          <Input id={`${uid}-amount`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required data-autofocus aria-invalid={Boolean(fields.amount)} />
        </Field>
        <Field label="Eingang am" htmlFor={`${uid}-date`} error={fields.receivedAt}>
          <Input id={`${uid}-date`} type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
      </div>
      {part && <Notice variant="info">Teilzahlung: Es bleiben {formatChfWithCurrency(invoice!.openRappen - (parsed ?? 0))} offen.</Notice>}
      {over > 0 && <Notice variant="warning">Der Betrag liegt {formatChfWithCurrency(over)} über dem offenen Betrag. Die Überzahlung wird festgehalten und ist später zu klären (z. B. Rückzahlung oder Anrechnung).</Notice>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Zahlungsart" htmlFor={`${uid}-method`}>
          <Select id={`${uid}-method`} value={method} onChange={(e) => setMethod(e.target.value)}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABEL[m]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Referenz (optional)" htmlFor={`${uid}-ref`} error={fields.reference}>
          <Input id={`${uid}-ref`} value={reference} onChange={(e) => setReference(e.target.value)} maxLength={100} />
        </Field>
      </div>
      {!invoice && members && (
        <Field label="Mitglied (optional)" htmlFor={`${uid}-member`} error={fields.memberId}>
          <Select id={`${uid}-member`} value={memberId} onChange={(e) => setMemberId(e.target.value)}>
            <option value="">Keinem Mitglied zugeordnet</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field label="Notiz (optional)" htmlFor={`${uid}-note`} error={fields.note}>
        <Input id={`${uid}-note`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
      </Field>

      <fieldset className="space-y-3 rounded-lg border border-zinc-800 p-3">
        <legend className="px-1 text-sm font-medium text-zinc-300">Buchung in der Kassa</legend>
        {accounts.assets.length === 0 ? (
          <p className="text-sm text-zinc-400">In der Kassa sind noch keine Vermögenskonten (Bank, Kasse) angelegt. Die Zahlung wird erfasst und kann später nachgebucht werden.</p>
        ) : (
          <>
            <Field label="Eingegangen auf" htmlFor={`${uid}-asset`} error={fields.assetAccountId}>
              <Select id={`${uid}-asset`} value={asset} onChange={(e) => setAsset(e.target.value)}>
                <option value="">Noch nicht buchen</option>
                {accounts.assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.number} {a.name}
                  </option>
                ))}
              </Select>
            </Field>
            {needIncome && (
              <Field label="Ertragskonto" htmlFor={`${uid}-income`} error={fields.incomeAccountId} hint="Die Rechnung gibt kein Ertragskonto vor.">
                <Select id={`${uid}-income`} value={income} onChange={(e) => setIncome(e.target.value)} required>
                  <option value="">Bitte wählen</option>
                  {accounts.incomes.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.number} {a.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </>
        )}
      </fieldset>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
          Abbrechen
        </Button>
        <Button type="submit" disabled={busy || parsed === null || parsed <= 0}>
          {busy ? "Bitte warten …" : over > 0 ? "Mit Überzahlung erfassen" : "Zahlung erfassen"}
        </Button>
      </div>
    </form>
  );
}
