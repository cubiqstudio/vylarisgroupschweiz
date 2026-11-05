"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Ban, Download, MailCheck, Pencil, RotateCcw, Trash2, UserCheck, UserPlus } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/form";
import { api, ApiClientError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/admin/core/confirm-dialog";
import { Modal } from "@/components/admin/core/modal";
import { Notice } from "@/components/admin/core/notice";
import { useToast } from "@/components/admin/core/toast";
import { MemberPicker, type PickedMember } from "@/components/admin/members/member-picker";
import { describeError } from "@/components/admin/settings/form-utils";

export type RegistrationDTO = {
  id: string;
  name: string;
  isMember: boolean;
  memberNumber: number | null;
  email: string;
  seats: number;
  status: string;
  note: string;
  /** vorformatiert, z. B. «5.11.2026» */
  createdAt: string;
  attended: boolean;
  promoted: boolean;
  reminded: boolean;
  /** nur bei unbestätigten Gästen: vorformatiert, bis wann der Link gilt und danach gelöscht wird */
  confirmBy: string | null;
};

type Props = {
  eventId: string;
  eventTitle: string;
  capacity: number | null;
  cancelled: boolean;
  canWrite: boolean;
  canExport: boolean;
  registrations: RegistrationDTO[];
};

type Pending = { kind: "cancel" | "delete" | "confirm" | "force-promote" | "force-restore"; reg: RegistrationDTO } | null;

/** Anmeldungen eines Anlasses: Liste mit Warteliste und Gästen ohne bestätigte E-Mail-Adresse, von Hand hinzufügen und bestätigen, absagen, nachrücken, Anwesenheit abhaken, CSV-Export. */
export function RegistrationManager({ eventId, eventTitle, capacity, cancelled, canWrite, canExport, registrations }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState<Pending>(null);
  const [sendMail, setSendMail] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<RegistrationDTO | null>(null);
  const [onlyUnconfirmed, setOnlyUnconfirmed] = useState(false);

  const base = `/api/admin/events/${encodeURIComponent(eventId)}/registrations`;
  const active = registrations.filter((r) => r.status === "ANGEMELDET");
  const waiting = registrations.filter((r) => r.status === "WARTELISTE");
  const unconfirmed = registrations.filter((r) => r.status === "UNBESTAETIGT");
  const ended = registrations.filter((r) => r.status === "ABGESAGT");
  const taken = active.reduce((s, r) => s + r.seats, 0);
  const waitingSeats = waiting.reduce((s, r) => s + r.seats, 0);
  const unconfirmedSeats = unconfirmed.reduce((s, r) => s + r.seats, 0);
  const showUnconfirmedOnly = onlyUnconfirmed && unconfirmed.length > 0;
  const attended = active.filter((r) => r.attended).reduce((s, r) => s + r.seats, 0);

  async function act(reg: RegistrationDTO, body: Record<string, unknown>, success: string, onNoCapacity?: () => void): Promise<boolean> {
    if (busy) return false;
    setBusy(reg.id);
    try {
      await api(`${base}/${encodeURIComponent(reg.id)}`, { method: "PATCH", body });
      if (success) toast.success(success);
      setPending(null);
      router.refresh();
      return true;
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "NO_CAPACITY" && onNoCapacity) {
        onNoCapacity();
      } else {
        toast.error(describeError(err, "Die Aktion ist fehlgeschlagen.").message);
        setPending(null);
      }
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function remove(reg: RegistrationDTO) {
    if (busy) return;
    setBusy(reg.id);
    try {
      await api(`${base}/${encodeURIComponent(reg.id)}`, { method: "DELETE" });
      toast.success("Die Anmeldung wurde gelöscht.");
      setPending(null);
      router.refresh();
    } catch (err) {
      toast.error(describeError(err, "Löschen fehlgeschlagen.").message);
      setPending(null);
    } finally {
      setBusy(null);
    }
  }

  const headers = ["Name", "Personen", "Bemerkung", "Angemeldet"];

  function renderTable(rows: RegistrationDTO[], kind: "active" | "waiting" | "unconfirmed" | "ended") {
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              {kind === "active" && (
                <th scope="col" className="w-24 px-4 py-3 font-medium">
                  Anwesend
                </th>
              )}
              {headers.map((h) => (
                <th key={h} scope="col" className="px-4 py-3 font-medium">
                  {h}
                </th>
              ))}
              {canWrite && (
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  <span className="sr-only">Aktionen</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {rows.map((r, i) => (
              <tr key={r.id} className="align-top hover:bg-zinc-900/40">
                {kind === "active" && (
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={r.attended}
                      disabled={!canWrite || busy === r.id || cancelled}
                      onChange={(e) => act(r, { action: "attendance", attended: e.target.checked }, "")}
                      aria-label={`${r.name} war anwesend`}
                      className="size-4 accent-emerald-400"
                    />
                  </td>
                )}
                <td className="px-4 py-3">
                  <div className="font-medium text-white">
                    {kind === "waiting" && <span className="mr-2 text-xs font-normal tabular-nums text-zinc-500">{i + 1}.</span>}
                    {r.name}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {r.isMember ? `Mitglied Nr. ${r.memberNumber ?? "–"}` : "Gast"}
                    {r.email && <span className="break-all"> · {r.email}</span>}
                    {r.confirmBy && ` · wird gelöscht, falls bis ${r.confirmBy} nicht bestätigt`}
                    {r.promoted && " · nachgerückt"}
                    {r.reminded && " · erinnert"}
                  </div>
                </td>
                <td className="px-4 py-3 tabular-nums text-zinc-300">{r.seats}</td>
                <td className="max-w-64 break-words px-4 py-3 text-zinc-400">{r.note || <span className="text-zinc-600">–</span>}</td>
                <td className="whitespace-nowrap px-4 py-3 tabular-nums text-zinc-400">{r.createdAt}</td>
                {canWrite && (
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {kind === "waiting" && (
                        <Button type="button" size="sm" variant="secondary" disabled={busy === r.id} onClick={() => act(r, { action: "promote", force: false }, `${r.name} ist jetzt angemeldet.`, () => setPending({ kind: "force-promote", reg: r }))}>
                          <UserCheck className="h-4 w-4" aria-hidden />
                          Anmelden
                          <span className="sr-only"> ({r.name})</span>
                        </Button>
                      )}
                      {kind === "unconfirmed" && (
                        <Button type="button" size="sm" variant="secondary" disabled={busy === r.id || cancelled} onClick={() => setPending({ kind: "confirm", reg: r })}>
                          <MailCheck className="h-4 w-4" aria-hidden />
                          Von Hand bestätigen
                          <span className="sr-only"> ({r.name})</span>
                        </Button>
                      )}
                      {kind === "ended" ? (
                        <Button type="button" size="sm" variant="secondary" disabled={busy === r.id || cancelled} onClick={() => act(r, { action: "restore", force: false }, `Die Anmeldung von ${r.name} ist wiederhergestellt.`, () => setPending({ kind: "force-restore", reg: r }))}>
                          <RotateCcw className="h-4 w-4" aria-hidden />
                          Wiederherstellen
                          <span className="sr-only"> ({r.name})</span>
                        </Button>
                      ) : (
                        <>
                          <Button type="button" size="sm" variant="secondary" disabled={busy === r.id} onClick={() => setEditing(r)}>
                            <Pencil className="h-4 w-4" aria-hidden />
                            Ändern
                            <span className="sr-only"> ({r.name})</span>
                          </Button>
                          {kind !== "unconfirmed" && (
                            <Button type="button" size="sm" variant="secondary" disabled={busy === r.id} onClick={() => setPending({ kind: "cancel", reg: r })}>
                              <Ban className="h-4 w-4" aria-hidden />
                              Absagen
                              <span className="sr-only"> ({r.name})</span>
                            </Button>
                          )}
                        </>
                      )}
                      <Button type="button" size="sm" variant="danger" disabled={busy === r.id} onClick={() => setPending({ kind: "delete", reg: r })}>
                        <Trash2 className="h-4 w-4" aria-hidden />
                        Löschen
                        <span className="sr-only"> ({r.name})</span>
                      </Button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const p = pending;
  return (
    <section aria-labelledby="registrations-heading" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="registrations-heading" className="text-base font-semibold text-white">
            Anmeldungen
          </h2>
          <p className="mt-1 text-sm text-zinc-400" aria-live="polite">
            {capacity === null ? `${taken} ${taken === 1 ? "Person" : "Personen"} angemeldet (unbegrenzt)` : `${taken} von ${capacity} Plätzen belegt`}
            {waitingSeats > 0 && ` · ${waitingSeats} ${waitingSeats === 1 ? "Person" : "Personen"} auf der Warteliste`}
            {unconfirmed.length > 0 && ` · ${unconfirmed.length} ${unconfirmed.length === 1 ? "Anmeldung" : "Anmeldungen"} mit noch nicht bestätigter E-Mail-Adresse (ohne Platz)`}
            {attended > 0 && ` · ${attended} anwesend`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canExport && (
            <a href={`${base}/export`} className={buttonClass("secondary", "md")} download>
              <Download className="h-4 w-4" aria-hidden />
              CSV-Export
              <span className="sr-only"> der Teilnehmerliste</span>
            </a>
          )}
          {canWrite && !cancelled && (
            <Button type="button" onClick={() => setAdding(true)}>
              <UserPlus className="h-4 w-4" aria-hidden />
              Person hinzufügen
            </Button>
          )}
        </div>
      </div>

      {unconfirmed.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <button
            type="button"
            aria-pressed={showUnconfirmedOnly}
            onClick={() => setOnlyUnconfirmed((v) => !v)}
            className={cn("inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium ring-1 ring-inset", showUnconfirmedOnly ? "bg-zinc-900 text-white ring-zinc-700" : "text-zinc-400 ring-zinc-800 hover:text-zinc-100")}
          >
            E-Mail noch nicht bestätigt ({unconfirmed.length})
          </button>
          {showUnconfirmedOnly && <span className="text-xs text-zinc-500">Nur diese Anmeldungen werden angezeigt. Nochmals klicken zeigt alle.</span>}
        </div>
      )}

      {capacity !== null && taken > capacity && <Notice variant="warning">Der Anlass ist überbucht ({taken} Personen bei {capacity} Plätzen).</Notice>}

      {registrations.length === 0 ? (
        <Card className="px-6 py-10 text-center">
          <h3 className="text-base font-semibold text-white">Noch keine Anmeldungen</h3>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-zinc-400">{cancelled ? "Der Anlass ist abgesagt." : "Sobald sich jemand anmeldet, erscheint die Person hier. Du kannst auch selbst jemanden hinzufügen, zum Beispiel bei einer Anmeldung per Telefon."}</p>
        </Card>
      ) : (
        <>
          {!showUnconfirmedOnly && active.length > 0 && (
            <Card className="overflow-hidden">
              {renderTable(active, "active")}
            </Card>
          )}
          {!showUnconfirmedOnly && waiting.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-amber-300">Warteliste ({waiting.length})</h3>
              <p className="text-xs text-zinc-500">Reihenfolge nach Anmeldezeit. Wird ein Platz frei, rückt automatisch nach, wer noch hineinpasst.</p>
              <Card className="overflow-hidden">
                {renderTable(waiting, "waiting")}
              </Card>
            </div>
          )}
          {unconfirmed.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-sky-300">E-Mail noch nicht bestätigt ({unconfirmed.length}, {unconfirmedSeats} {unconfirmedSeats === 1 ? "Person" : "Personen"})</h3>
              <p className="text-xs text-zinc-500">Diese Gäste haben den Link in der Mail noch nicht angeklickt. Sie belegen keinen Platz und stehen nicht auf der Warteliste. Nach 48 Stunden werden die Angaben automatisch gelöscht. Bei einer Anmeldung per Telefon kannst du die Anmeldung von Hand bestätigen.</p>
              <Card className="overflow-hidden">
                {renderTable(unconfirmed, "unconfirmed")}
              </Card>
            </div>
          )}
          {!showUnconfirmedOnly && ended.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer text-sm font-medium text-zinc-400 hover:text-zinc-200">Abgemeldet ({ended.length})</summary>
              <Card className="mt-2 overflow-hidden">
                {renderTable(ended, "ended")}
              </Card>
            </details>
          )}
        </>
      )}

      <AddDialog open={adding} onClose={() => setAdding(false)} eventId={eventId} base={base} capacity={capacity} />
      {editing && <EditDialog reg={editing} onClose={() => setEditing(null)} onSave={async (body) => {
          if (await act(editing, { action: "update", ...body }, "Gespeichert.")) setEditing(null);
        }} busy={busy === editing.id} />}

      <Modal open={p?.kind === "cancel"} onClose={() => busy === null && setPending(null)} title="Anmeldung absagen?" description={p ? `${p.reg.name} wird von «${eventTitle}» abgemeldet. Der Platz wird frei${waiting.length > 0 ? " und Wartende rücken nach" : ""}.` : ""} size="sm" dismissible={busy === null}>
        <div className="space-y-4">
          <label className="flex items-start gap-3 text-sm text-zinc-300">
            <input type="checkbox" checked={sendMail} onChange={(e) => setSendMail(e.target.checked)} disabled={busy !== null} className="mt-0.5 size-4 shrink-0 accent-emerald-400" />
            <span>
              Person per Mail informieren
              <span className="block text-xs text-zinc-500">Ohne E-Mail-Adresse geht keine Mail.</span>
            </span>
          </label>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setPending(null)} disabled={busy !== null} data-autofocus>
              Abbrechen
            </Button>
            <Button type="button" variant="danger" disabled={busy !== null} onClick={() => p && act(p.reg, { action: "cancel", sendMail }, `Die Anmeldung von ${p.reg.name} wurde abgesagt.`)}>
              {busy !== null ? "Bitte warten …" : "Absagen"}
            </Button>
          </div>
        </div>
      </Modal>
      <ConfirmDialog
        open={p?.kind === "confirm"}
        title="E-Mail-Adresse von Hand bestätigen?"
        description={p ? `Die Anmeldung von ${p.reg.name} (${p.reg.seats} ${p.reg.seats === 1 ? "Person" : "Personen"}) gilt danach, auch ohne Klick auf den Link in der Mail. Es gibt einen Platz oder, wenn der Anlass voll ist, einen Platz auf der Warteliste. Die Person erhält die Bestätigung mit dem Link zum Abmelden. Die Bestätigung kommt ins Änderungsprotokoll.` : ""}
        confirmLabel="Bestätigen"
        busy={busy !== null}
        onConfirm={() => p && act(p.reg, { action: "confirm", force: false, sendMail: true }, `Die Anmeldung von ${p.reg.name} ist bestätigt.`)}
        onCancel={() => setPending(null)}
      />
      <ConfirmDialog
        open={p?.kind === "delete"}
        title="Anmeldung löschen?"
        description={p ? `Die Anmeldung von ${p.reg.name} wird samt Name, E-Mail-Adresse und Bemerkung endgültig gelöscht.` : ""}
        confirmLabel="Endgültig löschen"
        danger
        busy={busy !== null}
        onConfirm={() => p && remove(p.reg)}
        onCancel={() => setPending(null)}
      />
      <ConfirmDialog
        open={p?.kind === "force-promote" || p?.kind === "force-restore"}
        title="Kapazität überschreiten?"
        description={p ? `Für ${p.reg.name} (${p.reg.seats} ${p.reg.seats === 1 ? "Person" : "Personen"}) sind nicht genug Plätze frei. Mit «Trotzdem anmelden» wird die Kapazität bewusst überschritten.` : ""}
        confirmLabel="Trotzdem anmelden"
        busy={busy !== null}
        onConfirm={() => p && act(p.reg, { action: p.kind === "force-promote" ? "promote" : "restore", force: true }, `${p.reg.name} ist angemeldet.`)}
        onCancel={() => setPending(null)}
      />
    </section>
  );
}

function AddDialog({ open, onClose, eventId, base, capacity }: { open: boolean; onClose: () => void; eventId: string; base: string; capacity: number | null }) {
  const router = useRouter();
  const toast = useToast();
  const [kind, setKind] = useState<"member" | "guest">("member");
  const [member, setMember] = useState<PickedMember | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [seats, setSeats] = useState("1");
  const [note, setNote] = useState("");
  const [sendMail, setSendMail] = useState(true);
  const [force, setForce] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErrors({});
    setFormError(null);
    try {
      const res = await api<{ status: string; created: boolean }>(base, {
        method: "POST",
        body: kind === "member" ? { memberId: member?.id ?? "", seats, note, force, sendMail } : { guestName, guestEmail, seats, note, force, sendMail },
      });
      toast.success(!res.created ? "Die Person war schon angemeldet." : res.status === "WARTELISTE" ? "Die Person steht auf der Warteliste." : "Die Person ist angemeldet.");
      setMember(null);
      setGuestName("");
      setGuestEmail("");
      setNote("");
      setSeats("1");
      setForce(false);
      onClose();
      router.refresh();
    } catch (err) {
      const d = describeError(err, "Hinzufügen fehlgeschlagen.");
      setErrors(d.fields);
      setFormError(d.message);
    } finally {
      setBusy(false);
    }
  }

  const uid = `add-${eventId}`;
  return (
    <Modal open={open} onClose={() => !busy && onClose()} title="Person anmelden" description="Trage ein Mitglied oder einen Gast von Hand ein, zum Beispiel bei einer Anmeldung per Telefon." size="md" dismissible={!busy}>
      <form onSubmit={submit} noValidate className="space-y-4">
        {formError && Object.keys(errors).length === 0 && <Notice variant="error">{formError}</Notice>}
        <div role="group" aria-label="Art der Person" className="flex gap-2">
          {(["member", "guest"] as const).map((k) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={cn("inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium ring-1 ring-inset", kind === k ? "bg-zinc-900 text-white ring-zinc-700" : "text-zinc-400 ring-zinc-800 hover:text-zinc-100")}>
              {k === "member" ? "Mitglied" : "Gast"}
            </button>
          ))}
        </div>
        {kind === "member" ? (
          <MemberPicker label="Mitglied" value={member} onChange={setMember} error={errors.memberId} disabled={busy} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor={`${uid}-name`} error={errors.guestName}>
              <Input id={`${uid}-name`} value={guestName} maxLength={100} onChange={(e) => setGuestName(e.target.value)} disabled={busy} required />
            </Field>
            <Field label="E-Mail (optional)" htmlFor={`${uid}-email`} error={errors.guestEmail} hint="Ohne Adresse geht keine Bestätigung und keine Erinnerung.">
              <Input id={`${uid}-email`} type="email" value={guestEmail} maxLength={254} onChange={(e) => setGuestEmail(e.target.value)} disabled={busy} />
            </Field>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
          <Field label="Personen" htmlFor={`${uid}-seats`} error={errors.seats}>
            <Input id={`${uid}-seats`} type="number" min={1} max={50} value={seats} onChange={(e) => setSeats(e.target.value)} disabled={busy} />
          </Field>
          <Field label="Bemerkung (optional)" htmlFor={`${uid}-note`} error={errors.note}>
            <Input id={`${uid}-note`} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} disabled={busy} />
          </Field>
        </div>
        <label className="flex items-start gap-3 text-sm text-zinc-300">
          <input type="checkbox" checked={sendMail} onChange={(e) => setSendMail(e.target.checked)} disabled={busy} className="mt-0.5 size-4 shrink-0 accent-emerald-400" />
          Bestätigung per Mail senden
        </label>
        {capacity !== null && (
          <label className="flex items-start gap-3 text-sm text-zinc-300">
            <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} disabled={busy} className="mt-0.5 size-4 shrink-0 accent-emerald-400" />
            <span>
              Auch bei vollem Anlass direkt anmelden
              <span className="block text-xs text-zinc-500">Ohne Häkchen kommt die Person auf die Warteliste, wenn nicht genug Plätze frei sind.</span>
            </span>
          </label>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Abbrechen
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Speichere …" : "Anmelden"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function EditDialog({ reg, onClose, onSave, busy }: { reg: RegistrationDTO; onClose: () => void; onSave: (body: { seats: string; note: string }) => Promise<void>; busy: boolean }) {
  const [seats, setSeats] = useState(String(reg.seats));
  const [note, setNote] = useState(reg.note);
  return (
    <Modal open onClose={() => !busy && onClose()} title="Anmeldung ändern" description={reg.name} size="sm" dismissible={!busy}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void onSave({ seats, note });
        }}
        className="space-y-4"
      >
        <Field label="Personen" htmlFor="edit-seats">
          <Input id="edit-seats" type="number" min={1} max={50} value={seats} onChange={(e) => setSeats(e.target.value)} disabled={busy} />
        </Field>
        <Field label="Bemerkung" htmlFor="edit-note">
          <Textarea id="edit-note" rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} disabled={busy} />
        </Field>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Abbrechen
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Speichere …" : "Speichern"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
