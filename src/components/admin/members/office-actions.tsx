"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { api } from "@/lib/api-client";
import { OFFICE_KIND_LABEL, OFFICE_KINDS } from "@/lib/verein/constants";
import { toDateInputValue, todayZurich } from "@/lib/verein/dates";
import { ConfirmDialog } from "@/components/admin/core/confirm-dialog";
import { Modal } from "@/components/admin/core/modal";
import { Notice } from "@/components/admin/core/notice";
import { useToast } from "@/components/admin/core/toast";
import { describeError } from "@/components/admin/settings/form-utils";
import { MemberPicker, type PickedMember } from "./member-picker";

export type OfficeDTO = {
  id: string;
  kind: string;
  title: string;
  validFrom: string;
  validUntil: string;
  note: string;
  /** Anzeige: «Präsident/in» oder eigene Bezeichnung */
  label: string;
  memberName: string;
};

type Response = { id: string; warning: string | null };

function OfficeDialog({ open, onClose, office, fixedMember }: { open: boolean; onClose: () => void; office?: OfficeDTO; fixedMember?: PickedMember }) {
  const router = useRouter();
  const toast = useToast();
  const [kind, setKind] = useState(office?.kind ?? "BEISITZ");
  const [title, setTitle] = useState(office?.title ?? "");
  const [validFrom, setValidFrom] = useState(office?.validFrom ?? toDateInputValue(todayZurich()));
  const [validUntil, setValidUntil] = useState(office?.validUntil ?? "");
  const [note, setNote] = useState(office?.note ?? "");
  const [member, setMember] = useState<PickedMember | null>(fixedMember ?? null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErrors({});
    setFormError(null);
    try {
      const body = { kind, title, validFrom, validUntil, note };
      const res = office
        ? await api<Response>(`/api/admin/members/offices/${encodeURIComponent(office.id)}`, { method: "PATCH", body })
        : await api<Response>("/api/admin/members/offices", { method: "POST", body: { ...body, memberId: member?.id ?? "" } });
      toast.success(office ? "Das Amt wurde geändert." : "Das Amt wurde erfasst.");
      if (res.warning) toast.error(res.warning);
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
    <Modal open={open} onClose={() => !busy && onClose()} title={office ? "Amt bearbeiten" : "Amt vergeben"} description={office ? `${office.label}, ${office.memberName}` : "Das Amt gehört zur Person, nicht zum Zugang in dieser Software. Zugriffsrechte vergibst du getrennt unter «Zugänge und Rollen»."} size="md" dismissible={!busy}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && Object.keys(errors).length === 0 && <Notice variant="error">{formError}</Notice>}
        {!office && <MemberPicker label="Mitglied" value={member} onChange={setMember} error={errors.memberId} disabled={busy || Boolean(fixedMember)} />}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amt" htmlFor="o-kind" error={errors.kind}>
            <Select id="o-kind" value={kind} onChange={(e) => setKind(e.target.value)} disabled={busy}>
              {OFFICE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {OFFICE_KIND_LABEL[k]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={kind === "SONSTIGES" ? "Bezeichnung" : "Eigene Bezeichnung (optional)"} htmlFor="o-title" error={errors.title}>
            <Input id="o-title" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} disabled={busy} required={kind === "SONSTIGES"} />
          </Field>
          <Field label="Von" htmlFor="o-from" error={errors.validFrom}>
            <Input id="o-from" type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} disabled={busy} required />
          </Field>
          <Field label="Bis" htmlFor="o-until" hint="Leer = laufend." error={errors.validUntil}>
            <Input id="o-until" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} disabled={busy} />
          </Field>
        </div>
        <Field label="Notiz (optional)" htmlFor="o-note" hint="Z. B. Wahl an der Versammlung vom …" error={errors.note}>
          <Textarea id="o-note" rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} disabled={busy} />
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

/** Schaltfläche «Amt vergeben». Mit `fixedMember` ist die Person vorgegeben (Detailseite), sonst wählt man sie per Suche. */
export function OfficeAddButton({ fixedMember, label = "Amt vergeben" }: { fixedMember?: PickedMember; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" aria-hidden />
        {label}
      </Button>
      {open && <OfficeDialog open onClose={() => setOpen(false)} fixedMember={fixedMember} />}
    </>
  );
}

/** Bearbeiten, beenden und löschen eines Amtes. */
export function OfficeRowActions({ office }: { office: OfficeDTO }) {
  const router = useRouter();
  const toast = useToast();
  const [edit, setEdit] = useState(false);
  const [confirm, setConfirm] = useState<"end" | "delete" | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(kind: "end" | "delete") {
    if (busy) return;
    setBusy(true);
    try {
      if (kind === "end") {
        await api(`/api/admin/members/offices/${encodeURIComponent(office.id)}`, { method: "PATCH", body: { validUntil: toDateInputValue(todayZurich()) } });
        toast.success("Das Amt wurde per heute beendet.");
      } else {
        await api(`/api/admin/members/offices/${encodeURIComponent(office.id)}`, { method: "DELETE" });
        toast.success("Das Amt wurde gelöscht.");
      }
      setConfirm(null);
      router.refresh();
    } catch (err) {
      toast.error(describeError(err, "Die Aktion ist fehlgeschlagen.").message);
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        <Button type="button" variant="secondary" size="sm" onClick={() => setEdit(true)}>
          <Pencil className="h-4 w-4" aria-hidden />
          Bearbeiten
          <span className="sr-only"> ({office.label}, {office.memberName})</span>
        </Button>
        {!office.validUntil && (
          <Button type="button" variant="secondary" size="sm" onClick={() => setConfirm("end")}>
            <CalendarCheck className="h-4 w-4" aria-hidden />
            Beenden
            <span className="sr-only"> ({office.label}, {office.memberName})</span>
          </Button>
        )}
        <Button type="button" variant="danger" size="sm" onClick={() => setConfirm("delete")}>
          <Trash2 className="h-4 w-4" aria-hidden />
          Löschen
          <span className="sr-only"> ({office.label}, {office.memberName})</span>
        </Button>
      </div>
      {edit && <OfficeDialog open office={office} onClose={() => setEdit(false)} />}
      <ConfirmDialog
        open={confirm === "end"}
        title="Amt beenden?"
        description={`«${office.label}» von ${office.memberName} wird per heute beendet und bleibt im Verlauf sichtbar.`}
        confirmLabel="Per heute beenden"
        busy={busy}
        onConfirm={() => run("end")}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        title="Amt löschen?"
        description={`Der Eintrag «${office.label}» von ${office.memberName} wird gelöscht. Wenn die Person das Amt tatsächlich innehatte, beende es stattdessen, damit der Verlauf stimmt.`}
        confirmLabel="Löschen"
        danger
        busy={busy}
        onConfirm={() => run("delete")}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}
