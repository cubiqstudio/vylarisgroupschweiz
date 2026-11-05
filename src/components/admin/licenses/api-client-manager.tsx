"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, KeyRound, Pause, Play, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { api } from "@/lib/api-client";
import { cn, formatDateTime } from "@/lib/utils";
import { ConfirmDialog } from "@/components/admin/core/confirm-dialog";
import { Modal } from "@/components/admin/core/modal";
import { Notice } from "@/components/admin/core/notice";
import { PILL } from "@/components/admin/core/styles";
import { useToast } from "@/components/admin/core/toast";
import { describeError } from "@/components/admin/settings/form-utils";
import { CopyField } from "./copy-field";
import type { ApiClientRow } from "./types";

type Created = { id: string; name: string; token: string; signingKey: string };
type ProductOption = { slug: string; name: string };

function CreateForm({
  products,
  onCreated,
  onCancel,
}: {
  products: ProductOption[];
  onCreated: (c: Created) => void;
  onCancel: () => void;
}) {
  const uid = useId();
  const router = useRouter();
  const [name, setName] = useState("");
  const [slugs, setSlugs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setFields({});
    setFormError("");
    try {
      const created = await api<Created>("/api/admin/api-clients", { method: "POST", body: { name, productSlugs: slugs } });
      router.refresh();
      onCreated(created);
    } catch (err) {
      const d = describeError(err, "Der Zugang konnte nicht angelegt werden.");
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
      <Field label="Name" htmlFor={`${uid}-name`} error={fields.name} hint="Wofür der Zugang gedacht ist, z. B. «Autoinstaller Produktion».">
        <Input id={`${uid}-name`} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required data-autofocus />
      </Field>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-zinc-300">Produktbeschränkung</legend>
        <p className="text-xs text-zinc-500">
          {slugs.length === 0 ? "Keine Auswahl: der Zugang darf alle Produkte prüfen." : "Der Zugang darf nur die gewählten Produkte prüfen."}
        </p>
        {products.length === 0 ? (
          <p className="text-sm text-zinc-500">Es sind noch keine Produkte angelegt.</p>
        ) : (
          <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
            {products.map((p) => {
              const id = `${uid}-p-${p.slug}`;
              return (
                <div key={p.slug} className="flex items-center gap-3">
                  <input
                    id={id}
                    type="checkbox"
                    checked={slugs.includes(p.slug)}
                    onChange={(e) => setSlugs((s) => (e.target.checked ? [...s, p.slug] : s.filter((x) => x !== p.slug)))}
                    className="h-4 w-4 rounded border-zinc-600 bg-surface accent-emerald-400"
                  />
                  <label htmlFor={id} className="text-sm text-zinc-300">
                    {p.name} <span className="font-mono text-xs text-zinc-500">{p.slug}</span>
                  </label>
                </div>
              );
            })}
          </div>
        )}
        {fields.productSlugs && (
          <p role="alert" className="text-xs text-rose-400">
            {fields.productSlugs}
          </p>
        )}
      </fieldset>
      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
          Abbrechen
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Lege an …" : "Zugang anlegen"}
        </Button>
      </div>
    </form>
  );
}

function Secrets({ created, onClose }: { created: Created; onClose: () => void }) {
  const [saved, setSaved] = useState(false);
  const id = useId();
  return (
    <div className="space-y-4">
      <Notice variant="warning">
        <strong className="font-semibold">Wird nicht noch einmal angezeigt.</strong> Kopiere Token und Signierschlüssel jetzt und speichere sie sicher (z. B. in einem Passwort-Manager).
        Geht etwas verloren, musst du den Zugang widerrufen und einen neuen anlegen.
      </Notice>
      <CopyField label="Token (Authorization: Bearer …)" value={created.token} />
      <CopyField label="Signierschlüssel (zum Prüfen der Antwort-Signatur)" value={created.signingKey} />
      <div className="flex items-start gap-3">
        <input id={id} type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-zinc-600 bg-surface accent-emerald-400" />
        <label htmlFor={id} className="text-sm text-zinc-300">
          Ich habe beide Werte sicher gespeichert.
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

function Guide() {
  // Der Ursprung steht erst im Browser fest; bis dahin ein Platzhalter.
  const [origin, setOrigin] = useState("https://<deine-domain>");
  useEffect(() => setOrigin(window.location.origin), []);

  const curl = `NONCE=$(openssl rand -hex 16)

curl -sS -X POST ${origin}/api/licenses/verify \\
  -H "Authorization: Bearer vgsk_…" \\
  -H "Content-Type: application/json" \\
  -d '{"key":"VGS-WEB-XXXXX-XXXXX-XXXXX-XXXXX","product":"webspace","instance":"meine-domain.example","nonce":"'"$NONCE"'"}'`;

  const verify = `# Antwort-Signatur prüfen (Signierschlüssel = Text, nicht hex-dekodiert)
PAYLOAD="<valid 1/0>|<reason>|<product>|<status>|<instance>|<nonce>|<ts>"
printf '%s' "$PAYLOAD" | openssl dgst -sha256 -hmac "$SIGNING_KEY"`;

  return (
    <Card className="mt-6 p-5">
      <h2 className="text-sm font-semibold text-white">Prüf-API verwenden</h2>
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-zinc-400">
        <li>
          Endpunkt: <code className="font-mono text-zinc-200 [overflow-wrap:anywhere]">POST /api/licenses/verify</code>. Das Token kommt in den Header <code className="font-mono text-zinc-200 [overflow-wrap:anywhere]">Authorization: Bearer …</code>, der Schlüssel nur in den JSON-Body (nie in die URL).
        </li>
        <li>
          Pflichtfelder: <code className="font-mono text-zinc-200 [overflow-wrap:anywhere]">key</code>, <code className="font-mono text-zinc-200 [overflow-wrap:anywhere]">product</code> (Slug) und <code className="font-mono text-zinc-200 [overflow-wrap:anywhere]">nonce</code> (8–64 Zeichen aus A–Z, a–z, 0–9, _ und -, pro Anfrage neu). Optional: <code className="font-mono text-zinc-200 [overflow-wrap:anywhere]">instance</code> (Domain oder Kennung der Installation).
        </li>
        <li>
          Beim ersten erfolgreichen Prüfen mit <code className="font-mono text-zinc-200 [overflow-wrap:anywhere]">instance</code> wird der Schlüssel an diese Installation gebunden. Danach muss dieselbe Kennung mitgeschickt werden; die Bindung lässt sich unter «Schlüssel» lösen.
        </li>
        <li>
          Antwort in <code className="font-mono text-zinc-200 [overflow-wrap:anywhere]">data</code>: <code className="font-mono text-zinc-200 [overflow-wrap:anywhere]">valid</code>, <code className="font-mono text-zinc-200 [overflow-wrap:anywhere]">reason</code> (<code className="font-mono text-zinc-200 [overflow-wrap:anywhere]">invalid</code>, <code className="font-mono text-zinc-200 [overflow-wrap:anywhere]">revoked</code>, <code className="font-mono text-zinc-200 [overflow-wrap:anywhere]">instance_mismatch</code> oder <code className="font-mono text-zinc-200 [overflow-wrap:anywhere]">instance_required</code>), <code className="font-mono text-zinc-200 [overflow-wrap:anywhere]">product</code>, <code className="font-mono text-zinc-200 [overflow-wrap:anywhere]">status</code>, <code className="font-mono text-zinc-200 [overflow-wrap:anywhere]">instance</code>, <code className="font-mono text-zinc-200 [overflow-wrap:anywhere]">nonce</code>, <code className="font-mono text-zinc-200 [overflow-wrap:anywhere]">ts</code> und <code className="font-mono text-zinc-200 [overflow-wrap:anywhere]">signature</code>.
        </li>
        <li>
          Die Signatur ist ein HMAC-SHA256 (hex) über <code className="font-mono text-zinc-200 [overflow-wrap:anywhere]">valid|reason|product|status|instance|nonce|ts</code> (<code className="font-mono text-zinc-200 [overflow-wrap:anywhere]">valid</code> als 1 oder 0, leere Werte als leerer Text). Prüfe sie mit dem Signierschlüssel, vergleiche die <code className="font-mono text-zinc-200 [overflow-wrap:anywhere]">nonce</code> mit der gesendeten und lehne alte <code className="font-mono text-zinc-200 [overflow-wrap:anywhere]">ts</code>-Werte ab.
        </li>
        <li>Unbekannte, abgelehnte oder wartende Schlüssel liefern bewusst dasselbe «invalid». Es gelten Rate-Limits; bei 429 wartest du die Zeit aus <code className="font-mono text-zinc-200 [overflow-wrap:anywhere]">Retry-After</code> ab.</li>
      </ul>
      <div className="mt-4 space-y-4">
        <CopyField label="Beispiel: Anfrage mit curl" value={curl} multiline />
        <CopyField label="Beispiel: Signatur prüfen" value={verify} multiline />
      </div>
    </Card>
  );
}

export function ApiClientManager({ clients, products }: { clients: ApiClientRow[]; products: ProductOption[] }) {
  const router = useRouter();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);
  const [toRevoke, setToRevoke] = useState<ApiClientRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const productName = (slug: string) => products.find((p) => p.slug === slug)?.name ?? slug;

  async function revoke() {
    if (!toRevoke) return;
    setBusyId(toRevoke.id);
    try {
      await api(`/api/admin/api-clients/${encodeURIComponent(toRevoke.id)}`, { method: "DELETE" });
      toast.success(`Zugang «${toRevoke.name}» wurde widerrufen.`);
      setToRevoke(null);
      router.refresh();
    } catch (err) {
      toast.error(describeError(err, "Der Zugang konnte nicht widerrufen werden.").message);
      setToRevoke(null);
    } finally {
      setBusyId(null);
    }
  }

  async function toggle(c: ApiClientRow) {
    setBusyId(c.id);
    try {
      await api(`/api/admin/api-clients/${encodeURIComponent(c.id)}`, { method: "PATCH", body: { active: !c.active } });
      toast.success(c.active ? `Zugang «${c.name}» pausiert.` : `Zugang «${c.name}» wieder aktiv.`);
      router.refresh();
    } catch (err) {
      toast.error(describeError(err, "Die Aktion ist fehlgeschlagen.").message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button type="button" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Neuer Zugang
        </Button>
      </div>

      {clients.length === 0 ? (
        <Card className="flex flex-col items-center px-6 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800/80 text-zinc-400 ring-1 ring-inset ring-zinc-700">
            <KeyRound className="h-5 w-5" aria-hidden />
          </span>
          <h2 className="mt-4 text-lg font-semibold text-white">Noch keine API-Zugänge</h2>
          <p className="mt-1.5 max-w-sm text-sm text-zinc-400">Programme wie der Autoinstaller brauchen einen Zugang, um Schlüssel zu prüfen.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-zinc-800">
            {clients.map((c) => (
              <li key={c.id} className="px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                  <h2 className="text-sm font-semibold text-white sm:text-base">{c.name}</h2>
                  <span
                    className={cn(
                      PILL,
                      c.revoked ? "bg-rose-500/10 text-rose-300 ring-rose-500/30" : c.active ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30" : "bg-amber-500/10 text-amber-300 ring-amber-500/30",
                    )}
                  >
                    {c.revoked ? "Widerrufen" : c.active ? "Aktiv" : "Pausiert"}
                  </span>
                </div>
                <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-zinc-500">
                  <div className="flex gap-1.5">
                    <dt>Token beginnt mit:</dt>
                    <dd className="font-mono text-zinc-400">{c.tokenHint}…</dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt>Produkte:</dt>
                    <dd>{c.productSlugs === "*" ? "alle" : c.productSlugs.map(productName).join(", ")}</dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt>Angelegt:</dt>
                    <dd>
                      <time dateTime={c.createdAt}>{formatDateTime(c.createdAt)}</time>
                    </dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt>Zuletzt genutzt:</dt>
                    <dd>{c.lastUsedAt ? <time dateTime={c.lastUsedAt}>{formatDateTime(c.lastUsedAt)}</time> : "noch nie"}</dd>
                  </div>
                </dl>
                {!c.revoked && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Button type="button" variant="secondary" size="sm" disabled={busyId !== null} onClick={() => toggle(c)}>
                      {c.active ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
                      {c.active ? "Pausieren" : "Aktivieren"}
                      <span className="sr-only"> ({c.name})</span>
                    </Button>
                    <Button type="button" variant="danger" size="sm" disabled={busyId !== null} onClick={() => setToRevoke(c)}>
                      <Ban className="h-4 w-4" aria-hidden="true" />
                      Widerrufen
                      <span className="sr-only"> ({c.name})</span>
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Guide />

      <Modal open={creating && !created} onClose={() => setCreating(false)} title="Neuer API-Zugang" description="Token und Signierschlüssel werden nach dem Anlegen genau einmal angezeigt." size="md">
        {creating && !created && (
          <CreateForm
            products={products}
            onCreated={(c) => setCreated(c)}
            onCancel={() => setCreating(false)}
          />
        )}
      </Modal>

      <Modal
        open={created !== null}
        onClose={() => undefined}
        dismissible={false}
        title={created ? `Zugang «${created.name}» angelegt` : "Zugang angelegt"}
        description="Diese Werte siehst du nur jetzt."
        size="md"
      >
        {created && (
          <Secrets
            created={created}
            onClose={() => {
              setCreated(null);
              setCreating(false);
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={toRevoke !== null}
        title="Zugang widerrufen?"
        description={
          toRevoke
            ? `Das Token von «${toRevoke.name}» funktioniert danach nie wieder. Programme, die es verwenden, können Schlüssel nicht mehr prüfen. Das kann nicht rückgängig gemacht werden.`
            : ""
        }
        confirmLabel="Endgültig widerrufen"
        danger
        busy={busyId !== null}
        onConfirm={revoke}
        onCancel={() => setToRevoke(null)}
      />
    </>
  );
}
