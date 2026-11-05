"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Pencil, Plus, Trash2, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { api } from "@/lib/api-client";
import { canTouchAccount, rolesOf } from "@/lib/verein/access-lib";
import { formatDateTimeCh } from "@/lib/verein/dates";
import { ADMIN_ROLE_LABEL, ADMIN_ROLE_VALUES, type AdminRoleValue } from "@/lib/verein/permissions";
import { ConfirmDialog } from "@/components/admin/core/confirm-dialog";
import { Modal } from "@/components/admin/core/modal";
import { Notice } from "@/components/admin/core/notice";
import { PILL } from "@/components/admin/core/styles";
import { useToast } from "@/components/admin/core/toast";
import { EmptyState } from "@/components/admin/licenses/empty-state";
import { CopyField } from "@/components/admin/licenses/copy-field";
import { MemberPicker, type PickedMember } from "@/components/admin/members/member-picker";
import { describeError } from "@/components/admin/settings/form-utils";

export type AccessRowDto = {
  id: string;
  email: string;
  name: string;
  role: string;
  extraRoles: string[];
  roles: AdminRoleValue[];
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  member: { id: string; memberNumber: number; name: string; status: string } | null;
  suggestedRoles: AdminRoleValue[];
};

const ROLE_TONE = "bg-indigo-500/10 text-indigo-300 ring-indigo-500/30";

function RolePills({ roles }: { roles: readonly string[] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {roles.map((r) => (
        <span key={r} className={`${PILL} ${ROLE_TONE}`}>
          {(ADMIN_ROLE_LABEL as Record<string, string>)[r] ?? r}
        </span>
      ))}
    </span>
  );
}

type FormState = { name: string; email: string; role: string; extra: string[]; member: PickedMember | null };

function AccessDialog({
  open,
  onClose,
  account,
  isSelf,
  roleHints,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  account?: AccessRowDto;
  isSelf: boolean;
  roleHints: Record<string, string>;
  onCreated: (email: string, password: string) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState<FormState>(() => ({
    name: account?.name ?? "",
    email: account?.email ?? "",
    role: account?.role ?? "REVISOR",
    extra: account?.extraRoles ?? [],
    member: account?.member ? { id: account.member.id, memberNumber: account.member.memberNumber, name: account.member.name, city: "" } : null,
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const toggleExtra = (r: string) => setForm((f) => ({ ...f, extra: f.extra.includes(r) ? f.extra.filter((x) => x !== r) : [...f.extra, r] }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErrors({});
    setFormError(null);
    try {
      const extraRoles = form.extra.filter((r) => r !== form.role);
      if (account) {
        await api(`/api/admin/access/${encodeURIComponent(account.id)}`, {
          method: "PATCH",
          body: { name: form.name, ...(isSelf ? {} : { role: form.role, extraRoles }), memberId: form.member?.id ?? null },
        });
        toast.success("Der Zugang wurde geändert.");
        onClose();
      } else {
        const res = await api<{ id: string; tempPassword: string }>("/api/admin/access", {
          method: "POST",
          body: { name: form.name, email: form.email, role: form.role, extraRoles, memberId: form.member?.id ?? null },
        });
        toast.success("Der Zugang wurde angelegt.");
        onClose();
        onCreated(form.email, res.tempPassword);
      }
      router.refresh();
    } catch (err) {
      const d = describeError(err, "Der Zugang konnte nicht gespeichert werden.");
      setErrors(d.fields);
      setFormError(d.message);
    } finally {
      setBusy(false);
    }
  }

  const effective = rolesOf({ role: form.role, extraRoles: form.extra });
  return (
    <Modal open={open} onClose={() => !busy && onClose()} title={account ? "Zugang bearbeiten" : "Zugang anlegen"} description={account ? account.email : "Ein Zugang gibt Zutritt zur Verwaltung. Das Amt im Verein gibt keinen Zugriff: Er richtet sich nach den Rollen."} size="md" dismissible={!busy}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && <Notice variant="error">{formError}</Notice>}
        <Field label="Name" htmlFor="acc-name" error={errors.name}>
          <Input id="acc-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={80} disabled={busy} autoComplete="off" aria-invalid={errors.name ? true : undefined} />
        </Field>
        {!account && (
          <Field label="E-Mail-Adresse" htmlFor="acc-email" error={errors.email} hint="Damit meldet sich die Person an.">
            <Input id="acc-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={254} disabled={busy} autoComplete="off" aria-invalid={errors.email ? true : undefined} />
          </Field>
        )}
        <Field label="Hauptrolle" htmlFor="acc-role" error={errors.role} hint={roleHints[form.role]}>
          <Select id="acc-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} disabled={busy || isSelf}>
            {ADMIN_ROLE_VALUES.map((r) => (
              <option key={r} value={r}>
                {ADMIN_ROLE_LABEL[r]}
              </option>
            ))}
          </Select>
        </Field>
        <fieldset className="space-y-2" disabled={busy || isSelf}>
          <legend className="text-sm font-medium text-zinc-300">Zusätzliche Rollen</legend>
          <p className="text-xs text-zinc-500">Für Personen mit mehreren Ämtern, z. B. Vize-Präsident und Kassier. Es gilt die höchste Stufe je Bereich.</p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {ADMIN_ROLE_VALUES.filter((r) => r !== form.role).map((r) => (
              <label key={r} className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                <input type="checkbox" checked={form.extra.includes(r)} onChange={() => toggleExtra(r)} className="h-4 w-4 rounded border-zinc-700 accent-emerald-400" />
                {ADMIN_ROLE_LABEL[r]}
              </label>
            ))}
          </div>
          {errors.extraRoles && <p role="alert" className="text-xs text-rose-400">{errors.extraRoles}</p>}
        </fieldset>
        {isSelf && <Notice variant="info">Deine eigenen Rollen kannst du nicht ändern. Bitte eine andere Person mit vollem Zugriff darum.</Notice>}
        <p className="text-xs text-zinc-500">
          Wirksam: <strong className="text-zinc-300">{effective.map((r) => ADMIN_ROLE_LABEL[r]).join(", ")}</strong>
        </p>
        <MemberPicker label="Verknüpftes Mitglied (optional)" value={form.member} onChange={(m) => setForm({ ...form, member: m })} error={errors.memberId} disabled={busy} />
        <p className="text-xs text-zinc-500">Die Verknüpfung ordnet dem Zugang die Person im Verein zu (Aufgaben, Mitgliederportal, Anzeige im Protokoll). Ein Mitglied kann nur mit einem Zugang verknüpft sein.</p>
        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Abbrechen
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Bitte warten …" : account ? "Speichern" : "Zugang anlegen"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function PasswordDialog({ info, onClose }: { info: { email: string; password: string; reset: boolean } | null; onClose: () => void }) {
  return (
    <Modal open={info !== null} onClose={onClose} title={info?.reset ? "Neues Startpasswort" : "Startpasswort"} description={info ? `Für ${info.email}` : undefined} size="sm">
      {info && (
        <div className="space-y-4">
          <Notice variant="warning">Dieses Passwort wird nur jetzt angezeigt. Gib es der Person auf sicherem Weg weiter. Sie muss es bei der ersten Anmeldung ändern.</Notice>
          <CopyField label="Startpasswort" value={info.password} />
          <div className="flex justify-end">
            <Button type="button" onClick={onClose} data-autofocus>
              Fertig
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/** `roleHints`: Erklärung je Rolle aus der wirksamen Rechtematrix (roleHint), vom Server berechnet. */
export function AccessManager({ rows, selfId, selfRoles, roleHints, canWrite }: { rows: AccessRowDto[]; selfId: string; selfRoles: readonly string[]; roleHints: Record<string, string>; canWrite: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [dialog, setDialog] = useState<{ account?: AccessRowDto } | null>(null);
  const [password, setPassword] = useState<{ email: string; password: string; reset: boolean } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AccessRowDto | null>(null);
  const [confirmReset, setConfirmReset] = useState<AccessRowDto | null>(null);
  const [busy, setBusy] = useState(false);

  const actor = { id: selfId, roles: selfRoles };

  async function remove(account: AccessRowDto) {
    setBusy(true);
    try {
      await api(`/api/admin/access/${encodeURIComponent(account.id)}`, { method: "DELETE" });
      toast.success("Der Zugang wurde gelöscht.");
      setConfirmDelete(null);
      router.refresh();
    } catch (err) {
      setConfirmDelete(null);
      toast.error(describeError(err, "Der Zugang konnte nicht gelöscht werden.").message);
    } finally {
      setBusy(false);
    }
  }

  async function reset(account: AccessRowDto) {
    setBusy(true);
    try {
      const res = await api<{ tempPassword: string }>(`/api/admin/access/${encodeURIComponent(account.id)}/password`, { method: "POST" });
      setConfirmReset(null);
      setPassword({ email: account.email, password: res.tempPassword, reset: true });
      router.refresh();
    } catch (err) {
      setConfirmReset(null);
      toast.error(describeError(err, "Das Passwort konnte nicht zurückgesetzt werden.").message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {canWrite && (
        <div className="mb-4 flex justify-end">
          <Button type="button" onClick={() => setDialog({})}>
            <Plus className="h-4 w-4" aria-hidden />
            Zugang anlegen
          </Button>
        </div>
      )}
      {!canWrite && <Notice variant="info" className="mb-4">Du kannst die Zugänge ansehen, aber nicht ändern. Das dürfen nur Inhaber und Administratoren.</Notice>}

      {rows.length === 0 ? (
        <EmptyState icon={UserCog} title="Noch keine Zugänge" text="Lege den ersten Zugang an, damit Vorstandsmitglieder die Verwaltung nutzen können." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto" role="region" aria-label="Zugänge" tabIndex={0}>
            <table className="w-full min-w-[48rem] text-left text-sm">
              <caption className="sr-only">Zugänge zur Verwaltung mit ihren Rollen</caption>
              <thead className="border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Person</th>
                  <th scope="col" className="px-4 py-3 font-medium">Rollen</th>
                  <th scope="col" className="px-4 py-3 font-medium">Mitglied</th>
                  <th scope="col" className="px-4 py-3 font-medium">Letzte Anmeldung</th>
                  {canWrite && (
                    <th scope="col" className="px-4 py-3 text-right font-medium">
                      <span className="sr-only">Aktionen</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800 align-top">
                {rows.map((a) => {
                  const isSelf = a.id === selfId;
                  const touchable = canTouchAccount(actor, { id: a.id, role: a.role, extraRoles: a.extraRoles.join(",") });
                  return (
                    <tr key={a.id} className="hover:bg-zinc-900/40">
                      <td className="px-4 py-3">
                        <div className="font-medium text-zinc-100">
                          {a.name} {isSelf && <span className="text-xs font-normal text-zinc-500">(du)</span>}
                        </div>
                        <div className="break-all text-xs text-zinc-500">{a.email}</div>
                        {a.mustChangePassword && <div className="mt-1 text-xs text-amber-300">Muss das Passwort noch ändern</div>}
                      </td>
                      <td className="px-4 py-3">
                        <RolePills roles={a.roles} />
                        {a.suggestedRoles.length > 0 && (
                          <p className="mt-1.5 max-w-56 text-xs text-zinc-500">
                            Hinweis: Das Mitglied hat ein Amt als {a.suggestedRoles.map((r) => ADMIN_ROLE_LABEL[r]).join(", ")}. Die passende Rolle fehlt (nur ein Vorschlag, der Vorstand entscheidet).
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-300">{a.member ? `${a.member.name} (Nr. ${a.member.memberNumber})` : <span className="text-zinc-600">–</span>}</td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-zinc-400">{a.lastLoginAt ? formatDateTimeCh(new Date(a.lastLoginAt)) : "noch nie"}</td>
                      {canWrite && (
                        <td className="px-4 py-3">
                          {touchable ? (
                            <div className="flex justify-end gap-1.5">
                              <Button type="button" variant="secondary" size="sm" onClick={() => setDialog({ account: a })}>
                                <Pencil className="h-3.5 w-3.5" aria-hidden />
                                Bearbeiten
                                <span className="sr-only"> ({a.name})</span>
                              </Button>
                              {!isSelf && (
                                <>
                                  <Button type="button" variant="secondary" size="sm" onClick={() => setConfirmReset(a)}>
                                    <KeyRound className="h-3.5 w-3.5" aria-hidden />
                                    Passwort
                                    <span className="sr-only"> zurücksetzen ({a.name})</span>
                                  </Button>
                                  <Button type="button" variant="danger" size="sm" onClick={() => setConfirmDelete(a)}>
                                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                                    <span className="sr-only">Löschen ({a.name})</span>
                                  </Button>
                                </>
                              )}
                            </div>
                          ) : (
                            <p className="text-right text-xs text-zinc-600">Nur ein Inhaber</p>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {dialog && (
        <AccessDialog
          key={dialog.account?.id ?? "neu"}
          open
          onClose={() => setDialog(null)}
          account={dialog.account}
          isSelf={dialog.account?.id === selfId}
          roleHints={roleHints}
          onCreated={(email, pw) => setPassword({ email, password: pw, reset: false })}
        />
      )}
      <PasswordDialog info={password} onClose={() => setPassword(null)} />
      <ConfirmDialog
        open={confirmDelete !== null}
        title="Zugang löschen?"
        description={confirmDelete ? `Der Zugang von ${confirmDelete.name} (${confirmDelete.email}) wird gelöscht. Die Person kann sich nicht mehr anmelden. Das Mitglied im Verzeichnis bleibt bestehen.` : ""}
        confirmLabel="Löschen"
        danger
        busy={busy}
        onConfirm={() => confirmDelete && remove(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
      <ConfirmDialog
        open={confirmReset !== null}
        title="Passwort zurücksetzen?"
        description={confirmReset ? `Für ${confirmReset.name} wird ein neues Startpasswort erzeugt. Bestehende Sitzungen enden sofort, und die Person muss das Passwort bei der nächsten Anmeldung ändern.` : ""}
        confirmLabel="Zurücksetzen"
        busy={busy}
        onConfirm={() => confirmReset && reset(confirmReset)}
        onCancel={() => setConfirmReset(null)}
      />
    </div>
  );
}
