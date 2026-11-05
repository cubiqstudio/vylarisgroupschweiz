"use client";

import { useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Notice } from "@/components/admin/core/notice";
import { useToast } from "@/components/admin/core/toast";
import { formatChf, parseChf } from "@/lib/verein/money";
import Link from "next/link";
import { call } from "./fetch";
import type { AccountOption, MemberOption } from "./payment-dialog";

export type FormItem = { description: string; quantity: string; unit: string; categoryId: string };
export type InvoiceFormInitial = { id?: string; memberId: string; subject: string; issueDate: string; dueDate: string; notes: string; items: FormItem[]; periodId?: string | null };

/** Rechnung (Entwurf) anlegen oder bearbeiten. Die Rechnungsnummer vergibt der Server beim Speichern. */
export function InvoiceForm({
  mode,
  members,
  incomes,
  initial,
  memberLocked = false,
}: {
  mode: "new" | "edit";
  members: MemberOption[];
  incomes: AccountOption[];
  initial: InvoiceFormInitial;
  memberLocked?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const uid = useId();
  const [memberId, setMemberId] = useState(initial.memberId);
  const [subject, setSubject] = useState(initial.subject);
  const [issueDate, setIssueDate] = useState(initial.issueDate);
  const [dueDate, setDueDate] = useState(initial.dueDate);
  const [notes, setNotes] = useState(initial.notes);
  const [items, setItems] = useState<FormItem[]>(initial.items.length ? initial.items : [{ description: "", quantity: "1", unit: "", categoryId: "" }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});

  const total = useMemo(() => {
    let sum = 0;
    for (const it of items) {
      const unit = parseChf(it.unit);
      const qty = Number.parseInt(it.quantity, 10);
      if (unit !== null && Number.isInteger(qty) && qty > 0) sum += unit * qty;
    }
    return sum;
  }, [items]);

  const setItem = (i: number, patch: Partial<FormItem>) => setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setFields({});
    const body = {
      ...(mode === "new" ? { memberId, periodId: initial.periodId ?? null } : {}),
      subject,
      issueDate,
      dueDate,
      notes,
      items: items.map((it) => ({ description: it.description, quantity: Number.parseInt(it.quantity, 10) || 0, unit: it.unit, categoryId: it.categoryId || null })),
    };
    const res = await call<{ id?: string; number?: string }>(
      mode === "new" ? "/api/admin/invoices" : `/api/admin/invoices/${encodeURIComponent(initial.id ?? "")}`,
      mode === "new" ? "POST" : "PATCH",
      body,
    );
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      setFields(res.fields);
      return;
    }
    const id = res.data.id ?? initial.id ?? "";
    toast.success(mode === "new" ? `Rechnung ${res.data.number ?? ""} als Entwurf gespeichert.` : "Entwurf gespeichert.");
    router.push(`/admin/fees/invoices/${encodeURIComponent(id)}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      {error && <Notice variant="error">{error}</Notice>}
      <Card className="space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Mitglied" htmlFor={`${uid}-member`} error={fields.memberId}>
            <Select id={`${uid}-member`} value={memberId} onChange={(e) => setMemberId(e.target.value)} disabled={mode === "edit" || memberLocked} required>
              <option value="">Bitte wählen</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Betreff (optional)" htmlFor={`${uid}-subject`} error={fields.subject}>
            <Input id={`${uid}-subject`} value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} placeholder="z. B. Mitgliederbeitrag 2026" />
          </Field>
          <Field label="Rechnungsdatum" htmlFor={`${uid}-issue`} error={fields.issueDate}>
            <Input id={`${uid}-issue`} type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} required />
          </Field>
          <Field label="Fällig am" htmlFor={`${uid}-due`} error={fields.dueDate}>
            <Input id={`${uid}-due`} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
          </Field>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-white">Positionen</h2>
        {fields.items && (
          <p role="alert" className="mt-2 text-xs text-rose-400">
            {fields.items}
          </p>
        )}
        <ul className="mt-3 space-y-4">
          {items.map((it, i) => (
            <li key={i} className="grid gap-3 rounded-lg border border-zinc-800 p-3 sm:grid-cols-[1fr_6rem_9rem]">
              <Field label={`Beschreibung ${i + 1}`} htmlFor={`${uid}-d${i}`} error={fields[`items.${i}.description`]} className="sm:col-span-3">
                <Input id={`${uid}-d${i}`} value={it.description} onChange={(e) => setItem(i, { description: e.target.value })} maxLength={200} required />
              </Field>
              <Field label="Menge" htmlFor={`${uid}-q${i}`} error={fields[`items.${i}.quantity`]}>
                <Input id={`${uid}-q${i}`} type="number" min={1} max={9999} step={1} inputMode="numeric" value={it.quantity} onChange={(e) => setItem(i, { quantity: e.target.value })} required />
              </Field>
              <Field label="Einzelpreis CHF" htmlFor={`${uid}-u${i}`} error={fields[`items.${i}.unit`]}>
                <Input id={`${uid}-u${i}`} inputMode="decimal" value={it.unit} onChange={(e) => setItem(i, { unit: e.target.value })} placeholder="0.00" required />
              </Field>
              {incomes.length > 0 && (
                <Field label="Ertragskonto" htmlFor={`${uid}-c${i}`} error={fields[`items.${i}.categoryId`]}>
                  <Select id={`${uid}-c${i}`} value={it.categoryId} onChange={(e) => setItem(i, { categoryId: e.target.value })}>
                    <option value="">Beim Buchen wählen</option>
                    {incomes.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.number} {a.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              {items.length > 1 && (
                <div className="flex items-end sm:col-span-3 sm:justify-end">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}>
                    <Trash2 className="h-4 w-4" aria-hidden />
                    Position {i + 1} entfernen
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <Button type="button" variant="secondary" size="sm" onClick={() => setItems((prev) => [...prev, { description: "", quantity: "1", unit: "", categoryId: "" }])} disabled={items.length >= 30}>
            <Plus className="h-4 w-4" aria-hidden />
            Position hinzufügen
          </Button>
          <p className="text-sm text-zinc-300" aria-live="polite">
            Total: <span className="font-semibold tabular-nums text-white">CHF {formatChf(total)}</span>
          </p>
        </div>
      </Card>

      <Card className="p-5">
        <Field label="Interne Notiz (optional)" htmlFor={`${uid}-notes`} error={fields.notes} hint="Erscheint nicht auf der Rechnung.">
          <Textarea id={`${uid}-notes`} value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={2000} />
        </Field>
      </Card>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Link href={mode === "edit" && initial.id ? `/admin/fees/invoices/${encodeURIComponent(initial.id)}` : "/admin/fees"} className={buttonClass("secondary", "md")}>
          Abbrechen
        </Link>
        <Button type="submit" disabled={busy || total <= 0 || (mode === "new" && !memberId)}>
          {busy ? "Bitte warten …" : "Als Entwurf speichern"}
        </Button>
      </div>
    </form>
  );
}

