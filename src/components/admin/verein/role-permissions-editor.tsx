"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/form";
import { api } from "@/lib/api-client";
import {
  ADMIN_ROLE_LABEL,
  ADMIN_ROLE_VALUES,
  CONFIGURABLE_ROLES,
  MODULE_LABEL,
  MODULE_SHORT_LABEL,
  ROLE_FLAGS,
  ROLE_FLAG_HINT,
  ROLE_FLAG_LABEL,
  VEREIN_MODULES,
  describeAccess,
  isAllowedLevel,
  resolveMatrix,
  roleHint,
  type AdminRoleValue,
  type ConfigurableLevel,
  type ConfigurableRole,
  type RoleFlag,
  type VereinModule,
} from "@/lib/verein/permissions";
import { ConfirmDialog } from "@/components/admin/core/confirm-dialog";
import { Notice } from "@/components/admin/core/notice";
import { useToast } from "@/components/admin/core/toast";
import { describeError } from "@/components/admin/settings/form-utils";
import { cn } from "@/lib/utils";

export type RolePermissionsState = {
  levels: Record<string, Record<string, ConfigurableLevel>>;
  flags: Record<string, Record<string, boolean>>;
};

type Props = {
  /** Gespeicherte (wirksame) Einstellung und Voreinstellung, vom Server aus der Rechtematrix berechnet. */
  current: RolePermissionsState;
  defaults: RolePermissionsState;
  canWrite: boolean;
};

const LEVEL_LABEL: Record<ConfigurableLevel, string> = { none: "Kein Zugriff", read: "Lesen", write: "Ändern" };
/** «Eigenes Konto» ist fest («Ändern») und wird nicht angeboten. */
const EDITABLE_MODULES = VEREIN_MODULES.filter((m) => m !== "self");

const clone = (s: RolePermissionsState): RolePermissionsState => ({
  levels: Object.fromEntries(Object.entries(s.levels).map(([r, row]) => [r, { ...row }])),
  flags: Object.fromEntries(Object.entries(s.flags).map(([r, row]) => [r, { ...row }])),
});

const levelOf = (s: RolePermissionsState, role: string, module: VereinModule): ConfigurableLevel => s.levels[role]?.[module] ?? "none";
const flagOf = (s: RolePermissionsState, role: string, flag: RoleFlag): boolean => s.flags[role]?.[flag] === true;

function sameRole(a: RolePermissionsState, b: RolePermissionsState, role: string): boolean {
  return EDITABLE_MODULES.every((m) => levelOf(a, role, m) === levelOf(b, role, m)) && ROLE_FLAGS.every((f) => flagOf(a, role, f) === flagOf(b, role, f));
}

function LevelSelect({
  role,
  module,
  value,
  onChange,
  disabled,
  changed,
  idPrefix,
}: {
  role: ConfigurableRole;
  module: VereinModule;
  value: ConfigurableLevel;
  onChange: (next: ConfigurableLevel) => void;
  disabled: boolean;
  changed: boolean;
  idPrefix: string;
}) {
  const options = (["none", "read", "write"] as const).filter((l) => isAllowedLevel(role, module, l));
  return (
    <Select
      id={`${idPrefix}-${role}-${module}`}
      aria-label={`${ADMIN_ROLE_LABEL[role]}: ${MODULE_LABEL[module]}`}
      value={value}
      onChange={(e) => onChange(e.target.value as ConfigurableLevel)}
      disabled={disabled || options.length < 2}
      className={cn("h-9 min-w-[7.5rem] px-2 text-xs", changed && "border-amber-400/60")}
    >
      {options.map((l) => (
        <option key={l} value={l}>
          {LEVEL_LABEL[l]}
        </option>
      ))}
    </Select>
  );
}

/** Einzelrecht, das ohne Zugriff auf die Kasse nichts bewirkt (Geschäftsjahr abschliessen). */
const flagInactive = (s: RolePermissionsState, role: string, flag: RoleFlag): boolean => flag === "fiscalYearClose" && flagOf(s, role, flag) && levelOf(s, role, "ledger") === "none";
const INACTIVE_NOTE = "Wirkt nicht: kein Zugriff auf die Kasse";

function FlagSwitch({ role, flag, value, onChange, disabled, idPrefix, inactive = false }: { role: ConfigurableRole; flag: RoleFlag; value: boolean; onChange: (v: boolean) => void; disabled: boolean; idPrefix: string; inactive?: boolean }) {
  const id = `${idPrefix}-${role}-${flag}`;
  return (
    <div className="inline-flex flex-col items-center gap-1">
      <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
        <input
          id={id}
          type="checkbox"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="h-5 w-5 rounded border-zinc-600 accent-emerald-500"
          aria-label={`${ADMIN_ROLE_LABEL[role]}: ${ROLE_FLAG_LABEL[flag]}`}
          aria-describedby={inactive ? `${id}-note` : undefined}
        />
        <span aria-hidden>{value ? "Ja" : "Nein"}</span>
      </label>
      {inactive && (
        <span id={`${id}-note`} className="max-w-32 text-center text-[11px] leading-tight text-amber-300">
          {INACTIVE_NOTE}
        </span>
      )}
    </div>
  );
}

/** Rollen und Rechte einstellen: Tabelle Rollen × Bereiche (ab mittlerer Breite) bzw. eine Karte je Rolle (Mobil), Einzelrechte, Vorschau. */
export function RolePermissionsEditor({ current, defaults, canWrite }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [saved, setSaved] = useState<RolePermissionsState>(() => clone(current));
  const [draft, setDraft] = useState<RolePermissionsState>(() => clone(current));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [previewRoles, setPreviewRoles] = useState<AdminRoleValue[]>(["KASSIER"]);

  const dirty = useMemo(() => CONFIGURABLE_ROLES.some((r) => !sameRole(draft, saved, r)), [draft, saved]);
  const savedIsDefault = useMemo(() => CONFIGURABLE_ROLES.every((r) => sameRole(saved, defaults, r)), [saved, defaults]);
  // Wirksame Matrix des Entwurfs: dieselbe Funktion wie auf dem Server (Schranken inklusive).
  const matrix = useMemo(() => resolveMatrix({ levels: draft.levels, flags: draft.flags }), [draft]);
  const dis = busy || !canWrite;

  function setLevel(role: ConfigurableRole, module: VereinModule, level: ConfigurableLevel) {
    setDraft((d) => {
      const next = clone(d);
      (next.levels[role] ??= {})[module] = level;
      return next;
    });
  }
  function setFlag(role: ConfigurableRole, flag: RoleFlag, value: boolean) {
    setDraft((d) => {
      const next = clone(d);
      (next.flags[role] ??= {})[flag] = value;
      return next;
    });
  }
  function resetRole(role: ConfigurableRole) {
    setDraft((d) => {
      const next = clone(d);
      next.levels[role] = { ...defaults.levels[role] };
      next.flags[role] = { ...defaults.flags[role] };
      return next;
    });
  }

  async function persist(state: RolePermissionsState, okMessage: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ current: RolePermissionsState; changed: boolean }>("/api/admin/settings/verein/rollen", {
        method: "PUT",
        body: { levels: state.levels, flags: state.flags },
      });
      setSaved(clone(res.current));
      setDraft(clone(res.current));
      toast.success(res.changed ? okMessage : "Es gab nichts zu ändern.");
      router.refresh();
    } catch (err) {
      setError(describeError(err, "Die Rechte konnten nicht gespeichert werden.").message);
    } finally {
      setBusy(false);
    }
  }

  async function resetAll() {
    setConfirmAll(false);
    await persist(clone(defaults), "Alle Rollen sind wieder auf der Voreinstellung.");
  }

  const summary = useMemo(() => describeAccess(previewRoles, matrix), [previewRoles, matrix]);
  const list = (mods: VereinModule[]) => (mods.length > 0 ? mods.map((m) => MODULE_SHORT_LABEL[m]).join(", ") : "nichts");

  return (
    <div className="grid max-w-6xl gap-6">
      {!canWrite && <Notice variant="info">Du kannst die Rechte ansehen, aber nicht ändern. Das dürfen nur Inhaber und Administration.</Notice>}
      {error && <Notice variant="error">{error}</Notice>}

      <Notice variant="warning">
        <p className="font-medium">Statuten gehen vor.</p>
        <p className="mt-1">
          Diese Einstellung ist eine technische Hilfe für die Aufgabenverteilung im Vorstand. Was die Statuten oder die Versammlung anders regeln, gilt vor.
          Inhaber und Administration dürfen immer alles und lassen sich nicht einschränken. «System» (Zugänge, Mailserver, Registrierung, Impressum und diese Seite)
          können andere Rollen höchstens lesen, nie ändern. «Eigenes Konto» (Passwort) und «Übersicht» bleiben für alle bestehen.
        </p>
      </Notice>

      {/* Mobil: eine Karte je Rolle */}
      <div className="grid gap-4 md:hidden">
        {CONFIGURABLE_ROLES.map((role) => (
          <Card key={role} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-white">{ADMIN_ROLE_LABEL[role]}</h3>
                <p className="mt-1 text-xs text-zinc-500">{roleHint(role, matrix)}</p>
              </div>
              {canWrite && (
                <Button type="button" variant="ghost" size="sm" onClick={() => resetRole(role)} disabled={dis || sameRole(draft, defaults, role)} className="shrink-0">
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                  Zurücksetzen
                </Button>
              )}
            </div>
            <ul className="mt-3 divide-y divide-zinc-800">
              {EDITABLE_MODULES.map((m) => (
                <li key={m} className="grid grid-cols-[1fr_8.5rem] items-center gap-3 py-2">
                  <span className="min-w-0 text-xs text-zinc-300">{MODULE_LABEL[m]}</span>
                  <LevelSelect role={role} module={m} value={levelOf(draft, role, m)} onChange={(l) => setLevel(role, m, l)} disabled={dis} changed={levelOf(draft, role, m) !== levelOf(defaults, role, m)} idPrefix="m" />
                </li>
              ))}
              {ROLE_FLAGS.map((f) => (
                <li key={f} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 text-xs text-zinc-300">{ROLE_FLAG_LABEL[f]}</span>
                  <FlagSwitch role={role} flag={f} value={flagOf(draft, role, f)} onChange={(v) => setFlag(role, f, v)} disabled={dis} idPrefix="m" inactive={flagInactive(draft, role, f)} />
                </li>
              ))}
            </ul>
          </Card>
        ))}
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-white">Inhaber und Administrator</h3>
          <p className="mt-1 text-xs text-zinc-500">{roleHint("OWNER")} Fest, nicht einstellbar.</p>
        </Card>
      </div>

      {/* Ab mittlerer Breite: Tabelle Rollen × Bereiche */}
      <Card className="hidden overflow-hidden md:block">
        <div className="overflow-x-auto" role="region" aria-label="Rechte je Rolle und Bereich" tabIndex={0}>
          <table className="w-full min-w-[68rem] text-left text-xs">
            <caption className="sr-only">Rechte je Rolle und Bereich einstellen</caption>
            <thead className="border-b border-zinc-800 text-zinc-500">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Bereich</th>
                <th scope="col" className="px-2 py-2 text-center font-medium">Inhaber, Administrator</th>
                {CONFIGURABLE_ROLES.map((r) => (
                  <th key={r} scope="col" className="px-2 py-2 text-center font-medium">
                    {ADMIN_ROLE_LABEL[r].replace(" (nur lesen)", "")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {EDITABLE_MODULES.map((m) => (
                <tr key={m}>
                  <th scope="row" className="px-3 py-1.5 text-left font-normal text-zinc-300">{MODULE_LABEL[m]}</th>
                  <td className="px-2 py-1.5 text-center font-semibold text-emerald-400">Ändern</td>
                  {CONFIGURABLE_ROLES.map((r) => (
                    <td key={r} className="min-w-[8.5rem] px-1.5 py-1.5">
                      <LevelSelect role={r} module={m} value={levelOf(draft, r, m)} onChange={(l) => setLevel(r, m, l)} disabled={dis} changed={levelOf(draft, r, m) !== levelOf(defaults, r, m)} idPrefix="t" />
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="bg-zinc-900/40">
                <th scope="rowgroup" colSpan={2 + CONFIGURABLE_ROLES.length} className="px-3 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  Einzelrechte
                </th>
              </tr>
              {ROLE_FLAGS.map((f) => (
                <tr key={f}>
                  <th scope="row" className="px-3 py-1.5 text-left font-normal text-zinc-300">
                    {ROLE_FLAG_LABEL[f]}
                    <span className="block text-[11px] text-zinc-500">{ROLE_FLAG_HINT[f]}</span>
                  </th>
                  <td className="px-2 py-1.5 text-center font-semibold text-emerald-400">Ja</td>
                  {CONFIGURABLE_ROLES.map((r) => (
                    <td key={r} className="px-2 py-1.5 text-center">
                      <FlagSwitch role={r} flag={f} value={flagOf(draft, r, f)} onChange={(v) => setFlag(r, f, v)} disabled={dis} idPrefix="t" inactive={flagInactive(draft, r, f)} />
                    </td>
                  ))}
                </tr>
              ))}
              {canWrite && (
                <tr>
                  <th scope="row" className="px-3 py-2 text-left font-normal text-zinc-500">Auf Voreinstellung</th>
                  <td />
                  {CONFIGURABLE_ROLES.map((r) => (
                    <td key={r} className="px-1.5 py-2 text-center">
                      <Button type="button" variant="ghost" size="sm" onClick={() => resetRole(r)} disabled={dis || sameRole(draft, defaults, r)} aria-label={`${ADMIN_ROLE_LABEL[r]} auf Voreinstellung zurücksetzen`}>
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                        Zurück
                      </Button>
                    </td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {canWrite && (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={() => persist(draft, "Rollen und Rechte gespeichert.")} disabled={busy || !dirty}>
            <Save className="h-4 w-4" aria-hidden />
            {busy ? "Speichern …" : "Speichern"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setDraft(clone(saved))} disabled={busy || !dirty}>
            Änderungen verwerfen
          </Button>
          <Button type="button" variant="danger" onClick={() => setConfirmAll(true)} disabled={busy || savedIsDefault}>
            <RotateCcw className="h-4 w-4" aria-hidden />
            Alles auf Voreinstellung zurücksetzen
          </Button>
          {dirty && <span className="text-xs text-amber-300">Ungespeicherte Änderungen</span>}
        </div>
      )}

      {/* Erklärung je Rolle */}
      <section aria-labelledby="rollen-erklaerung">
        <h2 id="rollen-erklaerung" className="mb-3 text-base font-semibold text-white">Was die Rollen dürfen</h2>
        <dl className="grid gap-3 sm:grid-cols-2">
          {ADMIN_ROLE_VALUES.map((r) => (
            <div key={r} className="rounded-xl border border-zinc-800 p-3">
              <dt className="text-sm font-medium text-zinc-200">{ADMIN_ROLE_LABEL[r]}</dt>
              <dd className="mt-1 text-xs text-zinc-500">{roleHint(r, matrix)}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-xs text-zinc-500">Die Erklärungen folgen der Einstellung oben, auch bevor du speicherst.</p>
      </section>

      {/* Vorschau */}
      <section aria-labelledby="rollen-vorschau">
        <Card className="p-4 sm:p-5">
          <h2 id="rollen-vorschau" className="text-base font-semibold text-white">Vorschau: Diese Person darf …</h2>
          <fieldset className="mt-3">
            <legend className="text-xs text-zinc-500">Rollen der Person wählen (eine Person kann mehrere haben, es gilt jeweils die höchste Stufe):</legend>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
              {ADMIN_ROLE_VALUES.map((r) => (
                <label key={r} className="inline-flex min-h-8 cursor-pointer items-center gap-2 text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    checked={previewRoles.includes(r)}
                    onChange={(e) => setPreviewRoles((cur) => (e.target.checked ? [...cur, r] : cur.filter((x) => x !== r)))}
                    className="h-5 w-5 rounded border-zinc-600 accent-emerald-500"
                  />
                  {ADMIN_ROLE_LABEL[r].replace(" (nur lesen)", "")}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="mt-4 space-y-2 text-sm" aria-live="polite">
            {previewRoles.length === 0 ? (
              <p className="text-zinc-500">Wähle mindestens eine Rolle.</p>
            ) : (
              <>
                <p><span className="font-medium text-emerald-400">Ändern:</span> <span className="text-zinc-300">{list(summary.write)}</span></p>
                <p><span className="font-medium text-zinc-200">Nur lesen:</span> <span className="text-zinc-300">{list(summary.read)}</span></p>
                <p><span className="font-medium text-zinc-500">Kein Zugriff:</span> <span className="text-zinc-400">{list(summary.none)}</span></p>
                <p className="text-zinc-300">
                  <span className="font-medium text-zinc-200">Vorstandsnotizen bei Mitgliedern:</span> {summary.boardNotes ? "sichtbar" : "nicht sichtbar"}
                  <br />
                  <span className="font-medium text-zinc-200">Dokumente «Nur Vorstand»:</span> {summary.boardDocuments ? "sichtbar" : "nicht sichtbar"}
                  <br />
                  <span className="font-medium text-zinc-200">Geschäftsjahr abschliessen und wieder öffnen:</span> {summary.fiscalYearClose ? "erlaubt" : "nicht erlaubt"}
                </p>
              </>
            )}
          </div>
        </Card>
      </section>

      <ConfirmDialog
        open={confirmAll}
        title="Alle Rollen zurücksetzen?"
        description="Alle Anpassungen werden verworfen und gespeichert: Jede Rolle hat wieder die Voreinstellung. Das steht im Änderungsprotokoll."
        confirmLabel="Zurücksetzen"
        danger
        busy={busy}
        onConfirm={resetAll}
        onCancel={() => setConfirmAll(false)}
      />
    </div>
  );
}
