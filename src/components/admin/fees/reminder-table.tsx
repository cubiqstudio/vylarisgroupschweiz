"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MailWarning, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { Modal } from "@/components/admin/core/modal";
import { Notice } from "@/components/admin/core/notice";
import { useToast } from "@/components/admin/core/toast";
import { REMINDER_LEVEL_LABEL } from "@/lib/verein/constants";
import { formatDateCh } from "@/lib/verein/dates";
import { formatChfWithCurrency, parseChf } from "@/lib/verein/money";
import { call } from "./fetch";
import { Chf, ReminderPill, TD, TH, TableWrap } from "./shared";

export type ReminderRowDTO = {
  id: string;
  number: string;
  recipientName: string;
  dueDate: string;
  openRappen: number;
  reminderLevel: number;
  daysOverdue: number;
  state: "NONE" | "NOT_DUE" | "WAITING" | "READY" | "FINAL";
  nextLevel: number | null;
  reason: string;
  hasEmail: boolean;
  lastReminder: { level: number; dueDate: string; sentAt: string | null; mailSent: boolean; mailError: string } | null;
};

type SendResult = { results: Array<{ id: string; number: string; ok: boolean; message: string }>; sent: number; failed: number };

/** Überfällige Rechnungen mit Mahnstufe. Mahnen kann man, wo die nächste Stufe fällig ist; die Fristen stammen aus den Einstellungen. */
export function ReminderTable({ rows, canWrite, remindersReady }: { rows: ReminderRowDTO[]; canWrite: boolean; remindersReady: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const uid = useId();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState(false);
  const [interest, setInterest] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState<SendResult | null>(null);

  const ready = useMemo(() => rows.filter((r) => r.state === "READY"), [rows]);
  const allSelected = ready.length > 0 && ready.every((r) => selected.has(r.id));
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const interestRappen = interest.trim() ? parseChf(interest) : null;
  const interestInvalid = interest.trim() !== "" && (interestRappen === null || interestRappen < 0);

  async function send() {
    setBusy(true);
    setError("");
    const res = await call<SendResult>("/api/admin/fees/reminders", "POST", { ids: [...selected], ...(selected.size === 1 && interestRappen ? { interest: interestRappen } : {}) });
    setBusy(false);
    if (!res.ok) return setError(res.message);
    setDialog(false);
    setSelected(new Set());
    setInterest("");
    if (res.data.failed === 0) toast.success(`${res.data.sent} ${res.data.sent === 1 ? "Mahnung" : "Mahnungen"} erstellt.`);
    setReport(res.data);
    router.refresh();
  }

  async function resend(id: string) {
    const res = await call<{ ok: boolean; message: string }>(`/api/admin/fees/reminders/${encodeURIComponent(id)}/resend`, "POST");
    if (!res.ok) return toast.error(res.message);
    if (res.data.ok) toast.success("Mahnung erneut per E-Mail versendet.");
    else toast.error(res.data.message);
    router.refresh();
  }

  if (rows.length === 0) {
    return (
      <Card className="flex flex-col items-center px-6 py-14 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800/80 text-zinc-400 ring-1 ring-inset ring-zinc-700">
          <MailWarning className="h-5 w-5" aria-hidden />
        </span>
        <h2 className="mt-4 text-lg font-semibold text-white">Keine überfälligen Rechnungen</h2>
        <p className="mt-1.5 max-w-sm text-sm text-zinc-400">Sobald eine offene Rechnung nach ihrer Fälligkeit unbezahlt bleibt, erscheint sie hier.</p>
      </Card>
    );
  }

  return (
    <>
      {canWrite && (
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <Button type="button" size="sm" disabled={selected.size === 0 || !remindersReady} onClick={() => setDialog(true)}>
            <MailWarning className="h-4 w-4" aria-hidden />
            {selected.size > 0 ? `${selected.size} ${selected.size === 1 ? "Mahnung" : "Mahnungen"} versenden` : "Mahnungen auswählen"}
          </Button>
          {!remindersReady && <span className="text-sm text-amber-300">Mahnungen sind gesperrt, bis die Fristen eingetragen sind.</span>}
        </div>
      )}
      <Card className="overflow-hidden">
        <TableWrap label="Überfällige Rechnungen">
          <table className="w-full min-w-[50rem]">
            <thead>
              <tr className="border-b border-zinc-800">
                {canWrite && (
                  <th className="w-10 px-4 py-2.5">
                    <input type="checkbox" aria-label="Alle fälligen Mahnungen auswählen" checked={allSelected} disabled={ready.length === 0 || !remindersReady} onChange={() => setSelected(allSelected ? new Set() : new Set(ready.map((r) => r.id)))} className="h-4 w-4 rounded border-zinc-600 accent-emerald-500" />
                  </th>
                )}
                <th className={TH}>Rechnung</th>
                <th className={TH}>Empfänger</th>
                <th className={TH}>Fällig</th>
                <th className={`${TH} text-right`}>Offen</th>
                <th className={TH}>Stufe</th>
                <th className={TH}>Nächster Schritt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {rows.map((r) => (
                <tr key={r.id}>
                  {canWrite && (
                    <td className="px-4 py-3">
                      {r.state === "READY" && (
                        <input type="checkbox" aria-label={`Rechnung ${r.number} mahnen`} checked={selected.has(r.id)} disabled={!remindersReady} onChange={() => toggle(r.id)} className="h-4 w-4 rounded border-zinc-600 accent-emerald-500" />
                      )}
                    </td>
                  )}
                  <td className={TD}>
                    <Link href={`/admin/fees/invoices/${encodeURIComponent(r.id)}`} className="font-medium text-white hover:underline">
                      {r.number}
                    </Link>
                  </td>
                  <td className={TD}>
                    {r.recipientName}
                    {!r.hasEmail && <span className="block text-xs text-amber-300">keine E-Mail: per Post</span>}
                  </td>
                  <td className={TD}>
                    {formatDateCh(new Date(r.dueDate))}
                    {r.daysOverdue > 0 && <span className="block text-xs text-rose-300">{r.daysOverdue} Tage überfällig</span>}
                  </td>
                  <td className={`${TD} text-right`}>
                    <Chf rappen={r.openRappen} />
                  </td>
                  <td className={TD}>{r.reminderLevel > 0 ? <ReminderPill level={r.reminderLevel} /> : <span className="text-zinc-500">{REMINDER_LEVEL_LABEL[0]}</span>}</td>
                  <td className={TD}>
                    {r.state === "READY" ? (
                      <span className="font-medium text-emerald-300">{r.nextLevel === 1 ? "Zahlungserinnerung" : `${r.nextLevel}. Mahnung`} möglich</span>
                    ) : (
                      <span className="text-zinc-400">{r.reason}</span>
                    )}
                    {r.lastReminder && (
                      <span className="mt-1 block text-xs text-zinc-500">
                        {r.lastReminder.level}. Mahnung, Frist bis {formatDateCh(new Date(r.lastReminder.dueDate))}
                        {r.lastReminder.mailSent ? ", per E-Mail zugestellt" : r.lastReminder.mailError ? `: ${r.lastReminder.mailError}` : ""}
                      </span>
                    )}
                    {canWrite && r.lastReminder && !r.lastReminder.mailSent && r.hasEmail && (
                      <Button type="button" variant="ghost" size="sm" className="mt-1" onClick={() => resend(r.id)}>
                        <RotateCw className="h-4 w-4" aria-hidden />
                        Erneut senden<span className="sr-only"> ({r.number})</span>
                      </Button>
                    )}
                    {r.lastReminder && !r.lastReminder.mailSent && !r.hasEmail && (
                      <Link href={`/admin/fees/invoices/${encodeURIComponent(r.id)}/print`} className="mt-1 inline-block text-xs font-medium text-emerald-400 hover:underline">
                        Rechnung drucken
                        <span className="sr-only"> ({r.number})</span>
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Card>

      <Modal open={dialog} onClose={() => !busy && setDialog(false)} title={`${selected.size} ${selected.size === 1 ? "Mahnung" : "Mahnungen"} versenden?`} description="Die nächste Mahnstufe wird erstellt, eine Mahngebühr gemäss Einstellungen als Position angefügt und die Mail versendet. Eine Mahnung ist eine Aufforderung des Vereins, keine gerichtliche Handlung." size="sm" dismissible={!busy}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!busy && !interestInvalid) void send();
          }}
          className="space-y-4"
        >
          {error && <Notice variant="error">{error}</Notice>}
          {selected.size === 1 && (
            <Field label="Verzugszins in CHF (optional)" htmlFor={`${uid}-interest`} error={interestInvalid ? "Bitte einen gültigen Betrag angeben." : undefined} hint="Nur eintragen, wenn die Statuten oder ein Beschluss des Vorstands einen Verzugszins vorsehen. Der Betrag wird als eigene Position angefügt.">
              <Input id={`${uid}-interest`} inputMode="decimal" value={interest} onChange={(e) => setInterest(e.target.value)} placeholder="0.00" />
            </Field>
          )}
          {interestRappen ? <p className="text-sm text-zinc-300">Zusätzlich: {formatChfWithCurrency(interestRappen)} Verzugszins</p> : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setDialog(false)} disabled={busy}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={busy || interestInvalid} data-autofocus>
              {busy ? "Bitte warten …" : "Mahnungen versenden"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={report !== null && report.failed > 0} onClose={() => setReport(null)} title="Mahnlauf abgeschlossen" description={report ? `${report.sent} erstellt, ${report.failed} nicht erstellt.` : undefined} size="md">
        <ul className="space-y-2 text-sm text-zinc-300">
          {report?.results
            .filter((r) => !r.ok)
            .map((r) => (
              <li key={r.id} className="rounded-lg border border-zinc-800 px-3 py-2">
                <span className="font-medium text-white">{r.number}</span>: {r.message}
              </li>
            ))}
        </ul>
        <div className="mt-4 flex justify-end">
          <Button type="button" variant="secondary" onClick={() => setReport(null)} data-autofocus>
            Schliessen
          </Button>
        </div>
      </Modal>
    </>
  );
}
