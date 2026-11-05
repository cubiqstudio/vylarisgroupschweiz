"use client";

import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Lock, LockOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Modal } from "@/components/admin/core/modal";
import { Notice } from "@/components/admin/core/notice";
import { useToast } from "@/components/admin/core/toast";
import { call } from "@/components/admin/fees/fetch";

type Mode = "lock" | "unlock" | "approve" | "unapprove";

/** Abschluss, Wiedereröffnung und Genehmigungsvermerk eines Geschäftsjahres. Die Rolle prüft der Server. */
export function FiscalYearActions({
  year,
  label,
  locked,
  approved,
  canClose,
  unbookedPayments,
  lockBlock,
  unlockBlock,
  today,
}: {
  year: number;
  label: string;
  locked: boolean;
  approved: boolean;
  canClose: boolean;
  unbookedPayments: number;
  lockBlock: string | null;
  unlockBlock: string | null;
  today: string;
}) {
  const [mode, setMode] = useState<Mode | null>(null);
  if (!canClose) return <span className="text-xs text-zinc-500">Nur mit Schreibrecht in der Kassa</span>;
  return (
    <>
      <div className="flex flex-wrap justify-end gap-1">
        {!locked && (
          <Button type="button" variant="secondary" size="sm" onClick={() => setMode("lock")} disabled={lockBlock !== null} title={lockBlock ?? undefined}>
            <Lock className="h-4 w-4" aria-hidden />
            Abschliessen
            <span className="sr-only"> {label}</span>
          </Button>
        )}
        {locked && !approved && (
          <Button type="button" variant="secondary" size="sm" onClick={() => setMode("approve")}>
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            Genehmigung vermerken
            <span className="sr-only"> {label}</span>
          </Button>
        )}
        {locked && approved && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setMode("unapprove")}>
            Genehmigung zurücknehmen
            <span className="sr-only"> {label}</span>
          </Button>
        )}
        {locked && (
          <Button type="button" variant="danger" size="sm" onClick={() => setMode("unlock")} disabled={unlockBlock !== null} title={unlockBlock ?? undefined}>
            <LockOpen className="h-4 w-4" aria-hidden />
            Wieder öffnen
            <span className="sr-only"> {label}</span>
          </Button>
        )}
      </div>
      {mode && <FiscalDialog mode={mode} year={year} label={label} unbookedPayments={unbookedPayments} today={today} onClose={() => setMode(null)} />}
    </>
  );
}

const TITLES: Record<Mode, string> = {
  lock: "Geschäftsjahr abschliessen",
  unlock: "Geschäftsjahr wieder öffnen",
  approve: "Genehmigung vermerken",
  unapprove: "Genehmigung zurücknehmen",
};

function FiscalDialog({ mode, year, label, unbookedPayments, today, onClose }: { mode: Mode; year: number; label: string; unbookedPayments: number; today: string; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const uid = useId();
  const [note, setNote] = useState("");
  const [date, setDate] = useState(today);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const needsConfirm = mode === "lock" && unbookedPayments > 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setFields({});
    const res = await call(`/api/admin/ledger/fiscal-years/${year}`, "POST", { action: mode, note, ...(mode === "approve" ? { date } : {}), confirmUnbooked: confirm });
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      setFields(res.fields);
      return;
    }
    toast.success(mode === "lock" ? `Das Geschäftsjahr ${label} ist abgeschlossen.` : mode === "unlock" ? `Das Geschäftsjahr ${label} ist wieder offen.` : mode === "approve" ? "Die Genehmigung wurde vermerkt." : "Die Genehmigung wurde zurückgenommen.");
    onClose();
    router.refresh();
  }

  return (
    <Modal open onClose={() => !busy && onClose()} title={`${TITLES[mode]} ${label}`} size="md" dismissible={!busy}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <Notice variant="error">{error}</Notice>}
        {mode === "lock" && (
          <Notice variant="info">
            Nach dem Abschluss lassen sich Buchungen dieses Jahres nicht mehr ändern oder entfernen. Korrekturen erfolgen mit einer Gegenbuchung im offenen Jahr. Die Wiedereröffnung ist möglich, wird aber im Änderungsprotokoll festgehalten.
          </Notice>
        )}
        {mode === "unlock" && <Notice variant="warning">Ein abgeschlossenes Jahr ist die Grundlage der Jahresrechnung und des Revisionsberichts. Öffne es nur, wenn es nötig ist, und halte den Grund fest.</Notice>}
        {needsConfirm && (
          <Notice variant="warning">
            {unbookedPayments === 1 ? "Eine Zahlung ist" : `${unbookedPayments} Zahlungen sind`} in diesem Jahr noch nicht in der Kassa gebucht. Buche sie unter «Beiträge» nach, sonst fehlen sie in der Jahresrechnung.
            <label className="mt-2 flex items-start gap-2">
              <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-zinc-600" />
              <span>Ich schliesse trotzdem ab.</span>
            </label>
          </Notice>
        )}
        {mode === "approve" && (
          <Field label="Datum der Genehmigung" htmlFor={`${uid}-date`} error={fields.date} hint="Zum Beispiel das Datum der Mitgliederversammlung, die die Jahresrechnung genehmigt hat. Was die Statuten dazu verlangen, legt der Verein fest.">
            <Input id={`${uid}-date`} type="date" value={date} onChange={(e) => setDate(e.target.value)} max={today} required disabled={busy} data-autofocus />
          </Field>
        )}
        {(mode === "lock" || mode === "unlock") && (
          <Field label={mode === "unlock" ? "Begründung (Pflicht)" : "Bemerkung (optional)"} htmlFor={`${uid}-note`} error={fields.note}>
            <Input id={`${uid}-note`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} required={mode === "unlock"} disabled={busy} data-autofocus />
          </Field>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Abbrechen
          </Button>
          <Button type="submit" variant={mode === "unlock" ? "danger" : "primary"} disabled={busy || (needsConfirm && !confirm) || (mode === "unlock" && note.trim() === "")}>
            {busy ? "Bitte warten …" : TITLES[mode]}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
