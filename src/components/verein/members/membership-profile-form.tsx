"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { Loader2, Save } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { FieldBox, FormAlert, FormSuccess, fieldA11y } from "@/components/account/form-parts";
import { useMessages } from "@/i18n/client";
import { vereinMitglieder } from "@/i18n/verein-mitglieder";

export type ProfileValues = {
  salutation: string;
  street: string;
  houseNumber: string;
  zip: string;
  city: string;
  country: string;
  phone: string;
  communicationPref: string;
};

/** Eigene Anschrift, Telefon und Kontaktweg ändern (Portal). Name, E-Mail und Mitgliedschaftsart ändert der Vorstand. */
export function MembershipProfileForm({ initial }: { initial: ProfileValues }) {
  const m = useMessages(vereinMitglieder).membership.edit;
  const router = useRouter();
  const uid = useId();
  const id = (n: string) => `${uid}-${n}`;
  const [v, setV] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof ProfileValues, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = <K extends keyof ProfileValues>(key: K, value: string) => {
    setV((s) => ({ ...s, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
    setOk(false);
  };
  const dirty = (Object.keys(v) as Array<keyof ProfileValues>).some((k) => v[k] !== saved[k]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    setErrors({});
    setOk(false);
    try {
      await api("/api/account/verein/membership", { method: "PATCH", body: v });
      setSaved(v);
      setOk(true);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError && err.fields && Object.keys(err.fields).length > 0) setErrors(err.fields as Partial<Record<keyof ProfileValues, string>>);
      else setError(err instanceof ApiClientError ? err.message : m.failed);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={loading} className="space-y-5">
      {error && (
        <FormAlert>
          <p>{error}</p>
        </FormAlert>
      )}
      {ok && <FormSuccess>{m.saved}</FormSuccess>}

      <div className="grid gap-4 sm:grid-cols-2">
        <FieldBox id={id("salutation")} label={m.salutation} error={errors.salutation}>
          <Select id={id("salutation")} name="salutation" value={v.salutation} onChange={(e) => set("salutation", e.target.value)} {...fieldA11y(id("salutation"), errors.salutation)}>
            <option value="">{m.noSalutation}</option>
            <option value="FRAU">{m.salutations.FRAU}</option>
            <option value="HERR">{m.salutations.HERR}</option>
          </Select>
        </FieldBox>
        <FieldBox id={id("pref")} label={m.pref} error={errors.communicationPref}>
          <Select id={id("pref")} name="communicationPref" value={v.communicationPref} onChange={(e) => set("communicationPref", e.target.value)} {...fieldA11y(id("pref"), errors.communicationPref)}>
            <option value="EMAIL">{m.prefs.EMAIL}</option>
            <option value="POST">{m.prefs.POST}</option>
          </Select>
        </FieldBox>
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_6rem]">
        <FieldBox id={id("street")} label={m.street} error={errors.street}>
          <Input id={id("street")} name="street" maxLength={100} autoComplete="address-line1" value={v.street} onChange={(e) => set("street", e.target.value)} {...fieldA11y(id("street"), errors.street)} />
        </FieldBox>
        <FieldBox id={id("houseNumber")} label={m.houseNumber} error={errors.houseNumber}>
          <Input id={id("houseNumber")} name="houseNumber" maxLength={20} value={v.houseNumber} onChange={(e) => set("houseNumber", e.target.value)} {...fieldA11y(id("houseNumber"), errors.houseNumber)} />
        </FieldBox>
      </div>
      <div className="grid gap-4 sm:grid-cols-[8rem_1fr_9rem]">
        <FieldBox id={id("zip")} label={m.zip} error={errors.zip}>
          <Input id={id("zip")} name="zip" maxLength={10} inputMode="numeric" autoComplete="postal-code" value={v.zip} onChange={(e) => set("zip", e.target.value)} {...fieldA11y(id("zip"), errors.zip)} />
        </FieldBox>
        <FieldBox id={id("city")} label={m.city} error={errors.city}>
          <Input id={id("city")} name="city" maxLength={80} autoComplete="address-level2" value={v.city} onChange={(e) => set("city", e.target.value)} {...fieldA11y(id("city"), errors.city)} />
        </FieldBox>
        <FieldBox id={id("country")} label={m.country} error={errors.country}>
          <Input id={id("country")} name="country" maxLength={2} className="uppercase" autoComplete="country" value={v.country} onChange={(e) => set("country", e.target.value)} {...fieldA11y(id("country"), errors.country)} />
        </FieldBox>
      </div>
      <FieldBox id={id("phone")} label={m.phone} error={errors.phone}>
        <Input id={id("phone")} name="phone" type="tel" maxLength={30} autoComplete="tel" value={v.phone} onChange={(e) => set("phone", e.target.value)} {...fieldA11y(id("phone"), errors.phone)} />
      </FieldBox>

      <Button type="submit" disabled={loading || !dirty}>
        {loading ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <Save className="size-4" aria-hidden />}
        {loading ? m.saving : m.save}
      </Button>
    </form>
  );
}
