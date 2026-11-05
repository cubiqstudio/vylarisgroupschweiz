"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { api } from "@/lib/api-client";
import { COMMUNICATION_PREF_LABEL, SALUTATION_LABEL, SALUTATIONS, COMMUNICATION_PREFS } from "@/lib/verein/constants";
import { Notice } from "@/components/admin/core/notice";
import { useToast } from "@/components/admin/core/toast";
import { describeError } from "@/components/admin/settings/form-utils";
import type { MemberFormValues } from "./member-values";

export type TypeOption = { id: string; name: string; active: boolean };

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card className="p-5">
      <h2 className="text-base font-semibold text-white">{title}</h2>
      {description && <p className="mt-1 text-sm text-zinc-400">{description}</p>}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </Card>
  );
}

/**
 * Formular für Stammdaten. `create` legt ein neues Mitglied an (aktiv oder als Antrag), `edit` ändert ein bestehendes.
 * Vorstandsnotizen erscheinen nur, wenn `showBoardNotes` gesetzt ist (Rolle mit Vorstandsrecht); der Server prüft das zusätzlich.
 */
export function MemberForm({
  mode,
  memberId,
  initial,
  types,
  showBoardNotes,
}: {
  mode: "create" | "edit";
  memberId?: string;
  initial: MemberFormValues;
  types: TypeOption[];
  showBoardNotes: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [v, setV] = useState<MemberFormValues>(initial);
  const [status, setStatus] = useState<"AKTIV" | "ANTRAG">("AKTIV");
  const [joinedAt, setJoinedAt] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof MemberFormValues>(key: K, value: MemberFormValues[K]) => {
    setV((s) => ({ ...s, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: "" } : e));
  };
  const bind = (key: keyof MemberFormValues) => ({
    id: `m-${key}`,
    name: key,
    value: v[key],
    onChange: (e: { target: { value: string } }) => set(key, e.target.value),
    "aria-invalid": errors[key] ? (true as const) : undefined,
    disabled: busy,
  });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setFormError(null);
    setErrors({});
    const body: Record<string, unknown> = {
      salutation: v.salutation,
      firstName: v.firstName,
      lastName: v.lastName,
      birthDate: v.birthDate,
      street: v.street,
      houseNumber: v.houseNumber,
      zip: v.zip,
      city: v.city,
      country: v.country,
      email: v.email,
      phone: v.phone,
      communicationPref: v.communicationPref,
      membershipTypeId: v.membershipTypeId,
    };
    if (showBoardNotes) body.boardNotes = v.boardNotes;
    try {
      if (mode === "create") {
        const res = await api<{ id: string; memberNumber: number; linked: boolean }>("/api/admin/members", { method: "POST", body: { ...body, status, joinedAt: status === "AKTIV" ? joinedAt : "" } });
        toast.success(`Mitglied Nr. ${res.memberNumber} wurde erfasst.${res.linked ? " Das Website-Konto wurde verknüpft." : ""}`);
        router.push(`/admin/members/${res.id}`);
      } else {
        const res = await api<{ linked: boolean }>(`/api/admin/members/${encodeURIComponent(memberId ?? "")}`, { method: "PATCH", body });
        toast.success(res.linked ? "Gespeichert. Das Website-Konto wurde verknüpft." : "Änderungen gespeichert.");
        router.refresh();
      }
    } catch (err) {
      const d = describeError(err, "Speichern fehlgeschlagen.");
      setErrors(d.fields);
      setFormError(d.message);
      toast.error(d.message);
    } finally {
      setBusy(false);
    }
  }

  const typeOptions = types.filter((t) => t.active || t.id === v.membershipTypeId);

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={busy} className="space-y-6">
      {formError && <Notice variant="error">{formError}</Notice>}

      {mode === "create" && (
        <Section title="Aufnahme" description="Erfasse die Person als aktuelles Mitglied oder als Antrag, den der Vorstand noch prüft.">
          <Field label="Status" htmlFor="m-status">
            <Select id="m-status" value={status} onChange={(e) => setStatus(e.target.value as "AKTIV" | "ANTRAG")} disabled={busy}>
              <option value="AKTIV">Aktives Mitglied</option>
              <option value="ANTRAG">Antrag (noch zu prüfen)</option>
            </Select>
          </Field>
          {status === "AKTIV" && (
            <Field label="Eintrittsdatum" htmlFor="m-joinedAt" hint="Leer = heute." error={errors.joinedAt}>
              <Input id="m-joinedAt" type="date" value={joinedAt} onChange={(e) => setJoinedAt(e.target.value)} disabled={busy} />
            </Field>
          )}
        </Section>
      )}

      <Section title="Person">
        <Field label="Anrede" htmlFor="m-salutation" error={errors.salutation}>
          <Select {...bind("salutation")}>
            {SALUTATIONS.map((s) => (
              <option key={s} value={s}>
                {SALUTATION_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
        <div className="hidden sm:block" />
        <Field label="Vorname" htmlFor="m-firstName" error={errors.firstName}>
          <Input {...bind("firstName")} required maxLength={80} autoComplete="off" />
        </Field>
        <Field label="Nachname" htmlFor="m-lastName" error={errors.lastName}>
          <Input {...bind("lastName")} required maxLength={80} autoComplete="off" />
        </Field>
        <Field label="Geburtsdatum" htmlFor="m-birthDate" hint="Freiwillig. Nur erfassen, wenn der Verein es braucht." error={errors.birthDate}>
          <Input {...bind("birthDate")} type="date" />
        </Field>
        <Field label="Mitgliedschaftsart" htmlFor="m-membershipTypeId" error={errors.membershipTypeId} hint={types.length === 0 ? "Lege zuerst unter «Mitgliedschaftsarten» eine Art an." : undefined}>
          <Select {...bind("membershipTypeId")}>
            <option value="">Keine Angabe</option>
            {typeOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.active ? "" : " (inaktiv)"}
              </option>
            ))}
          </Select>
        </Field>
      </Section>

      <Section title="Anschrift und Kontakt">
        <Field label="Strasse" htmlFor="m-street" error={errors.street}>
          <Input {...bind("street")} maxLength={100} autoComplete="off" />
        </Field>
        <Field label="Hausnummer" htmlFor="m-houseNumber" error={errors.houseNumber}>
          <Input {...bind("houseNumber")} maxLength={20} autoComplete="off" />
        </Field>
        <Field label="PLZ" htmlFor="m-zip" error={errors.zip}>
          <Input {...bind("zip")} maxLength={10} inputMode="numeric" autoComplete="off" />
        </Field>
        <Field label="Ort" htmlFor="m-city" error={errors.city}>
          <Input {...bind("city")} maxLength={80} autoComplete="off" />
        </Field>
        <Field label="Land (Ländercode)" htmlFor="m-country" hint="Zwei Buchstaben, z. B. CH." error={errors.country}>
          <Input {...bind("country")} maxLength={2} className="uppercase" autoComplete="off" />
        </Field>
        <div className="hidden sm:block" />
        <Field label="E-Mail" htmlFor="m-email" error={errors.email}>
          <Input {...bind("email")} type="email" maxLength={254} autoComplete="off" inputMode="email" />
        </Field>
        <Field label="Telefon" htmlFor="m-phone" error={errors.phone}>
          <Input {...bind("phone")} type="tel" maxLength={30} autoComplete="off" />
        </Field>
        <Field label="Mitteilungen bevorzugt" htmlFor="m-communicationPref" error={errors.communicationPref}>
          <Select {...bind("communicationPref")}>
            {COMMUNICATION_PREFS.map((p) => (
              <option key={p} value={p}>
                {COMMUNICATION_PREF_LABEL[p]}
              </option>
            ))}
          </Select>
        </Field>
      </Section>

      {showBoardNotes && (
        <Card className="p-5">
          <h2 className="text-base font-semibold text-white">Vorstandsnotizen</h2>
          <p className="mt-1 text-sm text-zinc-400">Nur für den Vorstand sichtbar. Das Mitglied sieht diese Notizen nicht. Bitte nur festhalten, was der Verein wirklich braucht.</p>
          <div className="mt-4">
            <Field label="Notizen" htmlFor="m-boardNotes" error={errors.boardNotes}>
              <Textarea {...bind("boardNotes")} rows={4} maxLength={5000} />
            </Field>
          </div>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
          {busy ? "Speichere …" : mode === "create" ? "Mitglied erfassen" : "Änderungen speichern"}
        </Button>
      </div>
    </form>
  );
}
