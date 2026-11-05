"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Package, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/admin/core/confirm-dialog";
import { Modal } from "@/components/admin/core/modal";
import { PILL } from "@/components/admin/core/styles";
import { useToast } from "@/components/admin/core/toast";
import { describeError } from "@/components/admin/settings/form-utils";
import type { ProductRow } from "./types";

type FormState = {
  name: string;
  description: string;
  slug: string;
  code: string;
  businessOnly: boolean;
  allowAccountRequest: boolean;
  approvalMode: "AUTO" | "MANUAL";
  comingSoon: boolean;
  active: boolean;
  sortOrder: string;
};

const EMPTY: FormState = {
  name: "",
  description: "",
  slug: "",
  code: "",
  businessOnly: false,
  allowAccountRequest: false,
  approvalMode: "AUTO",
  comingSoon: false,
  active: true,
  sortOrder: "0",
};

const fromRow = (p: ProductRow): FormState => ({
  name: p.name,
  description: p.description,
  slug: p.slug,
  code: p.code,
  businessOnly: p.businessOnly,
  allowAccountRequest: p.allowAccountRequest,
  approvalMode: p.approvalMode,
  comingSoon: p.comingSoon,
  active: p.active,
  sortOrder: String(p.sortOrder),
});

function Check({
  id,
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-600 bg-surface accent-emerald-400"
      />
      <label htmlFor={id} className="text-sm text-zinc-300">
        {label}
        {hint && <span className="mt-0.5 block text-xs text-zinc-500">{hint}</span>}
      </label>
    </div>
  );
}

function ProductForm({ product, onDone, onCancel }: { product: ProductRow | null; onDone: () => void; onCancel: () => void }) {
  const uid = useId();
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState<FormState>(product ? fromRow(product) : EMPTY);
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const editing = product !== null;
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setFields({});
    setFormError("");
    const body = {
      name: f.name,
      description: f.description,
      businessOnly: f.businessOnly,
      allowAccountRequest: f.businessOnly && f.allowAccountRequest,
      approvalMode: f.approvalMode,
      comingSoon: f.comingSoon,
      active: f.active,
      sortOrder: Number.parseInt(f.sortOrder, 10) || 0,
      ...(editing ? {} : { slug: f.slug, code: f.code }),
    };
    try {
      if (editing) await api(`/api/admin/products/${encodeURIComponent(product.id)}`, { method: "PATCH", body });
      else await api("/api/admin/products", { method: "POST", body });
      toast.success(editing ? "Produkt gespeichert." : "Produkt angelegt.");
      router.refresh();
      onDone();
    } catch (err) {
      const d = describeError(err, "Das Produkt konnte nicht gespeichert werden.");
      setFields(d.fields);
      setFormError(d.message);
    } finally {
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
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor={`${uid}-name`} error={fields.name}>
          <Input id={`${uid}-name`} value={f.name} onChange={(e) => set("name", e.target.value)} maxLength={80} required data-autofocus />
        </Field>
        <Field label="Reihenfolge" htmlFor={`${uid}-sort`} error={fields.sortOrder} hint="Kleine Zahlen zuerst.">
          <Input id={`${uid}-sort`} type="number" min={0} max={1000} value={f.sortOrder} onChange={(e) => set("sortOrder", e.target.value)} />
        </Field>
        <Field
          label="Slug"
          htmlFor={`${uid}-slug`}
          error={fields.slug}
          hint={editing ? "Kann nachträglich nicht geändert werden, weil API-Zugänge darauf verweisen." : "Kleinbuchstaben, Ziffern und Bindestriche, z. B. webspace."}
        >
          <Input id={`${uid}-slug`} value={f.slug} onChange={(e) => set("slug", e.target.value)} maxLength={60} disabled={editing} className="font-mono" />
        </Field>
        <Field
          label="Code"
          htmlFor={`${uid}-code`}
          error={fields.code}
          hint={editing ? "Kann nachträglich nicht geändert werden, bestehende Schlüssel tragen ihn." : "3–4 Grossbuchstaben, Präfix der Schlüssel (VGS-CODE-…)."}
        >
          <Input id={`${uid}-code`} value={f.code} onChange={(e) => set("code", e.target.value.toUpperCase())} maxLength={4} disabled={editing} className="font-mono uppercase" />
        </Field>
      </div>
      <Field label="Beschreibung" htmlFor={`${uid}-desc`} error={fields.description} hint="Wird Nutzern im Konto angezeigt.">
        <Textarea id={`${uid}-desc`} value={f.description} onChange={(e) => set("description", e.target.value)} maxLength={500} rows={3} />
      </Field>

      <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
        <Check
          id={`${uid}-biz`}
          label="Nur Firmenkunden"
          hint="Schlüssel gibt es nur für freigegebene Firmenkunden."
          checked={f.businessOnly}
          onChange={(v) => set("businessOnly", v)}
        />
        <Check
          id={`${uid}-acc`}
          label="Konto-Antrag erlaubt"
          hint="Alle anderen Nutzer können stattdessen ein Konto beantragen. Wirkt nur zusammen mit «Nur Firmenkunden»."
          checked={f.allowAccountRequest}
          disabled={!f.businessOnly}
          onChange={(v) => set("allowAccountRequest", v)}
        />
        <Check
          id={`${uid}-soon`}
          label="Bald verfügbar"
          hint="Kennzeichnet das Produkt als angekündigt. Schlüssel sind trotzdem beantragbar."
          checked={f.comingSoon}
          onChange={(v) => set("comingSoon", v)}
        />
        <Check
          id={`${uid}-active`}
          label="Aktiv"
          hint="Inaktive Produkte sind für Nutzer nicht sichtbar und die Prüf-API meldet ihre Schlüssel als ungültig."
          checked={f.active}
          onChange={(v) => set("active", v)}
        />
      </div>

      <Field
        label="Freigabe"
        htmlFor={`${uid}-mode`}
        error={fields.approvalMode}
        hint={f.approvalMode === "AUTO" ? "Schlüssel sind sofort aktiv." : "Schlüssel warten, bis das Team sie freigibt."}
      >
        <Select id={`${uid}-mode`} value={f.approvalMode} onChange={(e) => set("approvalMode", e.target.value as "AUTO" | "MANUAL")}>
          <option value="AUTO">Automatisch (sofort aktiv)</option>
          <option value="MANUAL">Manuell (Freigabe durch das Team)</option>
        </Select>
      </Field>

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
          Abbrechen
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Speichere …" : editing ? "Speichern" : "Produkt anlegen"}
        </Button>
      </div>
    </form>
  );
}

export function ProductManager({ products }: { products: ProductRow[] }) {
  const router = useRouter();
  const toast = useToast();
  // null = geschlossen, "new" = neues Produkt, sonst die Zeile
  const [editing, setEditing] = useState<ProductRow | "new" | null>(null);
  const [toDelete, setToDelete] = useState<ProductRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api(`/api/admin/products/${encodeURIComponent(toDelete.id)}`, { method: "DELETE" });
      toast.success(`«${toDelete.name}» wurde gelöscht.`);
      setToDelete(null);
      router.refresh();
    } catch (err) {
      toast.error(describeError(err, "Das Produkt konnte nicht gelöscht werden.").message);
      setToDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button type="button" onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Neues Produkt
        </Button>
      </div>

      {products.length === 0 ? (
        <Card className="flex flex-col items-center px-6 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800/80 text-zinc-400 ring-1 ring-inset ring-zinc-700">
            <Package className="h-5 w-5" aria-hidden />
          </span>
          <h2 className="mt-4 text-lg font-semibold text-white">Noch keine Produkte</h2>
          <p className="mt-1.5 max-w-sm text-sm text-zinc-400">Lege ein Produkt an, damit Nutzer Lizenzschlüssel beantragen können.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-zinc-800">
            {products.map((p) => {
              const used = p.keyCount + p.requestCount > 0;
              return (
                <li key={p.id} className="px-4 py-4 sm:px-5">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                    <h2 className="text-sm font-semibold text-white sm:text-base">{p.name}</h2>
                    <span className={cn(PILL, "bg-zinc-800/80 font-mono text-zinc-300 ring-zinc-700")}>{p.code}</span>
                    <span className={cn(PILL, p.active ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30" : "bg-zinc-800/80 text-zinc-400 ring-zinc-700")}>
                      {p.active ? "Aktiv" : "Inaktiv"}
                    </span>
                    {p.comingSoon && <span className={cn(PILL, "bg-indigo-500/10 text-indigo-300 ring-indigo-500/30")}>Bald verfügbar</span>}
                    {p.businessOnly && <span className={cn(PILL, "bg-sky-500/10 text-sky-300 ring-sky-500/30")}>Nur Firmenkunden</span>}
                    {p.businessOnly && p.allowAccountRequest && (
                      <span className={cn(PILL, "bg-sky-500/10 text-sky-300 ring-sky-500/30")}>Konto-Antrag erlaubt</span>
                    )}
                    <span className={cn(PILL, p.approvalMode === "MANUAL" ? "bg-amber-500/10 text-amber-300 ring-amber-500/30" : "bg-zinc-800/80 text-zinc-300 ring-zinc-700")}>
                      Freigabe: {p.approvalMode === "MANUAL" ? "manuell" : "automatisch"}
                    </span>
                  </div>
                  {p.description && <p className="mt-1.5 max-w-3xl text-sm text-zinc-400">{p.description}</p>}
                  <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-zinc-500">
                    <div className="flex gap-1.5">
                      <dt>Slug:</dt>
                      <dd className="font-mono">{p.slug}</dd>
                    </div>
                    <div className="flex gap-1.5">
                      <dt>Reihenfolge:</dt>
                      <dd className="tabular-nums">{p.sortOrder}</dd>
                    </div>
                    <div className="flex gap-1.5">
                      <dt>Schlüssel:</dt>
                      <dd className="tabular-nums">{p.keyCount}</dd>
                    </div>
                    <div className="flex gap-1.5">
                      <dt>Webspace-Anträge:</dt>
                      <dd className="tabular-nums">{p.requestCount}</dd>
                    </div>
                  </dl>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(p)}>
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                      Bearbeiten
                      <span className="sr-only"> ({p.name})</span>
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      disabled={used}
                      title={used ? "Das Produkt hat Schlüssel oder Anträge. Deaktiviere es stattdessen." : undefined}
                      onClick={() => setToDelete(p)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      Löschen
                      <span className="sr-only"> ({p.name})</span>
                    </Button>
                    {used && <span className="self-center text-xs text-zinc-500">Löschen nur ohne Schlüssel und Anträge möglich.</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Neues Produkt" : "Produkt bearbeiten"}
        description={editing === "new" ? "Slug und Code lassen sich nach dem Anlegen nicht mehr ändern." : undefined}
        size="lg"
      >
        {editing !== null && (
          <ProductForm key={editing === "new" ? "new" : editing.id} product={editing === "new" ? null : editing} onDone={() => setEditing(null)} onCancel={() => setEditing(null)} />
        )}
      </Modal>

      <ConfirmDialog
        open={toDelete !== null}
        title="Produkt löschen?"
        description={toDelete ? `«${toDelete.name}» wird dauerhaft gelöscht. Das kann nicht rückgängig gemacht werden.` : ""}
        confirmLabel="Endgültig löschen"
        danger
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
