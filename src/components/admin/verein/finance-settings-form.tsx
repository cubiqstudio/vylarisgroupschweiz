"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Save, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { api } from "@/lib/api-client";
import { formatIban, isQrIban, isValidSwissIban, normalizeIban } from "@/lib/verein/iban";
import { parseChf, toDecimalString } from "@/lib/verein/money";
import type { VereinSettings } from "@/lib/verein/settings-schema";
import type { MissingSetting } from "@/lib/verein/settings-schema";
import { Notice } from "@/components/admin/core/notice";
import { useToast } from "@/components/admin/core/toast";
import { describeError } from "@/components/admin/settings/form-utils";
import { IntField, parseIntField, SettingsSection } from "./settings-parts";

export type FinanceSettings = Pick<
  VereinSettings,
  | "accountHolder"
  | "iban"
  | "qrIban"
  | "bank"
  | "paymentDays"
  | "reminderAfterDays"
  | "reminderDays1"
  | "reminderDays2"
  | "reminderDays3"
  | "reminderFee1Rappen"
  | "reminderFee2Rappen"
  | "reminderFee3Rappen"
>;

const str = (n: number | null) => (n === null ? "" : String(n));
const chf = (n: number | null) => (n === null ? "" : toDecimalString(n));

/** Live-Rückmeldung zur IBAN-Eingabe (Prüfsumme wird auf dem Server nochmals geprüft). */
function IbanState({ value, kind }: { value: string; kind: "iban" | "qr" }) {
  const v = normalizeIban(value);
  if (v === "") return null;
  const ok = kind === "qr" ? isQrIban(v) : isValidSwissIban(v) && !isQrIban(v);
  const text = ok
    ? `Gültig: ${formatIban(v)}`
    : kind === "qr"
      ? isValidSwissIban(v)
        ? "Das ist keine QR-IBAN (Institutskennung 30000–31999)."
        : "Keine gültige Schweizer IBAN."
      : isQrIban(v)
        ? "Das ist eine QR-IBAN. Trage sie im Feld «QR-IBAN» ein."
        : "Keine gültige Schweizer IBAN (CH oder LI, 21 Zeichen).";
  return (
    <p className={`flex items-center gap-1.5 text-xs ${ok ? "text-green-800" : "text-rose-400"}`} aria-live="polite">
      {ok ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> : <XCircle className="h-3.5 w-3.5" aria-hidden />}
      {text}
    </p>
  );
}

export function FinanceSettingsForm({ settings, missing, canWrite }: { settings: FinanceSettings; missing: MissingSetting[]; canWrite: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [holder, setHolder] = useState(settings.accountHolder);
  const [bank, setBank] = useState(settings.bank);
  const [iban, setIban] = useState(formatIban(settings.iban));
  const [qrIban, setQrIban] = useState(formatIban(settings.qrIban));
  const [paymentDays, setPaymentDays] = useState(str(settings.paymentDays));
  const [afterDays, setAfterDays] = useState(str(settings.reminderAfterDays));
  const [d1, setD1] = useState(str(settings.reminderDays1));
  const [d2, setD2] = useState(str(settings.reminderDays2));
  const [d3, setD3] = useState(str(settings.reminderDays3));
  const [f1, setF1] = useState(chf(settings.reminderFee1Rappen));
  const [f2, setF2] = useState(chf(settings.reminderFee2Rappen));
  const [f3, setF3] = useState(chf(settings.reminderFee3Rappen));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const dis = busy || !canWrite;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || !canWrite) return;
    setError(null);
    setFields({});
    const local: Record<string, string> = {};
    const days = (raw: string, key: string, label: string) => {
      const r = parseIntField(raw, label);
      if (r.error) local[key] = r.error;
      return r.value;
    };
    const fee = (raw: string, key: string, label: string): number | null => {
      if (raw.trim() === "") return null;
      const r = parseChf(raw);
      if (r === null || r < 0) {
        local[key] = `${label}: Bitte einen Betrag in CHF angeben, z. B. 10.00.`;
        return null;
      }
      return r;
    };
    const body = {
      accountHolder: holder.trim(),
      bank: bank.trim(),
      iban: normalizeIban(iban),
      qrIban: normalizeIban(qrIban),
      paymentDays: days(paymentDays, "paymentDays", "Zahlungsfrist"),
      reminderAfterDays: days(afterDays, "reminderAfterDays", "Tage bis zur 1. Mahnung"),
      reminderDays1: days(d1, "reminderDays1", "Frist 1. Mahnung"),
      reminderDays2: days(d2, "reminderDays2", "Frist 2. Mahnung"),
      reminderDays3: days(d3, "reminderDays3", "Frist 3. Mahnung"),
      reminderFee1Rappen: fee(f1, "reminderFee1Rappen", "Gebühr 1. Mahnung"),
      reminderFee2Rappen: fee(f2, "reminderFee2Rappen", "Gebühr 2. Mahnung"),
      reminderFee3Rappen: fee(f3, "reminderFee3Rappen", "Gebühr 3. Mahnung"),
    };
    if (Object.keys(local).length > 0) {
      setFields(local);
      setError("Bitte prüfe die markierten Felder.");
      return;
    }
    setBusy(true);
    try {
      await api("/api/admin/settings/verein/finanzen", { method: "PUT", body: { settings: body } });
      toast.success("Finanzeinstellungen gespeichert.");
      router.refresh();
    } catch (err) {
      const d = describeError(err, "Die Einstellungen konnten nicht gespeichert werden.");
      const flat: Record<string, string> = {};
      for (const [k, v] of Object.entries(d.fields)) flat[k.replace(/^settings\./, "")] = v;
      setFields(flat);
      setError(Object.keys(flat).length > 0 ? "Bitte prüfe die markierten Felder." : d.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid max-w-4xl gap-6">
      {!canWrite && <Notice variant="info">Du kannst die Einstellungen ansehen, aber nicht ändern. Änderungen nimmt der Kassier oder die Verwaltung vor.</Notice>}
      {error && <Notice variant="error">{error}</Notice>}
      {missing.length > 0 ? (
        <Notice variant="warning">
          <p className="font-medium">Für Rechnungen und Mahnungen fehlt noch:</p>
          <ul className="mt-1 list-disc pl-5">
            {missing.map((m) => (
              <li key={m.field}>{m.message}</li>
            ))}
          </ul>
        </Notice>
      ) : (
        <Notice variant="success">Konto, Zahlungsfrist und Mahnfristen sind vollständig. Rechnungen und Mahnungen sind freigeschaltet.</Notice>
      )}
      <Notice variant="info">
        Beträge, Fristen und Kontodaten trägt der Verein selbst ein. Es gibt keine Voreinstellungen: Die Statuten und Reglemente des Vereins gehen vor. Das ist keine Rechtsberatung.
      </Notice>

      <SettingsSection id="konto" title="Konto für Zahlungen" description="Die Angaben erscheinen auf Rechnungen und im QR-Einzahlungsschein. Währung: Schweizer Franken (CHF). Anschrift des Vereins: Einstellungen, Rechtliches (Impressum).">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Kontoinhaber" htmlFor="f-holder" error={fields.accountHolder} hint="Name des Vereins, wie er bei der Bank geführt wird.">
            <Input id="f-holder" value={holder} onChange={(e) => setHolder(e.target.value)} maxLength={70} disabled={dis} autoComplete="off" aria-invalid={fields.accountHolder ? true : undefined} />
          </Field>
          <Field label="Bank (optional)" htmlFor="f-bank" error={fields.bank}>
            <Input id="f-bank" value={bank} onChange={(e) => setBank(e.target.value)} maxLength={70} disabled={dis} autoComplete="off" aria-invalid={fields.bank ? true : undefined} />
          </Field>
          <Field label="IBAN" htmlFor="f-iban" error={fields.iban} hint="Schweizer IBAN (CH…), für Rechnungen mit Creditor Reference.">
            <Input id="f-iban" value={iban} onChange={(e) => setIban(e.target.value)} maxLength={34} disabled={dis} autoComplete="off" spellCheck={false} aria-invalid={fields.iban ? true : undefined} className="font-mono" />
            {!fields.iban && <IbanState value={iban} kind="iban" />}
          </Field>
          <Field label="QR-IBAN (optional)" htmlFor="f-qriban" error={fields.qrIban} hint="Nur, wenn die Bank eine QR-IBAN ausgestellt hat: Rechnungen erhalten dann eine QR-Referenz.">
            <Input id="f-qriban" value={qrIban} onChange={(e) => setQrIban(e.target.value)} maxLength={34} disabled={dis} autoComplete="off" spellCheck={false} aria-invalid={fields.qrIban ? true : undefined} className="font-mono" />
            {!fields.qrIban && <IbanState value={qrIban} kind="qr" />}
          </Field>
        </div>
      </SettingsSection>

      <SettingsSection id="frist" title="Zahlungsfrist" description="Die Frist, die auf neuen Rechnungen gilt. Sie lässt sich je Rechnung anpassen.">
        <IntField id="f-paydays" label="Zahlungsfrist" unit="Tage" value={paymentDays} onChange={setPaymentDays} error={fields.paymentDays} disabled={dis} hint="Tage ab Rechnungsdatum." />
      </SettingsSection>

      <SettingsSection id="mahnwesen" title="Mahnwesen" description="Ohne diese Angaben sind Mahnungen gesperrt. Gebühren nur eintragen, wenn der Verein sie vorsieht. Nicht festgelegte Gebühren gelten als 0.00.">
        <div className="grid gap-5 sm:grid-cols-2">
          <IntField id="f-after" label="1. Mahnung nach Fälligkeit" unit="Tage" value={afterDays} onChange={setAfterDays} error={fields.reminderAfterDays} disabled={dis} hint="Wie viele Tage nach Ablauf der Zahlungsfrist gemahnt werden darf." />
        </div>
        <div className="mt-5 grid gap-5 sm:grid-cols-3">
          <IntField id="f-d1" label="Frist 1. Mahnung" unit="Tage" value={d1} onChange={setD1} error={fields.reminderDays1} disabled={dis} />
          <IntField id="f-d2" label="Frist 2. Mahnung" unit="Tage" value={d2} onChange={setD2} error={fields.reminderDays2} disabled={dis} />
          <IntField id="f-d3" label="Frist 3. Mahnung" unit="Tage" value={d3} onChange={setD3} error={fields.reminderDays3} disabled={dis} />
          <IntField id="f-fee1" label="Gebühr 1. Mahnung" unit="CHF" value={f1} onChange={setF1} error={fields.reminderFee1Rappen} disabled={dis} placeholder="0.00" inputMode="decimal" />
          <IntField id="f-fee2" label="Gebühr 2. Mahnung" unit="CHF" value={f2} onChange={setF2} error={fields.reminderFee2Rappen} disabled={dis} placeholder="0.00" inputMode="decimal" />
          <IntField id="f-fee3" label="Gebühr 3. Mahnung" unit="CHF" value={f3} onChange={setF3} error={fields.reminderFee3Rappen} disabled={dis} placeholder="0.00" inputMode="decimal" />
        </div>
      </SettingsSection>

      {canWrite && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-zinc-400">Änderungen gelten sofort und stehen im Änderungsprotokoll.</p>
          <Button type="submit" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
            {busy ? "Speichern …" : "Speichern"}
          </Button>
        </div>
      )}
    </form>
  );
}
