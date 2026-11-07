"use client";

import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Ban, Play, Plus, ScanQrCode, ShieldCheck, ShieldOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { formatDateTimeCh } from "@/lib/verein/dates";
import { ConfirmDialog } from "@/components/admin/core/confirm-dialog";
import { Modal } from "@/components/admin/core/modal";
import { Notice } from "@/components/admin/core/notice";
import { PILL } from "@/components/admin/core/styles";
import { useToast } from "@/components/admin/core/toast";
import { CopyField } from "@/components/admin/licenses/copy-field";
import { EmptyState } from "@/components/admin/licenses/empty-state";
import { describeError } from "@/components/admin/settings/form-utils";
import { PairingQr } from "./pairing-qr";
import type { CreatedScannerDevice, ScannerDeviceDto } from "./types";

const CHECKBOX = "h-4 w-4 rounded border-zinc-600 bg-surface accent-emerald-400";

function CreateForm({ onCreated, onCancel }: { onCreated: (c: CreatedScannerDevice) => void; onCancel: () => void }) {
  const uid = useId();
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [canCheckIn, setCanCheckIn] = useState(true);
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setFields({});
    setFormError("");
    try {
      const created = await api<CreatedScannerDevice>("/api/admin/scanner-devices", { method: "POST", body: { label, canCheckIn } });
      router.refresh();
      onCreated(created);
    } catch (err) {
      const d = describeError(err, "Das Gerät konnte nicht angelegt werden.");
      setFields(d.fields);
      setFormError(d.message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {formError && (
        <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {formError}
        </p>
      )}
      <Field label="Bezeichnung" htmlFor={`${uid}-label`} error={fields.label} hint="Woran du das Gerät erkennst, z. B. «Eingang links» (1 bis 60 Zeichen).">
        <Input id={`${uid}-label`} value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} required data-autofocus />
      </Field>
      <div className="flex items-start gap-3">
        <input id={`${uid}-ci`} type="checkbox" checked={canCheckIn} onChange={(e) => setCanCheckIn(e.target.checked)} className={cn(CHECKBOX, "mt-0.5")} />
        <label htmlFor={`${uid}-ci`} className="text-sm text-zinc-300">
          Darf einchecken
          <span className="mt-0.5 block text-xs text-zinc-500">Ohne dieses Recht kann das Gerät Ausweise nur prüfen, aber niemanden als anwesend eintragen.</span>
        </label>
      </div>
      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
          Abbrechen
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Lege an …" : "Gerät anlegen"}
        </Button>
      </div>
    </form>
  );
}

/** Token und Kopplungs-QR: gibt es nur jetzt, danach ist das Token nicht mehr abrufbar. */
function Pairing({ created, onClose }: { created: CreatedScannerDevice; onClose: () => void }) {
  const [saved, setSaved] = useState(false);
  const id = useId();
  return (
    <div className="space-y-4">
      <Notice variant="warning">
        <strong className="font-semibold">Wird nicht noch einmal angezeigt.</strong> Koppel die App jetzt mit dem QR-Code oder kopiere das Token. Geht es verloren, sperrst oder löschst du das Gerät und legst ein neues an.
      </Notice>
      <PairingQr qr={created.qr} label={`Kopplungs-QR-Code für das Gerät ${created.label}`} />
      <p className="text-center text-xs text-zinc-500">In der App: Gerät koppeln, dann diesen Code scannen.</p>
      <CopyField label="Token (zum Eintippen in der App)" value={created.token} />
      <CopyField label="Kopplungs-Link (Inhalt des QR-Codes)" value={created.pairingUrl} />
      <div className="flex items-start gap-3">
        <input id={id} type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className={cn(CHECKBOX, "mt-0.5")} />
        <label htmlFor={id} className="text-sm text-zinc-300">
          Das Gerät ist gekoppelt oder das Token ist sicher gespeichert.
        </label>
      </div>
      <div className="flex justify-end">
        <Button type="button" onClick={onClose} disabled={!saved}>
          Fertig
        </Button>
      </div>
    </div>
  );
}

function statusOf(d: ScannerDeviceDto): { text: string; tone: string } {
  if (d.active) return { text: "Aktiv", tone: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30" };
  return { text: "Gesperrt", tone: "bg-rose-500/10 text-rose-300 ring-rose-500/30" };
}

export function ScannerManager({ devices, serverUrl, canWrite }: { devices: ScannerDeviceDto[]; serverUrl: string; canWrite: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<CreatedScannerDevice | null>(null);
  const [toDelete, setToDelete] = useState<ScannerDeviceDto | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function patch(d: ScannerDeviceDto, body: { active?: boolean; canCheckIn?: boolean }, success: string) {
    setBusyId(d.id);
    try {
      await api(`/api/admin/scanner-devices/${encodeURIComponent(d.id)}`, { method: "PATCH", body });
      toast.success(success);
      router.refresh();
    } catch (err) {
      toast.error(describeError(err, "Die Aktion ist fehlgeschlagen.").message);
    } finally {
      setBusyId(null);
    }
  }

  async function remove() {
    if (!toDelete) return;
    setBusyId(toDelete.id);
    try {
      await api(`/api/admin/scanner-devices/${encodeURIComponent(toDelete.id)}`, { method: "DELETE" });
      toast.success(`Gerät «${toDelete.label}» wurde gelöscht.`);
      setToDelete(null);
      router.refresh();
    } catch (err) {
      toast.error(describeError(err, "Das Gerät konnte nicht gelöscht werden.").message);
      setToDelete(null);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <p className="mb-4 text-xs text-zinc-500">
        Adresse der Website für die Kopplung: <code className="font-mono text-zinc-300 [overflow-wrap:anywhere]">{serverUrl}</code>
      </p>

      {canWrite ? (
        <div className="mb-4 flex justify-end">
          <Button type="button" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Neues Gerät
          </Button>
        </div>
      ) : (
        <Notice variant="info" className="mb-4">
          Du hast hier nur Leserechte. Geräte anlegen, sperren oder löschen dürfen nur Personen mit dem Recht «System ändern».
        </Notice>
      )}

      {devices.length === 0 ? (
        <EmptyState icon={ScanQrCode} title="Noch keine Geräte" text="Lege ein Gerät an und koppel es mit der App «Vylaris Scanner», um an der Tür Ausweise zu prüfen." />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-zinc-800">
            {devices.map((d) => {
              const st = statusOf(d);
              const disabled = busyId !== null;
              return (
                <li key={d.id} className="px-4 py-4 sm:px-5">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                    <h2 className="min-w-0 break-words text-sm font-semibold text-white sm:text-base">{d.label}</h2>
                    <span className={cn(PILL, st.tone)}>{st.text}</span>
                    <span className={cn(PILL, d.canCheckIn ? "bg-indigo-500/10 text-indigo-300 ring-indigo-500/30" : "bg-zinc-800/80 text-zinc-400 ring-zinc-700")}>
                      {d.canCheckIn ? "Darf einchecken" : "Nur prüfen"}
                    </span>
                  </div>
                  <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-zinc-500">
                    <div className="flex gap-1.5">
                      <dt>Token beginnt mit:</dt>
                      <dd className="font-mono text-zinc-400">{d.tokenHint}…</dd>
                    </div>
                    <div className="flex gap-1.5">
                      <dt>Angelegt:</dt>
                      <dd>
                        <time dateTime={d.createdAt}>{formatDateTimeCh(new Date(d.createdAt))}</time>
                      </dd>
                    </div>
                    <div className="flex gap-1.5">
                      <dt>Zuletzt genutzt:</dt>
                      <dd>{d.lastUsedAt ? <time dateTime={d.lastUsedAt}>{formatDateTimeCh(new Date(d.lastUsedAt))}</time> : "noch nie"}</dd>
                    </div>
                    {d.revokedAt && (
                      <div className="flex gap-1.5">
                        <dt>Gesperrt:</dt>
                        <dd>
                          <time dateTime={d.revokedAt}>{formatDateTimeCh(new Date(d.revokedAt))}</time>
                        </dd>
                      </div>
                    )}
                  </dl>
                  {canWrite && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {d.active ? (
                        <Button type="button" variant="secondary" size="sm" disabled={disabled} onClick={() => patch(d, { active: false }, `Gerät «${d.label}» gesperrt.`)}>
                          <Ban className="h-4 w-4" aria-hidden="true" />
                          Sperren
                          <span className="sr-only"> ({d.label})</span>
                        </Button>
                      ) : (
                        <Button type="button" variant="secondary" size="sm" disabled={disabled} onClick={() => patch(d, { active: true }, `Gerät «${d.label}» wieder aktiv.`)}>
                          <Play className="h-4 w-4" aria-hidden="true" />
                          Wieder aktivieren
                          <span className="sr-only"> ({d.label})</span>
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={disabled}
                        onClick={() => patch(d, { canCheckIn: !d.canCheckIn }, d.canCheckIn ? `Gerät «${d.label}» darf nicht mehr einchecken.` : `Gerät «${d.label}» darf jetzt einchecken.`)}
                      >
                        {d.canCheckIn ? <ShieldOff className="h-4 w-4" aria-hidden="true" /> : <ShieldCheck className="h-4 w-4" aria-hidden="true" />}
                        {d.canCheckIn ? "Einchecken verbieten" : "Einchecken erlauben"}
                        <span className="sr-only"> ({d.label})</span>
                      </Button>
                      <Button type="button" variant="danger" size="sm" disabled={disabled} onClick={() => setToDelete(d)}>
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        Löschen
                        <span className="sr-only"> ({d.label})</span>
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Modal open={creating && !created} onClose={() => setCreating(false)} title="Neues Scanner-Gerät" description="Token und Kopplungs-QR werden nach dem Anlegen genau einmal angezeigt." size="md">
        {creating && !created && <CreateForm onCreated={(c) => setCreated(c)} onCancel={() => setCreating(false)} />}
      </Modal>

      <Modal
        open={created !== null}
        onClose={() => undefined}
        dismissible={false}
        title={created ? `Gerät «${created.label}» angelegt` : "Gerät angelegt"}
        description="Token und QR-Code siehst du nur jetzt."
        size="md"
      >
        {created && (
          <Pairing
            created={created}
            onClose={() => {
              setCreated(null);
              setCreating(false);
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={toDelete !== null}
        title="Gerät löschen?"
        description={toDelete ? `Das Token von «${toDelete.label}» funktioniert danach nie wieder; die App auf diesem Gerät wird abgekoppelt. Das kann nicht rückgängig gemacht werden. Bereits erfasste Check-ins bleiben im Änderungsprotokoll.` : ""}
        confirmLabel="Endgültig löschen"
        danger
        busy={busyId !== null}
        onConfirm={remove}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
