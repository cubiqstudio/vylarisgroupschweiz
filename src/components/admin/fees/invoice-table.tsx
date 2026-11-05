"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/admin/core/confirm-dialog";
import { Modal } from "@/components/admin/core/modal";
import { useToast } from "@/components/admin/core/toast";
import { formatDateCh } from "@/lib/verein/dates";
import { openAmount } from "@/lib/verein/money";
import { call } from "./fetch";
import { Chf, InvoiceStatusPill, ReminderPill, TD, TH, TableWrap } from "./shared";

export type InvoiceRowDTO = {
  id: string;
  number: string;
  status: string;
  recipientName: string;
  subject: string;
  issueDate: string;
  dueDate: string;
  totalRappen: number;
  paidRappen: number;
  reminderLevel: number;
  memberNumber: number;
};

type BulkResult = { results: Array<{ id: string; ok: boolean; number?: string; message: string }>; sent: number; failed: number };

/** Rechnungsliste mit Auswahl der Entwürfe zum gemeinsamen Versand. */
export function InvoiceTable({ rows, canWrite }: { rows: InvoiceRowDTO[]; canWrite: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<BulkResult | null>(null);

  const drafts = useMemo(() => rows.filter((r) => r.status === "ENTWURF"), [rows]);
  const allSelected = drafts.length > 0 && drafts.every((d) => selected.has(d.id));
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function sendSelected() {
    setBusy(true);
    const res = await call<BulkResult>("/api/admin/invoices/send", "POST", { ids: [...selected], channel: "MAIL" });
    setBusy(false);
    setConfirm(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    setSelected(new Set());
    if (res.data.failed === 0) toast.success(`${res.data.sent} ${res.data.sent === 1 ? "Rechnung" : "Rechnungen"} per E-Mail versendet.`);
    else setReport(res.data);
    router.refresh();
  }

  return (
    <>
      {canWrite && drafts.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <Button type="button" variant="secondary" size="sm" disabled={selected.size === 0 || busy} onClick={() => setConfirm(true)}>
            <Send className="h-4 w-4" aria-hidden />
            {selected.size > 0 ? `${selected.size} ${selected.size === 1 ? "Entwurf" : "Entwürfe"} per E-Mail versenden` : "Entwürfe auswählen zum Versenden"}
          </Button>
        </div>
      )}
      <Card className="overflow-hidden">
        <TableWrap label="Rechnungen">
          <table className="w-full min-w-[46rem]">
            <thead>
              <tr className="border-b border-zinc-800">
                {canWrite && drafts.length > 0 && (
                  <th className="w-10 px-4 py-2.5">
                    <input
                      type="checkbox"
                      aria-label="Alle Entwürfe auswählen"
                      checked={allSelected}
                      onChange={() => setSelected(allSelected ? new Set() : new Set(drafts.map((d) => d.id)))}
                      className="h-4 w-4 rounded border-zinc-600 accent-emerald-500"
                    />
                  </th>
                )}
                <th className={TH}>Rechnung</th>
                <th className={TH}>Empfänger</th>
                <th className={TH}>Fällig</th>
                <th className={`${TH} text-right`}>Betrag (CHF)</th>
                <th className={`${TH} text-right`}>Offen (CHF)</th>
                <th className={TH}>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {rows.map((r) => {
                const open = r.status === "OFFEN" ? openAmount(r.totalRappen, r.paidRappen) : 0;
                return (
                  <tr key={r.id} className="hover:bg-zinc-900/40">
                    {canWrite && drafts.length > 0 && (
                      <td className="px-4 py-3">
                        {r.status === "ENTWURF" && (
                          <input
                            type="checkbox"
                            aria-label={`Entwurf ${r.number} auswählen`}
                            checked={selected.has(r.id)}
                            onChange={() => toggle(r.id)}
                            className="h-4 w-4 rounded border-zinc-600 accent-emerald-500"
                          />
                        )}
                      </td>
                    )}
                    <td className={TD}>
                      <Link href={`/admin/fees/invoices/${encodeURIComponent(r.id)}`} className="font-medium text-white hover:underline">
                        {r.number}
                      </Link>
                      {r.subject && <span className="block max-w-[16rem] truncate text-xs text-zinc-500">{r.subject}</span>}
                    </td>
                    <td className={TD}>
                      {r.recipientName}
                      <span className="block text-xs text-zinc-500">Nr. {r.memberNumber}</span>
                    </td>
                    <td className={TD}>{formatDateCh(new Date(r.dueDate))}</td>
                    <td className={`${TD} text-right`}>
                      <Chf rappen={r.totalRappen} />
                    </td>
                    <td className={`${TD} text-right`}>{r.status === "OFFEN" ? <Chf rappen={open} /> : "–"}</td>
                    <td className={TD}>
                      <div className="flex flex-wrap gap-1">
                        <InvoiceStatusPill status={r.status} dueDate={r.dueDate} openRappen={open} />
                        <ReminderPill level={r.reminderLevel} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      </Card>

      <ConfirmDialog
        open={confirm}
        title={`${selected.size} ${selected.size === 1 ? "Rechnung" : "Rechnungen"} versenden?`}
        description="Die Rechnungen werden per E-Mail versendet und gelten danach als offen. Entwürfe ohne E-Mail-Adresse oder mit unvollständigen Angaben werden übersprungen und im Bericht aufgeführt."
        confirmLabel="Versenden"
        busy={busy}
        onConfirm={sendSelected}
        onCancel={() => setConfirm(false)}
      />
      <Modal open={report !== null} onClose={() => setReport(null)} title="Versand abgeschlossen" description={report ? `${report.sent} versendet, ${report.failed} nicht versendet.` : undefined} size="md">
        <ul className="space-y-2 text-sm">
          {report?.results
            .filter((r) => !r.ok)
            .map((r) => {
              const row = rows.find((x) => x.id === r.id);
              const label = row ? `${row.number}, ${row.recipientName}` : "Rechnung";
              return (
                <li key={r.id} className="rounded-lg border border-zinc-800 px-3 py-2 text-zinc-300">
                  <Link href={`/admin/fees/invoices/${encodeURIComponent(r.id)}`} className="font-medium text-white hover:underline" aria-label={row ? `Rechnung ${row.number} öffnen` : "Rechnung öffnen"}>
                    {label}
                  </Link>
                  : {r.message}
                </li>
              );
            })}
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
