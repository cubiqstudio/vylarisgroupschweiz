"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Ban, CalendarX2, CheckCircle2, DoorOpen, Link2, Link2Off, RotateCcw, ShieldOff, UserCheck, UserX, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { api, ApiClientError } from "@/lib/api-client";
import { earliestExitDate, formatDateCh, parseDateOnly, toDateInputValue, todayZurich, type ExitRule, type FiscalStart } from "@/lib/verein/dates";
import { availableActions, describeExitRule, type MemberAction } from "@/lib/verein/members-lib";
import { Modal } from "@/components/admin/core/modal";
import { ConfirmDialog } from "@/components/admin/core/confirm-dialog";
import { Notice } from "@/components/admin/core/notice";
import { useToast } from "@/components/admin/core/toast";
import { describeError } from "@/components/admin/settings/form-utils";
import type { TypeOption } from "./member-form";

type Dialog = MemberAction | "link-user" | "unlink-user" | null;

type MailReport = { sent: boolean; error?: string; skipped?: string } | null;
type ActionResponse = { status: string; linked: boolean; mail: MailReport; plan: { effective: string } | null };

export type MemberActionsProps = {
  member: {
    id: string;
    memberNumber: number;
    name: string;
    status: string;
    email: string;
    membershipTypeId: string | null;
    exitNoticeAt: string | null;
    leftAt: string | null;
    anonymized: boolean;
    hasUser: boolean;
  };
  types: TypeOption[];
  canWrite: boolean;
  rule: ExitRule;
  fiscal: FiscalStart;
  /** Der Austritt ist vorgemerkt und der letzte Tag der Mitgliedschaft ist vorbei */
  exitDue: boolean;
  /** Offene Rechnungen (Text) – verhindert das Entfernen der Personendaten */
  claimsText: string | null;
};

function Footer({ onCancel, busy, label, danger, disabled }: { onCancel: () => void; busy: boolean; label: string; danger?: boolean; disabled?: boolean }) {
  return (
    <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
        Abbrechen
      </Button>
      <Button type="submit" variant={danger ? "danger" : "primary"} disabled={busy || disabled}>
        {busy ? "Bitte warten …" : label}
      </Button>
    </div>
  );
}

function Check({ id, checked, onChange, children }: { id: string; checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-600 bg-surface accent-emerald-400" />
      <label htmlFor={id} className="text-sm text-zinc-300">
        {children}
      </label>
    </div>
  );
}

/** Aktionen auf einem Mitglied (Aufnahme, Austritt, Ausschluss, Konto verknüpfen …). Alle heiklen Schritte brauchen eine Bestätigung. */
export function MemberActions({ member, types, canWrite, rule, fiscal, exitDue, claimsText }: MemberActionsProps) {
  const router = useRouter();
  const toast = useToast();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  // Formularwerte der Dialoge
  const [typeId, setTypeId] = useState(member.membershipTypeId ?? "");
  const [date, setDate] = useState("");
  const [noticeAt, setNoticeAt] = useState(toDateInputValue(todayZurich()));
  const [leftAt, setLeftAt] = useState("");
  const [reason, setReason] = useState("");
  const [sendMail, setSendMail] = useState(true);
  const [allowEarlier, setAllowEarlier] = useState(false);
  const [confirmNumber, setConfirmNumber] = useState("");
  const [linkEmail, setLinkEmail] = useState("");

  const actions = availableActions({ status: member.status, exitNoticeAt: member.exitNoticeAt ? new Date(member.exitNoticeAt) : null, anonymizedAt: member.anonymized ? new Date() : null });
  const has = (a: MemberAction) => canWrite && actions.includes(a);
  const activeTypes = types.filter((t) => t.active || t.id === member.membershipTypeId);

  const earliest = useMemo(() => {
    const n = parseDateOnly(noticeAt);
    return n ? earliestExitDate(n, rule, fiscal) : null;
  }, [noticeAt, rule, fiscal]);
  const chosenLeft = leftAt ? parseDateOnly(leftAt) : null;
  const earlier = earliest && chosenLeft ? chosenLeft.getTime() < earliest.getTime() : false;

  function open(d: Dialog) {
    setErrors({});
    setFormError(null);
    setReason("");
    setDate("");
    setLeftAt("");
    setAllowEarlier(false);
    setConfirmNumber("");
    setLinkEmail("");
    setSendMail(true);
    setDialog(d);
  }
  const close = () => !busy && setDialog(null);

  async function run(body: Record<string, unknown>, success: string) {
    if (busy) return;
    setBusy(true);
    setErrors({});
    setFormError(null);
    try {
      const res = await api<ActionResponse>(`/api/admin/members/${encodeURIComponent(member.id)}/actions`, { method: "POST", body });
      toast.success(res.linked ? `${success} Das Website-Konto wurde verknüpft.` : success);
      if (res.mail) {
        if (res.mail.sent) toast.success("Die E-Mail wurde versendet.");
        else toast.error(`Die E-Mail wurde nicht versendet: ${res.mail.error ?? res.mail.skipped ?? "unbekannter Grund"}`);
      }
      setDialog(null);
      router.refresh();
    } catch (err) {
      const d = describeError(err, "Die Aktion ist fehlgeschlagen.");
      setErrors(d.fields);
      setFormError(d.message);
      if (err instanceof ApiClientError && Object.keys(d.fields).length === 0) toast.error(d.message);
    } finally {
      setBusy(false);
    }
  }

  const submit = (fn: () => void) => (e: FormEvent) => {
    e.preventDefault();
    fn();
  };

  if (!canWrite) return null;

  const anonymizable = has("anonymize");
  const canLink = canWrite && !member.anonymized && !member.hasUser && member.status === "AKTIV";
  const canUnlink = canWrite && !member.anonymized && member.hasUser;

  return (
    <>
      <div className="flex flex-wrap gap-2" role="group" aria-label={`Aktionen für ${member.name}`}>
        {has("accept") && (
          <Button type="button" onClick={() => open("accept")}>
            <UserCheck className="h-4 w-4" aria-hidden />
            {member.status === "ABGELEHNT" ? "Doch aufnehmen" : "Aufnehmen"}
          </Button>
        )}
        {has("reject") && (
          <Button type="button" variant="danger" onClick={() => open("reject")}>
            <XCircle className="h-4 w-4" aria-hidden />
            Ablehnen
          </Button>
        )}
        {has("reinstate") && (
          <Button type="button" variant="secondary" onClick={() => open("reinstate")}>
            <RotateCcw className="h-4 w-4" aria-hidden />
            Wieder aufnehmen
          </Button>
        )}
        {has("exit") && (
          <Button type="button" variant="secondary" onClick={() => open("exit")}>
            <DoorOpen className="h-4 w-4" aria-hidden />
            Austritt erfassen
          </Button>
        )}
        {has("exit-complete") && (
          <Button type="button" onClick={() => open("exit-complete")} disabled={!exitDue} title={exitDue ? undefined : "Der Austritt wird erst nach dem Austrittsdatum wirksam."}>
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            Austritt vollziehen
          </Button>
        )}
        {has("exit-withdraw") && (
          <Button type="button" variant="secondary" onClick={() => open("exit-withdraw")}>
            <CalendarX2 className="h-4 w-4" aria-hidden />
            Austritt zurücknehmen
          </Button>
        )}
        {has("expel") && (
          <Button type="button" variant="danger" onClick={() => open("expel")}>
            <Ban className="h-4 w-4" aria-hidden />
            Ausschliessen
          </Button>
        )}
        {has("deceased") && (
          <Button type="button" variant="secondary" onClick={() => open("deceased")}>
            <UserX className="h-4 w-4" aria-hidden />
            Als verstorben erfassen
          </Button>
        )}
        {canLink && (
          <Button type="button" variant="secondary" onClick={() => open("link-user")}>
            <Link2 className="h-4 w-4" aria-hidden />
            Website-Konto verknüpfen
          </Button>
        )}
        {canUnlink && (
          <Button type="button" variant="secondary" onClick={() => open("unlink-user")}>
            <Link2Off className="h-4 w-4" aria-hidden />
            Verknüpfung lösen
          </Button>
        )}
        {anonymizable && (
          <Button type="button" variant="danger" onClick={() => open("anonymize")}>
            <ShieldOff className="h-4 w-4" aria-hidden />
            Personendaten entfernen
          </Button>
        )}
      </div>

      {/* Aufnehmen */}
      <Modal open={dialog === "accept"} onClose={close} title="Mitglied aufnehmen" description={`${member.name} (Nr. ${member.memberNumber}) wird als aktives Mitglied aufgenommen. Über die Aufnahme entscheidet der Verein gemäss seinen Statuten.`} size="sm" dismissible={!busy}>
        <form onSubmit={submit(() => run({ action: "accept", membershipTypeId: typeId, joinedAt: date, sendMail }, "Das Mitglied wurde aufgenommen."))} noValidate className="space-y-4">
          {formError && <Notice variant="error">{formError}</Notice>}
          <Field label="Mitgliedschaftsart" htmlFor="a-type" error={errors.membershipTypeId}>
            <Select id="a-type" value={typeId} onChange={(e) => setTypeId(e.target.value)} disabled={busy}>
              <option value="">{activeTypes.length ? "Bitte wählen" : "Keine Art vorhanden"}</option>
              {activeTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Eintrittsdatum" htmlFor="a-date" hint="Leer = heute.">
            <Input id="a-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={busy} />
          </Field>
          <Check id="a-mail" checked={sendMail} onChange={setSendMail}>
            Willkommensmail an die Person senden
          </Check>
          <Footer onCancel={close} busy={busy} label="Aufnehmen" />
        </form>
      </Modal>

      {/* Ablehnen */}
      <Modal open={dialog === "reject"} onClose={close} title="Antrag ablehnen" description={`Der Antrag von ${member.name} wird abgelehnt. Die Mitgliedernummer bleibt vergeben und wird nicht neu verwendet.`} size="sm" dismissible={!busy}>
        <form onSubmit={submit(() => run({ action: "reject", reason, sendMail }, "Der Antrag wurde abgelehnt."))} noValidate className="space-y-4">
          {formError && <Notice variant="error">{formError}</Notice>}
          <Field label="Interne Begründung (optional)" htmlFor="r-reason" hint="Nur zur Information des Vorstands; sie steht nicht in der Mail." error={errors.reason}>
            <Textarea id="r-reason" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} disabled={busy} />
          </Field>
          <Check id="r-mail" checked={sendMail} onChange={setSendMail}>
            Absage per Mail senden
          </Check>
          <Footer onCancel={close} busy={busy} label="Ablehnen" danger />
        </form>
      </Modal>

      {/* Wieder aufnehmen */}
      <ConfirmDialog
        open={dialog === "reinstate"}
        title="Wieder aufnehmen?"
        description={`${member.name} wird wieder als aktives Mitglied geführt. Austrittsdatum und Austrittsgrund werden gelöscht; die Mitgliedernummer bleibt dieselbe.`}
        confirmLabel="Wieder aufnehmen"
        busy={busy}
        onConfirm={() => run({ action: "reinstate" }, "Das Mitglied wurde wieder aufgenommen.")}
        onCancel={close}
      />

      {/* Austritt erfassen */}
      <Modal open={dialog === "exit"} onClose={close} title="Austritt erfassen" description={`Hier hältst du die Austrittserklärung von ${member.name} fest. Das Mitglied bleibt bis zum Austrittsdatum aktiv.`} size="md" dismissible={!busy}>
        <form onSubmit={submit(() => run({ action: "exit", noticeAt, leftAt, reason, allowEarlier, sendMail }, "Der Austritt wurde vorgemerkt."))} noValidate className="space-y-4">
          {formError && <Notice variant="error">{formError}</Notice>}
          <Notice variant="info">
            Voreinstellung gemäss Statuten anpassen: {describeExitRule(rule)} Ohne abweichende Statuten gilt ZGB Art. 70 Abs. 2.
          </Notice>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Eingang der Austrittserklärung" htmlFor="x-notice" error={errors.noticeAt}>
              <Input id="x-notice" type="date" value={noticeAt} onChange={(e) => setNoticeAt(e.target.value)} disabled={busy} />
            </Field>
            <Field
              label="Austrittsdatum (letzter Tag)"
              htmlFor="x-left"
              hint={earliest ? `Leer = frühestmöglicher Termin: ${formatDateCh(earliest)}` : "Bitte ein gültiges Eingangsdatum angeben."}
              error={errors.leftAt}
            >
              <Input id="x-left" type="date" value={leftAt} onChange={(e) => setLeftAt(e.target.value)} disabled={busy} />
            </Field>
          </div>
          {earlier && (
            <Check id="x-earlier" checked={allowEarlier} onChange={setAllowEarlier}>
              Der gewählte Termin liegt vor dem frühestmöglichen ({earliest ? formatDateCh(earliest) : ""}). Ich bestätige, dass dies zulässig ist (z. B. Einverständnis des Vereins oder abweichende Statuten).
            </Check>
          )}
          <Field label="Grund (optional)" htmlFor="x-reason" error={errors.reason}>
            <Textarea id="x-reason" rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} disabled={busy} />
          </Field>
          <Check id="x-mail" checked={sendMail} onChange={setSendMail}>
            Bestätigung per Mail senden
          </Check>
          <Footer onCancel={close} busy={busy} label="Austritt vormerken" disabled={earlier && !allowEarlier} />
        </form>
      </Modal>

      <ConfirmDialog
        open={dialog === "exit-withdraw"}
        title="Austritt zurücknehmen?"
        description={`Der vorgemerkte Austritt von ${member.name}${member.leftAt ? ` per ${formatDateCh(new Date(member.leftAt))}` : ""} wird gelöscht. Die Mitgliedschaft läuft unverändert weiter.`}
        confirmLabel="Austritt zurücknehmen"
        busy={busy}
        onConfirm={() => run({ action: "exit-withdraw" }, "Der Austritt wurde zurückgenommen.")}
        onCancel={close}
      />
      <ConfirmDialog
        open={dialog === "exit-complete"}
        title="Austritt vollziehen?"
        description={`${member.name} wird als ausgetreten geführt. Beiträge und Einladungen entfallen ab jetzt. Das lässt sich über «Wieder aufnehmen» korrigieren.`}
        confirmLabel="Austritt vollziehen"
        busy={busy}
        onConfirm={() => run({ action: "exit-complete" }, "Das Mitglied ist ausgetreten.")}
        onCancel={close}
      />

      {/* Ausschliessen */}
      <Modal open={dialog === "expel"} onClose={close} title="Mitglied ausschliessen" description={`Der Ausschluss von ${member.name} ist ein schwerwiegender Schritt. Zuständigkeit und Verfahren regeln die Statuten.`} size="md" dismissible={!busy}>
        <form onSubmit={submit(() => run({ action: "expel", reason, effectiveAt: date }, "Das Mitglied wurde ausgeschlossen."))} noValidate className="space-y-4">
          {formError && <Notice variant="error">{formError}</Notice>}
          <Field label="Begründung" htmlFor="e-reason" error={errors.reason}>
            <Textarea id="e-reason" rows={3} maxLength={1000} required value={reason} onChange={(e) => setReason(e.target.value)} disabled={busy} />
          </Field>
          <Field label="Wirksam per" htmlFor="e-date" hint="Leer = heute." error={errors.effectiveAt}>
            <Input id="e-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={busy} />
          </Field>
          <Footer onCancel={close} busy={busy} label="Ausschliessen" danger />
        </form>
      </Modal>

      {/* Verstorben */}
      <Modal open={dialog === "deceased"} onClose={close} title="Als verstorben erfassen" description={`${member.name} wird als verstorben geführt.`} size="sm" dismissible={!busy}>
        <form onSubmit={submit(() => run({ action: "deceased", date }, "Das Mitglied wurde als verstorben erfasst."))} noValidate className="space-y-4">
          {formError && <Notice variant="error">{formError}</Notice>}
          <Field label="Datum" htmlFor="d-date" hint="Leer = heute." error={errors.date}>
            <Input id="d-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={busy} />
          </Field>
          <Footer onCancel={close} busy={busy} label="Bestätigen" />
        </form>
      </Modal>

      {/* Konto verknüpfen */}
      <Modal open={dialog === "link-user"} onClose={close} title="Website-Konto verknüpfen" description="Gib die E-Mail-Adresse des Website-Kontos ein. Das Konto muss bestätigt sein. Danach sieht die Person ihre Mitgliedschaft im Mitgliederbereich." size="sm" dismissible={!busy}>
        <form onSubmit={submit(() => run({ action: "link-user", email: linkEmail }, "Das Website-Konto wurde verknüpft."))} noValidate className="space-y-4">
          {formError && !errors.email && <Notice variant="error">{formError}</Notice>}
          <Field label="E-Mail-Adresse des Kontos" htmlFor="l-email" error={errors.email}>
            <Input id="l-email" type="email" inputMode="email" autoComplete="off" required value={linkEmail} onChange={(e) => setLinkEmail(e.target.value)} disabled={busy} />
          </Field>
          <Footer onCancel={close} busy={busy} label="Verknüpfen" />
        </form>
      </Modal>
      <ConfirmDialog
        open={dialog === "unlink-user"}
        title="Verknüpfung lösen?"
        description="Die Person verliert den Zugang zum Mitgliederbereich, bis das Konto wieder verknüpft wird. Das Website-Konto selbst bleibt bestehen."
        confirmLabel="Verknüpfung lösen"
        danger
        busy={busy}
        onConfirm={() => run({ action: "unlink-user" }, "Die Verknüpfung wurde gelöst.")}
        onCancel={close}
      />

      {/* Personendaten entfernen */}
      <Modal open={dialog === "anonymize"} onClose={close} title="Personendaten entfernen" description={`Name, Anschrift, Kontaktdaten, Geburtsdatum und Notizen von ${member.name} werden unwiderruflich gelöscht. Mitgliedernummer, Status sowie Eintritts- und Austrittsdatum bleiben erhalten; Rechnungen und Buchungen bleiben unverändert (Aufbewahrungspflicht).`} size="md" dismissible={!busy}>
        <form onSubmit={submit(() => run({ action: "anonymize", confirmNumber: Number(confirmNumber) || 0 }, "Die Personendaten wurden entfernt."))} noValidate className="space-y-4">
          {claimsText && <Notice variant="warning">{claimsText}</Notice>}
          {formError && !errors.confirmNumber && <Notice variant="error">{formError}</Notice>}
          <Field label={`Zur Bestätigung die Mitgliedernummer ${member.memberNumber} eingeben`} htmlFor="n-number" error={errors.confirmNumber}>
            <Input id="n-number" inputMode="numeric" autoComplete="off" value={confirmNumber} onChange={(e) => setConfirmNumber(e.target.value.replace(/\D/g, ""))} disabled={busy} />
          </Field>
          <Footer onCancel={close} busy={busy} label="Endgültig entfernen" danger disabled={Number(confirmNumber) !== member.memberNumber || Boolean(claimsText)} />
        </form>
      </Modal>
    </>
  );
}
