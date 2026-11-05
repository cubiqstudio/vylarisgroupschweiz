"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { api } from "@/lib/api-client";
import { EXIT_MODES, EXIT_MODE_LABEL, earliestExitDate, formatDateCh, todayZurich, type ExitMode } from "@/lib/verein/dates";
import type { VereinProfile } from "@/lib/verein/profile-schema";
import type { VereinSettings } from "@/lib/verein/settings-schema";
import { Notice } from "@/components/admin/core/notice";
import { useToast } from "@/components/admin/core/toast";
import { describeError } from "@/components/admin/settings/form-utils";
import { Switch } from "@/components/admin/settings/switch";
import { IntField, parseIntField, SettingsSection, StatutesBadge } from "./settings-parts";

export type GeneralSettings = Pick<
  VereinSettings,
  | "fiscalStartMonth"
  | "fiscalStartDay"
  | "invitationDays"
  | "exitMode"
  | "exitNoticeMonths"
  | "senderName"
  | "senderSignature"
  | "invoiceMailIntro"
  | "reminderMailIntro"
  | "invitationMailIntro"
  | "welcomeMailText"
  | "replyToEmail"
  | "applyEnabled"
  | "applyNotifyEmail"
>;

const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const str = (n: number | null) => (n === null ? "" : String(n));

export function GeneralSettingsForm({
  settings,
  profile,
  defaultName,
  canWrite,
}: {
  settings: GeneralSettings;
  profile: VereinProfile;
  /** Rechtsträger der Website: gilt, solange kein Name eingetragen ist */
  defaultName: string;
  canWrite: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [p, setP] = useState(profile);
  const [fiscalMonth, setFiscalMonth] = useState(String(settings.fiscalStartMonth));
  const [fiscalDay, setFiscalDay] = useState(String(settings.fiscalStartDay));
  const [invitationDays, setInvitationDays] = useState(str(settings.invitationDays));
  const [exitMode, setExitMode] = useState<ExitMode>(settings.exitMode);
  const [noticeMonths, setNoticeMonths] = useState(String(settings.exitNoticeMonths));
  const [senderName, setSenderName] = useState(settings.senderName);
  const [replyTo, setReplyTo] = useState(settings.replyToEmail);
  const [signature, setSignature] = useState(settings.senderSignature);
  const [invoiceIntro, setInvoiceIntro] = useState(settings.invoiceMailIntro);
  const [reminderIntro, setReminderIntro] = useState(settings.reminderMailIntro);
  const [invitationIntro, setInvitationIntro] = useState(settings.invitationMailIntro);
  const [welcome, setWelcome] = useState(settings.welcomeMailText);
  const [applyEnabled, setApplyEnabled] = useState(settings.applyEnabled);
  const [applyEmail, setApplyEmail] = useState(settings.applyNotifyEmail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  const setProfile = (k: keyof VereinProfile) => (e: { target: { value: string } }) => setP((v) => ({ ...v, [k]: e.target.value }));
  const dis = busy || !canWrite;

  // Beispiel für die Austrittsregel mit den eingegebenen Werten
  const example = useMemo(() => {
    const months = Number(noticeMonths);
    const month = Number(fiscalMonth);
    const day = Number(fiscalDay);
    if (!/^\d+$/.test(noticeMonths.trim()) || months > 24 || !(month >= 1 && month <= 12) || !(day >= 1 && day <= 28)) return null;
    try {
      const today = todayZurich();
      return { from: formatDateCh(today), to: formatDateCh(earliestExitDate(today, { mode: exitMode, noticeMonths: months }, { month, day })) };
    } catch {
      return null;
    }
  }, [exitMode, noticeMonths, fiscalMonth, fiscalDay]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || !canWrite) return;
    setError(null);
    setFields({});
    const day = parseIntField(fiscalDay, "Geschäftsjahr: Tag");
    const invitation = parseIntField(invitationDays, "Einladungsfrist");
    const notice = parseIntField(noticeMonths, "Kündigungsfrist");
    const local: Record<string, string> = {};
    if (day.error || day.value === null) local.fiscalStartDay = day.error ?? "Bitte einen Tag zwischen 1 und 28 angeben.";
    if (invitation.error) local.invitationDays = invitation.error;
    if (notice.error || notice.value === null) local.exitNoticeMonths = notice.error ?? "Bitte die Kündigungsfrist in Monaten angeben.";
    if (Object.keys(local).length > 0) {
      setFields(local);
      setError("Bitte prüfe die markierten Felder.");
      return;
    }
    setBusy(true);
    try {
      await api("/api/admin/settings/verein", {
        method: "PUT",
        body: {
          profile: p,
          settings: {
            fiscalStartMonth: Number(fiscalMonth),
            fiscalStartDay: day.value,
            invitationDays: invitation.value,
            exitMode,
            exitNoticeMonths: notice.value,
            senderName,
            senderSignature: signature,
            invoiceMailIntro: invoiceIntro,
            reminderMailIntro: reminderIntro,
            invitationMailIntro: invitationIntro,
            welcomeMailText: welcome,
            replyToEmail: replyTo,
            applyEnabled,
            applyNotifyEmail: applyEmail,
          },
        },
      });
      toast.success("Vereinseinstellungen gespeichert.");
      router.refresh();
    } catch (err) {
      const d = describeError(err, "Die Einstellungen konnten nicht gespeichert werden.");
      // Fehler der verschachtelten Felder («settings.iban», «profile.uid») auf den Feldnamen abbilden
      const flat: Record<string, string> = {};
      for (const [k, v] of Object.entries(d.fields)) flat[k.replace(/^(settings|profile)\./, "")] = v;
      setFields(flat);
      setError(Object.keys(flat).length > 0 ? "Bitte prüfe die markierten Felder." : d.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid max-w-4xl gap-6">
      {!canWrite && <Notice variant="info">Du kannst die Einstellungen ansehen, aber nicht ändern. Änderungen nimmt der Vorstand mit Schreibrecht vor.</Notice>}
      {error && <Notice variant="error">{error}</Notice>}
      <Notice variant="info">
        Es gelten die Statuten des Vereins. Voreinstellungen entsprechen dem Gesetz (ZGB) oder sind neutral und mit «gemäss Statuten anpassen» gekennzeichnet. Das ist keine Rechtsberatung.
      </Notice>

      <SettingsSection id="stammdaten" title="Vereinsstammdaten" description="Angaben zum Verein, wie sie in den Statuten stehen. Sie erscheinen auf dem Mitgliederausweis und in Mitteilungen. Leer gelassene Angaben werden nirgends angezeigt.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Name des Vereins" htmlFor="p-name" error={fields.name} hint={`Leer lassen: Es erscheint «${defaultName}».`}>
            <Input id="p-name" value={p.name} onChange={setProfile("name")} maxLength={100} disabled={dis} placeholder={defaultName} autoComplete="off" aria-invalid={fields.name ? true : undefined} />
          </Field>
          <Field label="Sitz" htmlFor="p-seat" error={fields.seat} hint="Politische Gemeinde gemäss Statuten.">
            <Input id="p-seat" value={p.seat} onChange={setProfile("seat")} maxLength={100} disabled={dis} autoComplete="off" aria-invalid={fields.seat ? true : undefined} />
          </Field>
          <Field label="Gegründet am" htmlFor="p-founded" error={fields.foundedOn}>
            <Input id="p-founded" type="date" value={p.foundedOn} onChange={setProfile("foundedOn")} disabled={dis} aria-invalid={fields.foundedOn ? true : undefined} className="max-w-48" />
          </Field>
          <Field label="UID (optional)" htmlFor="p-uid" error={fields.uid} hint="Unternehmens-Identifikationsnummer, z. B. CHE-123.456.789.">
            <Input id="p-uid" value={p.uid} onChange={setProfile("uid")} maxLength={30} disabled={dis} autoComplete="off" aria-invalid={fields.uid ? true : undefined} />
          </Field>
          <Field label="Handelsregister (optional)" htmlFor="p-register" error={fields.register} hint="Nur ausfüllen, wenn der Verein im Handelsregister eingetragen ist." className="sm:col-span-2">
            <Input id="p-register" value={p.register} onChange={setProfile("register")} maxLength={200} disabled={dis} autoComplete="off" aria-invalid={fields.register ? true : undefined} />
          </Field>
          <Field label="Zweck" htmlFor="p-purpose" error={fields.purpose} hint="Zweck gemäss Statuten, in eigenen Worten." className="sm:col-span-2">
            <Textarea id="p-purpose" rows={4} value={p.purpose} onChange={setProfile("purpose")} maxLength={1000} disabled={dis} aria-invalid={fields.purpose ? true : undefined} />
          </Field>
        </div>
        <p className="mt-4 text-sm text-zinc-400">
          Anschrift, Telefon und Kontakt-E-Mail des Vereins stehen unter{" "}
          <Link href="/admin/settings#rechtliches" className="font-medium text-emerald-400 hover:underline">
            Einstellungen, Rechtliches
          </Link>{" "}
          (Impressum). Konto und Zahlungsfristen unter{" "}
          <Link href="/admin/verein/finanzen" className="font-medium text-emerald-400 hover:underline">
            Finanzeinstellungen
          </Link>
          .
        </p>
      </SettingsSection>

      <SettingsSection id="geschaeftsjahr" title="Geschäftsjahr" description="Beginn des Geschäftsjahres für Kassa, Beitragsjahre und Austrittstermine. Bitte vor der ersten Buchung festlegen: Eine spätere Änderung ordnet bestehende Buchungen nicht neu zu.">
        <div className="mb-4">
          <StatutesBadge text="Voreinstellung: Kalenderjahr, gemäss Statuten anpassen" />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Beginn: Monat" htmlFor="fy-month" error={fields.fiscalStartMonth}>
            <Select id="fy-month" value={fiscalMonth} onChange={(e) => setFiscalMonth(e.target.value)} disabled={dis} className="max-w-56">
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </Select>
          </Field>
          <IntField id="fy-day" label="Beginn: Tag" value={fiscalDay} onChange={setFiscalDay} error={fields.fiscalStartDay} hint="1 bis 28." disabled={dis} placeholder="1" />
        </div>
      </SettingsSection>

      <SettingsSection id="versammlung" title="Versammlungen" description="Die Einladungsfrist steht in den Statuten. Bis sie eingetragen ist, ist der Einladungsversand gesperrt.">
        <IntField
          id="inv-days"
          label="Einladungsfrist"
          unit="Tage"
          value={invitationDays}
          onChange={setInvitationDays}
          error={fields.invitationDays}
          hint="Mindestzahl Tage zwischen Einladung und Versammlung gemäss Statuten."
          disabled={dis}
        />
      </SettingsSection>

      <SettingsSection id="austritt" title="Austritt und Stimmrecht" description="Wann ein Austritt wirksam wird. Daraus berechnet die Software den frühesten Austrittstermin.">
        <div className="mb-4 flex flex-wrap gap-2">
          <StatutesBadge text="Voreinstellung nach ZGB Art. 70 Abs. 2: gemäss Statuten anpassen" />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Austritt möglich" htmlFor="exit-mode" error={fields.exitMode}>
            <Select id="exit-mode" value={exitMode} onChange={(e) => setExitMode(e.target.value as ExitMode)} disabled={dis}>
              {EXIT_MODES.map((m) => (
                <option key={m} value={m}>
                  {EXIT_MODE_LABEL[m]}
                </option>
              ))}
            </Select>
          </Field>
          <IntField id="exit-months" label="Kündigungsfrist" unit="Monate" value={noticeMonths} onChange={setNoticeMonths} error={fields.exitNoticeMonths} hint="Höchstens 24 Monate." disabled={dis} placeholder="6" />
        </div>
        {example && (
          <p className="mt-4 text-sm text-zinc-400" aria-live="polite">
            Beispiel: Wer heute ({example.from}) den Austritt erklärt, kann frühestens am <strong className="text-zinc-200">{example.to}</strong> austreten.
          </p>
        )}
        <p className="mt-4 text-sm text-zinc-400">
          Das Stimmrecht und die Wählbarkeit legt der Verein je Mitgliedschaftsart fest (Voreinstellung nach ZGB Art. 67: gleiches Stimmrecht, gemäss Statuten anpassen), siehe{" "}
          <Link href="/admin/members/types" className="font-medium text-emerald-400 hover:underline">
            Mitgliedschaftsarten
          </Link>
          .
        </p>
      </SettingsSection>

      <SettingsSection id="beitritt" title="Beitrittsformular" description="Auf der Seite «Mitglied werden» können Interessierte einen Antrag stellen. Über die Aufnahme entscheidet der Verein gemäss Statuten.">
        <div className="space-y-5">
          <Switch
            id="apply-enabled"
            checked={applyEnabled}
            onChange={setApplyEnabled}
            disabled={dis}
            label="Beitrittsformular auf der Website anzeigen"
            description="Ausgeschaltet nimmt der Verein keine Anträge über die Website entgegen."
          />
          <Field label="Hinweis an den Vorstand bei Anträgen und Austritten" htmlFor="apply-email" error={fields.applyNotifyEmail} hint="E-Mail-Adresse, an die Hinweise zu neuen Anträgen und Austrittserklärungen gehen. Leer: keine Benachrichtigung.">
            <Input id="apply-email" type="email" value={applyEmail} onChange={(e) => setApplyEmail(e.target.value)} maxLength={254} disabled={dis} autoComplete="off" aria-invalid={fields.applyNotifyEmail ? true : undefined} className="max-w-md" />
          </Field>
        </div>
      </SettingsSection>

      <SettingsSection id="mails" title="Absender und Texte der Vereinsmails" description="Gilt für Rechnungen, Mahnungen, Einladungen und Willkommensmails. Leere Einleitungen ersetzt die Software durch neutrale Standardtexte.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Absendername" htmlFor="m-sender" error={fields.senderName} hint="Erscheint in der Signatur, z. B. «Der Vorstand».">
            <Input id="m-sender" value={senderName} onChange={(e) => setSenderName(e.target.value)} maxLength={100} disabled={dis} autoComplete="off" aria-invalid={fields.senderName ? true : undefined} />
          </Field>
          <Field label="Antwortadresse" htmlFor="m-reply" error={fields.replyToEmail} hint="Antworten auf Vereinsmails gehen hierhin. Leer: Standardabsender.">
            <Input id="m-reply" type="email" value={replyTo} onChange={(e) => setReplyTo(e.target.value)} maxLength={254} disabled={dis} autoComplete="off" aria-invalid={fields.replyToEmail ? true : undefined} />
          </Field>
          <Field label="Signatur" htmlFor="m-signature" error={fields.senderSignature} hint="Wird unter jede Vereinsmail gesetzt (Name, Funktion, Kontakt). Höchstens 500 Zeichen." className="sm:col-span-2">
            <Textarea id="m-signature" rows={3} value={signature} onChange={(e) => setSignature(e.target.value)} maxLength={500} disabled={dis} aria-invalid={fields.senderSignature ? true : undefined} />
          </Field>
          <Field label="Einleitung der Rechnungsmail" htmlFor="m-invoice" error={fields.invoiceMailIntro} className="sm:col-span-2">
            <Textarea id="m-invoice" rows={3} value={invoiceIntro} onChange={(e) => setInvoiceIntro(e.target.value)} maxLength={2000} disabled={dis} aria-invalid={fields.invoiceMailIntro ? true : undefined} />
          </Field>
          <Field label="Einleitung der Mahnung" htmlFor="m-reminder" error={fields.reminderMailIntro} className="sm:col-span-2">
            <Textarea id="m-reminder" rows={3} value={reminderIntro} onChange={(e) => setReminderIntro(e.target.value)} maxLength={2000} disabled={dis} aria-invalid={fields.reminderMailIntro ? true : undefined} />
          </Field>
          <Field label="Einleitung der Einladung" htmlFor="m-invitation" error={fields.invitationMailIntro} className="sm:col-span-2">
            <Textarea id="m-invitation" rows={3} value={invitationIntro} onChange={(e) => setInvitationIntro(e.target.value)} maxLength={2000} disabled={dis} aria-invalid={fields.invitationMailIntro ? true : undefined} />
          </Field>
          <Field label="Willkommenstext bei der Aufnahme" htmlFor="m-welcome" error={fields.welcomeMailText} className="sm:col-span-2">
            <Textarea id="m-welcome" rows={3} value={welcome} onChange={(e) => setWelcome(e.target.value)} maxLength={2000} disabled={dis} aria-invalid={fields.welcomeMailText ? true : undefined} />
          </Field>
        </div>
      </SettingsSection>

      {canWrite && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-zinc-400">Änderungen gelten sofort und stehen im Änderungsprotokoll.</p>
          <Button type="submit" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
            {busy ? "Speichern …" : "Speichern"}
          </Button>
        </div>
      )}
    </form>
  );
}
