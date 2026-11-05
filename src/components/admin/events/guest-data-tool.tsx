"use client";

import { useState, type FormEvent } from "react";
import { Download, Search, Trash2 } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { api } from "@/lib/api-client";
import { ConfirmDialog } from "@/components/admin/core/confirm-dialog";
import { Notice } from "@/components/admin/core/notice";
import { useToast } from "@/components/admin/core/toast";
import { describeError } from "@/components/admin/settings/form-utils";

type Row = {
  id: string;
  eventId: string;
  eventTitle: string;
  startsAt: string;
  guestName: string;
  guestEmail: string;
  seats: number;
  statusLabel: string;
  note: string;
  createdAt: string;
};

const fmt = (iso: string) => new Intl.DateTimeFormat("de-CH", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Zurich" }).format(new Date(iso));

/** Auskunft und Löschung für Gäste: alle Anmeldungen zu einer E-Mail-Adresse über alle Anlässe. */
export function GuestDataTool({ canWrite, canExport }: { canWrite: boolean; canExport: boolean }) {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [searched, setSearched] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  async function search(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const data = await api<{ items: Row[] }>(`/api/admin/events/guests?email=${encodeURIComponent(email.trim())}`);
      setRows(data.items);
      setSearched(email.trim());
    } catch (err) {
      setRows([]);
      setSearched(null);
      setError(describeError(err, "Die Suche ist fehlgeschlagen.").message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (busy || !searched) return;
    setBusy(true);
    try {
      const res = await api<{ deleted: number }>("/api/admin/events/guests", { method: "DELETE", body: { email: searched } });
      toast.success(`${res.deleted} ${res.deleted === 1 ? "Anmeldung wurde" : "Anmeldungen wurden"} gelöscht.`);
      setRows([]);
      setSearched(null);
      setConfirm(false);
    } catch (err) {
      toast.error(describeError(err, "Löschen fehlgeschlagen.").message);
      setConfirm(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Notice variant="info">
        Gäste haben keine Mitgliedschaft; ihre Anmeldungen erscheinen deshalb nicht in der Auskunft über Mitglieder. Hier findest du alle Anmeldungen zu einer
        E-Mail-Adresse über alle Anlässe. Jede Auskunft und jede Löschung steht im Änderungsprotokoll (ohne Name und Adresse).
      </Notice>
      <form onSubmit={search} className="grid gap-2 sm:grid-cols-[1fr_auto]" role="search">
        <Field label="E-Mail-Adresse des Gastes" htmlFor="guest-email">
          <Input id="guest-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} required autoComplete="off" disabled={busy} />
        </Field>
        <div className="flex items-end">
          <Button type="submit" variant="secondary" disabled={busy || !email.trim()}>
            <Search className="h-4 w-4" aria-hidden />
            Suchen
          </Button>
        </div>
      </form>
      {error && <Notice variant="error">{error}</Notice>}
      {searched !== null && (
        <Card className="overflow-hidden">
          {rows.length === 0 ? (
            <p className="p-4 text-sm text-zinc-400">Zu dieser E-Mail-Adresse gibt es keine Gast-Anmeldungen.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[44rem] text-left text-sm">
                  <thead className="border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-500">
                    <tr>
                      {["Anlass", "Name", "Personen", "Status", "Bemerkung", "Angemeldet"].map((h) => (
                        <th key={h} scope="col" className="px-4 py-3 font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {rows.map((r) => (
                      <tr key={r.id} className="align-top">
                        <td className="px-4 py-3 text-zinc-200">
                          {r.eventTitle}
                          <div className="text-xs text-zinc-500">{fmt(r.startsAt)}</div>
                        </td>
                        <td className="px-4 py-3 text-zinc-300">{r.guestName || "–"}</td>
                        <td className="px-4 py-3 tabular-nums text-zinc-300">{r.seats}</td>
                        <td className="px-4 py-3 text-zinc-300">{r.statusLabel}</td>
                        <td className="px-4 py-3 text-zinc-400">{r.note || "–"}</td>
                        <td className="px-4 py-3 text-zinc-400">{fmt(r.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap gap-2 border-t border-zinc-800 p-4">
                {canExport && (
                  <a href={`/api/admin/events/guests?email=${encodeURIComponent(searched)}&format=csv`} className={buttonClass("secondary", "md")}>
                    <Download className="h-4 w-4" aria-hidden />
                    Auskunft als CSV
                  </a>
                )}
                {canWrite && (
                  <Button type="button" variant="danger" onClick={() => setConfirm(true)} disabled={busy}>
                    <Trash2 className="h-4 w-4" aria-hidden />
                    Alle {rows.length} löschen
                  </Button>
                )}
              </div>
            </>
          )}
        </Card>
      )}
      <ConfirmDialog
        open={confirm}
        danger
        busy={busy}
        title="Alle Anmeldungen dieses Gastes löschen?"
        description={`Es werden ${rows.length} ${rows.length === 1 ? "Anmeldung" : "Anmeldungen"} samt Name, E-Mail-Adresse und Bemerkung endgültig gelöscht. Frei werdende Plätze gehen an die Warteliste.`}
        confirmLabel="Endgültig löschen"
        onConfirm={remove}
        onCancel={() => setConfirm(false)}
      />
    </div>
  );
}
