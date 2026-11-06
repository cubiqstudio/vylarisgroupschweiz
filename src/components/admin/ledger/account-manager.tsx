"use client";

import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ListPlus, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { PILL } from "@/components/admin/core/styles";
import { ConfirmDialog } from "@/components/admin/core/confirm-dialog";
import { Modal } from "@/components/admin/core/modal";
import { Notice } from "@/components/admin/core/notice";
import { useToast } from "@/components/admin/core/toast";
import { call } from "@/components/admin/fees/fetch";
import { Switch } from "@/components/admin/settings/switch";
import { ACCOUNT_KINDS, ACCOUNT_KIND_LABEL, TONE_CLASS, type AccountKind } from "@/lib/verein/constants";

export type AccountView = {
  id: string;
  kind: string;
  number: string;
  name: string;
  /** «1’234.50» (Anzeige) */
  openingDisplay: string;
  /** «1234.50» (Eingabefeld) */
  openingInput: string;
  active: boolean;
  sortOrder: number;
  usage: number;
};

const SECTION_HINT: Record<AccountKind, string> = {
  EINNAHMEN: "Woher kommt das Geld? Zum Beispiel Mitgliederbeiträge, Spenden, Sponsoring.",
  AUSGABEN: "Wofür wird Geld ausgegeben? Zum Beispiel Hosting, Software, Verwaltung.",
  VERMOEGEN: "Wo liegt das Geld? Bankkonto, Kasse. Der Anfangsbestand ist der Stand zu Beginn der Buchführung in dieser Software.",
};

const EMPTY: AccountView = { id: "", kind: "EINNAHMEN", number: "", name: "", openingDisplay: "0.00", openingInput: "0.00", active: true, sortOrder: 0, usage: 0 };

function AccountDialog({ account, onClose, openingLocked }: { account: AccountView; onClose: () => void; openingLocked: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const uid = useId();
  const isNew = account.id === "";
  const [v, setV] = useState(account);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const set = <K extends keyof AccountView>(k: K, value: AccountView[K]) => setV((s) => ({ ...s, [k]: value }));
  const isAsset = v.kind === "VERMOEGEN";

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setFields({});
    const body = {
      ...(isNew || account.usage === 0 ? { kind: v.kind } : {}),
      number: v.number,
      name: v.name,
      ...(isAsset && !(openingLocked && !isNew) ? { openingBalance: v.openingInput || "0" } : {}),
      active: v.active,
      sortOrder: Number(v.sortOrder) || 0,
    };
    const res = isNew ? await call("/api/admin/ledger/accounts", "POST", body) : await call(`/api/admin/ledger/accounts/${encodeURIComponent(v.id)}`, "PATCH", body);
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      setFields(res.fields);
      return;
    }
    toast.success(isNew ? "Das Konto wurde angelegt." : "Das Konto wurde gespeichert.");
    onClose();
    router.refresh();
  }

  return (
    <Modal open onClose={() => !busy && onClose()} title={isNew ? "Konto anlegen" : "Konto bearbeiten"} size="md" dismissible={!busy}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <Notice variant="error">{error}</Notice>}
        <Field label="Art" htmlFor={`${uid}-kind`} error={fields.kind} hint={!isNew && account.usage > 0 ? "Die Art lässt sich nicht mehr ändern, weil das Konto verwendet wird." : SECTION_HINT[v.kind as AccountKind]}>
          <Select id={`${uid}-kind`} value={v.kind} onChange={(e) => set("kind", e.target.value)} disabled={busy || (!isNew && account.usage > 0)}>
            {ACCOUNT_KINDS.map((k) => (
              <option key={k} value={k}>
                {ACCOUNT_KIND_LABEL[k]}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
          <Field label="Nummer / Kürzel" htmlFor={`${uid}-number`} error={fields.number}>
            <Input id={`${uid}-number`} value={v.number} onChange={(e) => set("number", e.target.value)} maxLength={12} required disabled={busy} data-autofocus />
          </Field>
          <Field label="Name" htmlFor={`${uid}-name`} error={fields.name}>
            <Input id={`${uid}-name`} value={v.name} onChange={(e) => set("name", e.target.value)} maxLength={80} required disabled={busy} />
          </Field>
        </div>
        {isAsset && (
          <Field
            label="Anfangsbestand in CHF"
            htmlFor={`${uid}-open`}
            error={fields.openingBalance}
            hint={openingLocked && !isNew ? "Nicht mehr änderbar: Ein Geschäftsjahr ist bereits abgeschlossen." : "Stand zu Beginn der Buchführung in dieser Software, z. B. 1250.00. Kann negativ sein (Überzug)."}
          >
            <Input id={`${uid}-open`} inputMode="decimal" value={v.openingInput} onChange={(e) => set("openingInput", e.target.value)} disabled={busy || (openingLocked && !isNew)} />
          </Field>
        )}
        <Switch id={`${uid}-active`} checked={v.active} onChange={(c) => set("active", c)} label="Aktiv" description="Inaktive Konten lassen sich für neue Buchungen nicht mehr wählen. Bestehende Buchungen bleiben." disabled={busy} />
        <Field label="Reihenfolge" htmlFor={`${uid}-sort`} error={fields.sortOrder} hint="Kleinere Zahl steht weiter oben.">
          <Input id={`${uid}-sort`} type="number" min={0} max={9999} value={v.sortOrder} onChange={(e) => set("sortOrder", Number(e.target.value))} disabled={busy} className="max-w-28" />
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

/** Kontenplan: je Art eine Liste mit Anlegen, Bearbeiten, Löschen (nur unbenutzte Konten) und der Vorlage für kleine Vereine. */
export function AccountManager({ accounts, canWrite, openingLocked }: { accounts: AccountView[]; canWrite: boolean; openingLocked: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState<AccountView | null>(null);
  const [deleting, setDeleting] = useState<AccountView | null>(null);
  const [busy, setBusy] = useState(false);
  const [templateAsk, setTemplateAsk] = useState(false);

  async function remove() {
    if (!deleting || busy) return;
    setBusy(true);
    const res = await call(`/api/admin/ledger/accounts/${encodeURIComponent(deleting.id)}`, "DELETE");
    setBusy(false);
    setDeleting(null);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success("Das Konto wurde gelöscht.");
    router.refresh();
  }

  async function template() {
    if (busy) return;
    setBusy(true);
    const res = await call<{ created: number }>("/api/admin/ledger/accounts/template", "POST");
    setBusy(false);
    setTemplateAsk(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success(res.data.created === 0 ? "Alle Standardkonten sind schon vorhanden." : `${res.data.created} Standardkonten wurden angelegt.`);
    router.refresh();
  }

  return (
    <>
      {canWrite && (
        <div className="mb-4 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setTemplateAsk(true)}>
            <ListPlus className="h-4 w-4" aria-hidden />
            Standardkonten anlegen
          </Button>
          <Button type="button" onClick={() => setEditing({ ...EMPTY })}>
            <Plus className="h-4 w-4" aria-hidden />
            Konto anlegen
          </Button>
        </div>
      )}

      <div className="space-y-6">
        {ACCOUNT_KINDS.map((kind) => {
          const rows = accounts.filter((a) => a.kind === kind);
          return (
            <Card key={kind} className="overflow-hidden">
              <div className="border-b border-zinc-800 px-4 py-3">
                <h2 className="text-base font-semibold text-white">{ACCOUNT_KIND_LABEL[kind]}</h2>
                <p className="text-sm text-zinc-400">{SECTION_HINT[kind]}</p>
              </div>
              {rows.length === 0 ? (
                <p className="px-4 py-6 text-sm text-zinc-400">Noch keine Konten dieser Art.</p>
              ) : (
                <div className="overflow-x-auto" role="region" aria-label={`Konten: ${ACCOUNT_KIND_LABEL[kind]}`} tabIndex={0}>
                  <table className="w-full min-w-[34rem] text-left text-sm">
                    <caption className="sr-only">Konten der Art {ACCOUNT_KIND_LABEL[kind]}</caption>
                    <thead className="border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-500">
                      <tr>
                        <th scope="col" className="w-24 px-4 py-2.5 font-medium">
                          Nummer
                        </th>
                        <th scope="col" className="px-4 py-2.5 font-medium">
                          Name
                        </th>
                        {kind === "VERMOEGEN" && (
                          <th scope="col" className="px-4 py-2.5 text-right font-medium">
                            Anfangsbestand
                          </th>
                        )}
                        <th scope="col" className="px-4 py-2.5 text-right font-medium">
                          Verwendet
                        </th>
                        <th scope="col" className="px-4 py-2.5 font-medium">
                          Status
                        </th>
                        {canWrite && (
                          <th scope="col" className="px-4 py-2.5 text-right font-medium">
                            <span className="sr-only">Aktionen</span>
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {rows.map((a) => (
                        <tr key={a.id} className="hover:bg-zinc-900/40">
                          <td className="px-4 py-3 tabular-nums text-zinc-400">{a.number}</td>
                          <td className="px-4 py-3 font-medium text-white">{a.name}</td>
                          {kind === "VERMOEGEN" && <td className="px-4 py-3 text-right tabular-nums text-zinc-300">{a.openingDisplay}</td>}
                          <td className="px-4 py-3 text-right tabular-nums text-zinc-400">{a.usage}</td>
                          <td className="px-4 py-3">
                            <span className={cn(PILL, a.active ? TONE_CLASS.green : TONE_CLASS.zinc)}>{a.active ? "Aktiv" : "Inaktiv"}</span>
                          </td>
                          {canWrite && (
                            <td className="px-4 py-3">
                              <div className="flex justify-end gap-1">
                                <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(a)}>
                                  <Pencil className="h-4 w-4" aria-hidden />
                                  Bearbeiten
                                  <span className="sr-only">: {a.name}</span>
                                </Button>
                                {a.usage === 0 && (
                                  <Button type="button" variant="ghost" size="sm" onClick={() => setDeleting(a)}>
                                    <Trash2 className="h-4 w-4" aria-hidden />
                                    Löschen
                                    <span className="sr-only">: {a.name}</span>
                                  </Button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {editing && <AccountDialog account={editing} onClose={() => setEditing(null)} openingLocked={openingLocked} />}

      <ConfirmDialog
        open={deleting !== null}
        title="Konto löschen?"
        description={deleting ? `Das Konto ${deleting.number} «${deleting.name}» wird gelöscht. Das geht nur, solange es nirgends verwendet wird.` : ""}
        confirmLabel="Konto löschen"
        danger
        busy={busy}
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
      <ConfirmDialog
        open={templateAsk}
        title="Standardkonten anlegen?"
        description="Es werden übliche Konten für einen kleinen Verein angelegt (Mitgliederbeiträge, Spenden, Hosting, Bankspesen, Bankkonto, Kasse usw.), ohne Beträge. Vorhandene Konten bleiben unberührt. Namen und Nummern kannst du danach anpassen."
        confirmLabel="Standardkonten anlegen"
        busy={busy}
        onConfirm={template}
        onCancel={() => setTemplateAsk(false)}
      />
    </>
  );
}
