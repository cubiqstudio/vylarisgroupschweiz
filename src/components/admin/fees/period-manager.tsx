"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarRange, FilePlus2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { ConfirmDialog } from "@/components/admin/core/confirm-dialog";
import { Modal } from "@/components/admin/core/modal";
import { Notice } from "@/components/admin/core/notice";
import { useToast } from "@/components/admin/core/toast";
import { formatDateCh, toDateInputValue } from "@/lib/verein/dates";
import { formatChf, formatChfWithCurrency, toDecimalString } from "@/lib/verein/money";
import { call } from "./fetch";
import type { AccountOption } from "./payment-dialog";
import { Chf } from "./shared";

export type PeriodDTO = {
  id: string;
  year: number;
  label: string;
  startsOn: string;
  endsOn: string;
  invoicedAt: string | null;
  note: string;
  rates: Array<{ membershipTypeId: string; name: string; amountRappen: number }>;
  invoiceCount: number;
  invoicedRappen: number;
  paidRappen: number;
};
export type TypeDTO = { id: string; name: string; annualFeeRappen: number };

type RunResult = {
  dryRun: boolean;
  count: number;
  totalRappen: number;
  created: number;
  skipped: Array<{ reason: string; label: string; count: number }>;
  sample: Array<{ name: string; amountRappen: number; months: number | null }>;
};

export function PeriodManager({
  periods,
  types,
  incomes,
  canWrite,
  invoicingReady,
  suggestedYear,
}: {
  periods: PeriodDTO[];
  types: TypeDTO[];
  incomes: AccountOption[];
  canWrite: boolean;
  invoicingReady: boolean;
  suggestedYear: number;
}) {
  const [edit, setEdit] = useState<PeriodDTO | "new" | null>(null);
  const [run, setRun] = useState<PeriodDTO | null>(null);
  const [del, setDel] = useState<PeriodDTO | null>(null);

  return (
    <div className="space-y-4">
      {canWrite && (
        <div>
          <Button type="button" onClick={() => setEdit("new")}>
            <Plus className="h-4 w-4" aria-hidden />
            Beitragsjahr anlegen
          </Button>
        </div>
      )}
      {periods.length === 0 ? (
        <Card className="flex flex-col items-center px-6 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800/80 text-zinc-400 ring-1 ring-inset ring-zinc-700">
            <CalendarRange className="h-5 w-5" aria-hidden />
          </span>
          <h2 className="mt-4 text-lg font-semibold text-white">Noch kein Beitragsjahr</h2>
          <p className="mt-1.5 max-w-md text-sm text-zinc-400">Lege ein Beitragsjahr an, trage die Beiträge je Mitgliedschaftsart ein und erzeuge daraus die Rechnungen für alle aktiven Mitglieder.</p>
        </Card>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {periods.map((p) => (
            <li key={p.id}>
              <Card className="h-full p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-base font-semibold text-white">{p.label || `Mitgliederbeitrag ${p.year}`}</h2>
                    <p className="text-sm text-zinc-400">
                      Beitragsjahr {p.year} · {formatDateCh(new Date(p.startsOn))} bis {formatDateCh(new Date(p.endsOn))}
                    </p>
                  </div>
                  <p className="text-xs text-zinc-500">{p.invoicedAt ? `Rechnungslauf am ${formatDateCh(new Date(p.invoicedAt))}` : "Noch kein Rechnungslauf"}</p>
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-zinc-500">Rechnungen</dt>
                    <dd className="mt-0.5 tabular-nums text-zinc-200">{p.invoiceCount}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-zinc-500">Verrechnet</dt>
                    <dd className="mt-0.5 text-zinc-200">
                      <Chf rappen={p.invoicedRappen} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-zinc-500">Bezahlt</dt>
                    <dd className="mt-0.5 text-zinc-200">
                      <Chf rappen={p.paidRappen} />
                    </dd>
                  </div>
                </dl>
                <div className="mt-4">
                  <p className="text-xs font-medium text-zinc-500">Beitrag je Mitgliedschaftsart</p>
                  {p.rates.length === 0 ? (
                    <p className="mt-1 text-sm text-amber-300">Noch keine Beiträge festgelegt.</p>
                  ) : (
                    <ul className="mt-1 space-y-0.5 text-sm text-zinc-300">
                      {p.rates.map((r) => (
                        <li key={r.membershipTypeId} className="flex justify-between gap-3">
                          <span>{r.name}</span>
                          <span className="tabular-nums">CHF {formatChf(r.amountRappen)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {p.note && <p className="mt-3 whitespace-pre-line text-sm text-zinc-400">{p.note}</p>}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={`/admin/fees?tab=rechnungen&period=${encodeURIComponent(p.id)}`} className="inline-flex h-8 items-center rounded-md px-3 text-sm font-semibold text-zinc-300 hover:bg-zinc-900 hover:text-white">
                    Rechnungen ansehen
                  </Link>
                  {canWrite && (
                    <>
                      <Button type="button" size="sm" onClick={() => setRun(p)}>
                        <FilePlus2 className="h-4 w-4" aria-hidden />
                        Rechnungen erzeugen
                      </Button>
                      <Button type="button" size="sm" variant="secondary" onClick={() => setEdit(p)}>
                        <Pencil className="h-4 w-4" aria-hidden />
                        Bearbeiten<span className="sr-only"> ({p.year})</span>
                      </Button>
                      {p.invoiceCount === 0 && (
                        <Button type="button" size="sm" variant="danger" onClick={() => setDel(p)}>
                          <Trash2 className="h-4 w-4" aria-hidden />
                          Löschen<span className="sr-only"> ({p.year})</span>
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <PeriodDialog period={edit} types={types} suggestedYear={suggestedYear} onClose={() => setEdit(null)} />
      <RunDialog period={run} incomes={incomes} ready={invoicingReady} onClose={() => setRun(null)} />
      <DeleteDialog period={del} onClose={() => setDel(null)} />
    </div>
  );
}

function PeriodDialog({ period, types, suggestedYear, onClose }: { period: PeriodDTO | "new" | null; types: TypeDTO[]; suggestedYear: number; onClose: () => void }) {
  return (
    <Modal open={period !== null} onClose={onClose} title={period === "new" ? "Beitragsjahr anlegen" : "Beitragsjahr bearbeiten"} description="Die Beiträge je Mitgliedschaftsart legt der Verein fest (Statuten bzw. Beschluss der Mitgliederversammlung)." size="md">
      {period !== null && <PeriodForm key={period === "new" ? "new" : period.id} period={period} types={types} suggestedYear={suggestedYear} onClose={onClose} />}
    </Modal>
  );
}

function PeriodForm({ period, types, suggestedYear, onClose }: { period: PeriodDTO | "new"; types: TypeDTO[]; suggestedYear: number; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const uid = useId();
  const isNew = period === "new";
  const [year, setYear] = useState(String(isNew ? suggestedYear : period.year));
  const [label, setLabel] = useState(isNew ? "" : period.label);
  const [startsOn, setStartsOn] = useState(isNew ? "" : toDateInputValue(new Date(period.startsOn)));
  const [endsOn, setEndsOn] = useState(isNew ? "" : toDateInputValue(new Date(period.endsOn)));
  const [note, setNote] = useState(isNew ? "" : period.note);
  const [rates, setRates] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      types.map((t) => {
        const existing = isNew ? undefined : period.rates.find((r) => r.membershipTypeId === t.id);
        const rappen = existing ? existing.amountRappen : isNew && t.annualFeeRappen > 0 ? t.annualFeeRappen : null;
        return [t.id, rappen === null ? "" : toDecimalString(rappen)];
      }),
    ),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const locked = !isNew && period.invoiceCount > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setFields({});
    const rateList = types.filter((t) => rates[t.id]?.trim()).map((t) => ({ membershipTypeId: t.id, amount: rates[t.id]!.trim() }));
    const res = isNew
      ? await call("/api/admin/fees/periods", "POST", { year: Number.parseInt(year, 10), label, ...(startsOn ? { startsOn } : {}), ...(endsOn ? { endsOn } : {}), note, rates: rateList })
      : await call(`/api/admin/fees/periods/${encodeURIComponent(period.id)}`, "PATCH", { label, ...(locked ? {} : { startsOn, endsOn }), note, rates: rateList });
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      setFields(res.fields);
      return;
    }
    toast.success(isNew ? "Beitragsjahr angelegt." : "Beitragsjahr gespeichert.");
    onClose();
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error && <Notice variant="error">{error}</Notice>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Beitragsjahr" htmlFor={`${uid}-year`} error={fields.year}>
          <Input id={`${uid}-year`} type="number" min={2000} max={2100} value={year} onChange={(e) => setYear(e.target.value)} disabled={!isNew} required data-autofocus={isNew || undefined} />
        </Field>
        <Field label="Bezeichnung (optional)" htmlFor={`${uid}-label`} error={fields.label}>
          <Input id={`${uid}-label`} value={label} onChange={(e) => setLabel(e.target.value)} maxLength={100} placeholder={`Mitgliederbeitrag ${year}`} />
        </Field>
        <Field label="Beginn" htmlFor={`${uid}-start`} error={fields.startsOn} hint={isNew ? "Leer = Beginn des Geschäftsjahres gemäss Einstellungen." : locked ? "Mit Rechnungen nicht mehr änderbar." : undefined}>
          <Input id={`${uid}-start`} type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} disabled={locked} />
        </Field>
        <Field label="Ende" htmlFor={`${uid}-end`} error={fields.endsOn}>
          <Input id={`${uid}-end`} type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} disabled={locked} />
        </Field>
      </div>
      <fieldset className="space-y-3 rounded-lg border border-zinc-800 p-3">
        <legend className="px-1 text-sm font-medium text-zinc-300">Jahresbeitrag in CHF</legend>
        {types.length === 0 ? (
          <p className="text-sm text-zinc-400">Es gibt noch keine Mitgliedschaftsarten. Lege sie unter Mitglieder an.</p>
        ) : (
          types.map((t) => (
            <Field key={t.id} label={t.name} htmlFor={`${uid}-r-${t.id}`} error={fields.rates} hint={t.annualFeeRappen > 0 ? `Standard laut Mitgliedschaftsart: ${formatChfWithCurrency(t.annualFeeRappen)}` : "Leer lassen, wenn kein Beitrag erhoben wird."}>
              <Input id={`${uid}-r-${t.id}`} inputMode="decimal" value={rates[t.id] ?? ""} onChange={(e) => setRates((prev) => ({ ...prev, [t.id]: e.target.value }))} placeholder="0.00" />
            </Field>
          ))
        )}
      </fieldset>
      <Field label="Notiz (optional)" htmlFor={`${uid}-note`} error={fields.note} hint="Z. B. Beschluss der Mitgliederversammlung zum Beitrag.">
        <Textarea id={`${uid}-note`} value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000} />
      </Field>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
          Abbrechen
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Bitte warten …" : "Speichern"}
        </Button>
      </div>
    </form>
  );
}

function RunDialog({ period, incomes, ready, onClose }: { period: PeriodDTO | null; incomes: AccountOption[]; ready: boolean; onClose: () => void }) {
  return (
    <Modal open={period !== null} onClose={onClose} title={period ? `Rechnungen für ${period.year} erzeugen` : "Rechnungen erzeugen"} description="Für alle aktiven Mitglieder wird eine Rechnung als Entwurf angelegt. Versendet wird erst danach." size="lg">
      {period && <RunForm key={period.id} period={period} incomes={incomes} ready={ready} onClose={onClose} />}
    </Modal>
  );
}

function RunForm({ period, incomes, ready, onClose }: { period: PeriodDTO; incomes: AccountOption[]; ready: boolean; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const uid = useId();
  const [prorate, setProrate] = useState(false);
  const [roundToFive, setRoundToFive] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [preview, setPreview] = useState<RunResult | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const body = (dryRun: boolean) => ({ dryRun, prorate, roundToFive, categoryId: categoryId || null });

  async function calculate() {
    setBusy(true);
    setError("");
    const res = await call<RunResult>(`/api/admin/fees/periods/${encodeURIComponent(period.id)}/run`, "POST", body(true));
    setBusy(false);
    if (!res.ok) return setError(res.message);
    setPreview(res.data);
  }

  async function create() {
    setBusy(true);
    setError("");
    const res = await call<RunResult>(`/api/admin/fees/periods/${encodeURIComponent(period.id)}/run`, "POST", body(false));
    setBusy(false);
    setConfirm(false);
    if (!res.ok) return setError(res.message);
    toast.success(`${res.data.created} ${res.data.created === 1 ? "Rechnung" : "Rechnungen"} als Entwurf erstellt (CHF ${formatChf(res.data.totalRappen)}).`);
    onClose();
    router.push(`/admin/fees?tab=rechnungen&period=${encodeURIComponent(period.id)}&status=ENTWURF`);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {error && <Notice variant="error">{error}</Notice>}
      {!ready && <Notice variant="warning">Zum Erzeugen fehlen Angaben in den Vereinseinstellungen (Konto und Zahlungsfrist). Die Vorschau funktioniert trotzdem.</Notice>}
      <fieldset className="space-y-3 rounded-lg border border-zinc-800 p-3" onChange={() => setPreview(null)}>
        <legend className="px-1 text-sm font-medium text-zinc-300">Optionen</legend>
        <label className="flex items-start gap-2 text-sm text-zinc-300">
          <input type="checkbox" checked={prorate} onChange={(e) => setProrate(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-zinc-600 accent-emerald-500" />
          <span>
            Im Eintrittsjahr anteilig verrechnen
            <span className="block text-xs text-zinc-500">Der Eintrittsmonat zählt voll. Ob und wie anteilig verrechnet wird, bestimmen die Statuten bzw. der Vorstand.</span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm text-zinc-300">
          <input type="checkbox" checked={roundToFive} onChange={(e) => setRoundToFive(e.target.checked)} disabled={!prorate} className="mt-0.5 h-4 w-4 rounded border-zinc-600 accent-emerald-500" />
          <span>Anteilige Beträge auf 5 Rappen runden</span>
        </label>
        {incomes.length > 0 && (
          <Field label="Ertragskonto der Beiträge" htmlFor={`${uid}-cat`} hint="Damit lassen sich Zahlungen später automatisch richtig buchen.">
            <Select id={`${uid}-cat`} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Beim Buchen der Zahlung wählen</option>
              {incomes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.number} {a.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </fieldset>

      {preview && (
        <div className="space-y-3 rounded-lg border border-zinc-800 p-3" aria-live="polite">
          <p className="text-sm text-zinc-200">
            <span className="font-semibold text-white">{preview.count}</span> {preview.count === 1 ? "Rechnung" : "Rechnungen"} über insgesamt <span className="font-semibold text-white">CHF {formatChf(preview.totalRappen)}</span>
          </p>
          {preview.sample.length > 0 && (
            <ul className="text-sm text-zinc-400">
              {preview.sample.map((s, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span>
                    {s.name}
                    {s.months !== null && s.months < 12 ? ` (${s.months} Mt.)` : ""}
                  </span>
                  <span className="tabular-nums">CHF {formatChf(s.amountRappen)}</span>
                </li>
              ))}
              {preview.count > preview.sample.length && <li className="text-xs text-zinc-500">… und {preview.count - preview.sample.length} weitere</li>}
            </ul>
          )}
          {preview.skipped.length > 0 && (
            <div>
              <p className="text-xs font-medium text-zinc-500">Übersprungen</p>
              <ul className="mt-1 space-y-0.5 text-sm text-zinc-400">
                {preview.skipped.map((s) => (
                  <li key={s.reason}>
                    {s.count} × {s.label}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
          Abbrechen
        </Button>
        <Button type="button" variant="secondary" onClick={calculate} disabled={busy}>
          {busy && !confirm ? "Rechne …" : "Vorschau berechnen"}
        </Button>
        <Button type="button" onClick={() => setConfirm(true)} disabled={busy || !ready || !preview || preview.count === 0}>
          Als Entwürfe erstellen
        </Button>
      </div>

      <ConfirmDialog
        open={confirm}
        title={`${preview?.count ?? 0} Rechnungen erstellen?`}
        description={`Für das Beitragsjahr ${period.year} werden ${preview?.count ?? 0} Entwürfe über CHF ${formatChf(preview?.totalRappen ?? 0)} angelegt. Jede Rechnung bekommt eine fortlaufende Nummer. Versendet wird noch nichts.`}
        confirmLabel="Erstellen"
        busy={busy}
        onConfirm={create}
        onCancel={() => setConfirm(false)}
      />
    </div>
  );
}

function DeleteDialog({ period, onClose }: { period: PeriodDTO | null; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function remove() {
    if (!period) return;
    setBusy(true);
    const res = await call(`/api/admin/fees/periods/${encodeURIComponent(period.id)}`, "DELETE");
    setBusy(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success("Beitragsjahr gelöscht.");
    onClose();
    router.refresh();
  }
  return <ConfirmDialog open={period !== null} title="Beitragsjahr löschen?" description={period ? `Das Beitragsjahr ${period.year} mit seinen Beiträgen wird gelöscht. Es bestehen keine Rechnungen dazu.` : ""} confirmLabel="Löschen" danger busy={busy} onConfirm={remove} onCancel={onClose} />;
}
