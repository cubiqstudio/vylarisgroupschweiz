"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/form";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { PILL } from "@/components/admin/core/styles";
import { ConfirmDialog } from "@/components/admin/core/confirm-dialog";
import { Modal } from "@/components/admin/core/modal";
import { Notice } from "@/components/admin/core/notice";
import { useToast } from "@/components/admin/core/toast";
import { Switch } from "@/components/admin/settings/switch";
import { describeError } from "@/components/admin/settings/form-utils";

export type MembershipTypeRow = {
  id: string;
  name: string;
  description: string;
  /** «20.00» */
  annualFee: string;
  /** «1’234.50» */
  annualFeeDisplay: string;
  votingRight: boolean;
  eligibleForBoard: boolean;
  selectable: boolean;
  active: boolean;
  sortOrder: number;
  memberCount: number;
};

const EMPTY: MembershipTypeRow = { id: "", name: "", description: "", annualFee: "0.00", annualFeeDisplay: "0.00", votingRight: true, eligibleForBoard: true, selectable: true, active: true, sortOrder: 0, memberCount: 0 };

function TypeDialog({ type, onClose }: { type: MembershipTypeRow; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const isNew = type.id === "";
  const [v, setV] = useState(type);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof MembershipTypeRow>(k: K, val: MembershipTypeRow[K]) => setV((s) => ({ ...s, [k]: val }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErrors({});
    setFormError(null);
    const body = {
      name: v.name,
      description: v.description,
      annualFee: v.annualFee,
      votingRight: v.votingRight,
      eligibleForBoard: v.eligibleForBoard,
      selectable: v.selectable,
      active: v.active,
      sortOrder: Number(v.sortOrder) || 0,
    };
    try {
      if (isNew) await api("/api/admin/members/types", { method: "POST", body });
      else await api(`/api/admin/members/types/${encodeURIComponent(v.id)}`, { method: "PATCH", body });
      toast.success(isNew ? "Die Mitgliedschaftsart wurde angelegt." : "Die Mitgliedschaftsart wurde gespeichert.");
      onClose();
      router.refresh();
    } catch (err) {
      const d = describeError(err, "Speichern fehlgeschlagen.");
      setErrors(d.fields);
      setFormError(d.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={() => !busy && onClose()} title={isNew ? "Mitgliedschaftsart anlegen" : "Mitgliedschaftsart bearbeiten"} size="md" dismissible={!busy}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && Object.keys(errors).length === 0 && <Notice variant="error">{formError}</Notice>}
        <Notice variant="info">Beitrag, Stimmrecht und Wählbarkeit legt der Verein in den Statuten fest. Passe die Angaben gemäss Statuten an.</Notice>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="t-name" error={errors.name}>
            <Input id="t-name" value={v.name} maxLength={60} required onChange={(e) => set("name", e.target.value)} disabled={busy} />
          </Field>
          <Field label="Jahresbeitrag (CHF)" htmlFor="t-fee" hint="0 = beitragsfrei. Gilt für neue Beitragsjahre." error={errors.annualFee}>
            <Input id="t-fee" inputMode="decimal" value={v.annualFee} onChange={(e) => set("annualFee", e.target.value)} disabled={busy} />
          </Field>
        </div>
        <Field label="Beschreibung (optional)" htmlFor="t-desc" error={errors.description}>
          <Textarea id="t-desc" rows={2} maxLength={500} value={v.description} onChange={(e) => set("description", e.target.value)} disabled={busy} />
        </Field>
        <div className="space-y-3">
          <Switch id="t-voting" checked={v.votingRight} onChange={(c) => set("votingRight", c)} label="Stimmrecht" description="Stimmrecht in der Mitgliederversammlung. Ohne abweichende Statuten haben alle Mitglieder das gleiche Stimmrecht (ZGB Art. 67)." disabled={busy} />
          <Switch id="t-board" checked={v.eligibleForBoard} onChange={(c) => set("eligibleForBoard", c)} label="Vorstandsfähig" description="Mitglieder dieser Art können in den Vorstand gewählt werden." disabled={busy} />
          <Switch id="t-selectable" checked={v.selectable} onChange={(c) => set("selectable", c)} label="Im Beitrittsformular wählbar" description="Wenn aus, kann nur der Vorstand diese Art vergeben." disabled={busy} />
          <Switch id="t-active" checked={v.active} onChange={(c) => set("active", c)} label="Aktiv" description="Inaktive Arten lassen sich nicht mehr neu vergeben; bestehende Mitglieder behalten sie." disabled={busy} />
        </div>
        <Field label="Reihenfolge" htmlFor="t-sort" hint="Kleinere Zahl steht weiter oben." error={errors.sortOrder}>
          <Input id="t-sort" type="number" min={0} max={999} value={v.sortOrder} onChange={(e) => set("sortOrder", Number(e.target.value))} disabled={busy} className="max-w-28" />
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

const flag = (on: boolean, yes: string, no: string) => (
  <span className={cn(PILL, on ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30" : "bg-zinc-800/80 text-zinc-400 ring-zinc-700")}>{on ? yes : no}</span>
);

/** Liste der Mitgliedschaftsarten mit Anlegen, Bearbeiten und Löschen (Löschen nur, wenn nirgends verwendet). */
export function MembershipTypeManager({ types, canWrite }: { types: MembershipTypeRow[]; canWrite: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState<MembershipTypeRow | null>(null);
  const [deleting, setDeleting] = useState<MembershipTypeRow | null>(null);
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!deleting || busy) return;
    setBusy(true);
    try {
      await api(`/api/admin/members/types/${encodeURIComponent(deleting.id)}`, { method: "DELETE" });
      toast.success("Die Mitgliedschaftsart wurde gelöscht.");
      router.refresh();
    } catch (err) {
      toast.error(describeError(err, "Löschen fehlgeschlagen.").message);
    } finally {
      setBusy(false);
      setDeleting(null);
    }
  }

  return (
    <>
      {canWrite && (
        <div className="mb-4 flex justify-end">
          <Button type="button" onClick={() => setEditing({ ...EMPTY })}>
            <Plus className="h-4 w-4" aria-hidden />
            Mitgliedschaftsart anlegen
          </Button>
        </div>
      )}
      <Card className="overflow-hidden">
        <ul className="divide-y divide-zinc-800">
          {types.map((t) => (
            <li key={t.id} className="px-4 py-4 sm:px-5">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                <h2 className="text-sm font-semibold text-white sm:text-base">{t.name}</h2>
                {!t.active && <span className={cn(PILL, "bg-zinc-800/80 text-zinc-400 ring-zinc-700")}>Inaktiv</span>}
                {flag(t.votingRight, "Stimmrecht", "Kein Stimmrecht")}
                {flag(t.eligibleForBoard, "Vorstandsfähig", "Nicht vorstandsfähig")}
                {flag(t.selectable, "Im Formular wählbar", "Nicht im Formular")}
              </div>
              {t.description && <p className="mt-1 text-sm text-zinc-400">{t.description}</p>}
              <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-zinc-500">
                <div className="flex gap-1.5">
                  <dt>Jahresbeitrag:</dt>
                  <dd className="tabular-nums text-zinc-300">CHF {t.annualFeeDisplay}</dd>
                </div>
                <div className="flex gap-1.5">
                  <dt>Mitglieder:</dt>
                  <dd className="tabular-nums text-zinc-300">{t.memberCount}</dd>
                </div>
              </dl>
              {canWrite && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(t)}>
                    <Pencil className="h-4 w-4" aria-hidden />
                    Bearbeiten
                    <span className="sr-only"> ({t.name})</span>
                  </Button>
                  <Button type="button" variant="danger" size="sm" onClick={() => setDeleting(t)} disabled={t.memberCount > 0} title={t.memberCount > 0 ? "Wird verwendet. Deaktiviere die Art stattdessen." : undefined}>
                    <Trash2 className="h-4 w-4" aria-hidden />
                    Löschen
                    <span className="sr-only"> ({t.name})</span>
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>
      {editing && <TypeDialog key={editing.id || "new"} type={editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={deleting !== null}
        title="Mitgliedschaftsart löschen?"
        description={deleting ? `«${deleting.name}» wird gelöscht. Das geht nur, wenn die Art nirgends verwendet wird.` : ""}
        confirmLabel="Löschen"
        danger
        busy={busy}
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
