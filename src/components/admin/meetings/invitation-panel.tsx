"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Mail, Send } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { PILL } from "@/components/admin/core/styles";
import { Modal } from "@/components/admin/core/modal";
import { Notice } from "@/components/admin/core/notice";
import { useToast } from "@/components/admin/core/toast";
import { describeError } from "@/components/admin/settings/form-utils";
import { TONE_CLASS } from "@/lib/verein/constants";
import { RsvpPill } from "./pills";

export type RecipientRow = { memberId: string; name: string; channel: "EMAIL" | "POST" | "KEINE_ADRESSE" | "UNGUELTIG"; rsvp: "" | "ZUSAGE" | "ABSAGE"; invited: boolean };
export type BatchRow = { batchId: string; kind: string; sentAt: string; sentAtLabel: string; sentByName: string; total: number; ok: number; failed: number; late: boolean; errors: Array<{ name: string; error: string }> };

type Props = {
  meetingId: string;
  board: boolean;
  canWrite: boolean;
  /** Einladungen sind noch möglich (geplant oder eingeladen, Sitzung liegt in der Zukunft) */
  canSend: boolean;
  timing: { state: "unknown" | "ok" | "late" | "past"; text: string };
  blockedByMissingSetting: boolean;
  includeNonVoting: boolean;
  recipients: RecipientRow[];
  batches: BatchRow[];
  invitationSentAtLabel: string | null;
  firstSentOnTime: boolean | null;
};

const CHANNEL_LABEL: Record<RecipientRow["channel"], string> = {
  EMAIL: "E-Mail",
  POST: "Per Post (keine Mail)",
  KEINE_ADRESSE: "Keine E-Mail-Adresse",
  UNGUELTIG: "Ungültige E-Mail-Adresse",
};

type Plan = { kind: "EINLADUNG" | "ERINNERUNG"; mode: "ALL" | "MISSING"; label: string };

/** Einladung, Erinnerung und Versandprotokoll. Die Frist wird geprüft: bei Unterschreitung gibt es eine Warnung und der Versand braucht eine Bestätigung. */
export function InvitationPanel(p: Props) {
  const router = useRouter();
  const toast = useToast();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [ackLate, setAckLate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const byMail = p.recipients.filter((r) => r.channel === "EMAIL");
  const others = p.recipients.filter((r) => r.channel !== "EMAIL");
  const notInvited = byMail.filter((r) => !r.invited);
  const unanswered = byMail.filter((r) => r.rsvp === "");
  const counts = {
    yes: p.recipients.filter((r) => r.rsvp === "ZUSAGE").length,
    no: p.recipients.filter((r) => r.rsvp === "ABSAGE").length,
    none: p.recipients.filter((r) => r.rsvp === "").length,
  };
  const url = `/api/admin/meetings/${encodeURIComponent(p.meetingId)}/invitations`;
  const first = p.batches.every((b) => b.kind !== "EINLADUNG");
  const lateNow = p.timing.state === "late";
  const sendBlocked = !p.board && p.blockedByMissingSetting;

  function planCount(pl: Plan): number {
    if (pl.kind === "ERINNERUNG") return unanswered.length;
    return pl.mode === "MISSING" ? notInvited.length : byMail.length;
  }

  async function send(body: Record<string, unknown>, done: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ sent: number; failed: number; remaining: number; testOnly: boolean }>(url, { method: "POST", body });
      if (res.failed > 0) toast.error(`${res.sent} Mails versendet, ${res.failed} fehlgeschlagen. Details stehen im Versandprotokoll.`);
      else toast.success(done.replace("{n}", String(res.sent)));
      if (res.remaining > 0) toast.error(`Pro Versand gehen höchstens 200 Mails hinaus. Für die übrigen ${res.remaining} Personen wiederhole den Versand mit «An noch nicht Eingeladene» bzw. einer weiteren Erinnerung.`);
      setPlan(null);
      setAckLate(false);
      router.refresh();
    } catch (err) {
      const d = describeError(err, "Der Versand ist fehlgeschlagen.");
      setError(d.message);
      toast.error(d.message);
    } finally {
      setBusy(false);
    }
  }

  const timingVariant = p.timing.state === "ok" ? "success" : p.timing.state === "past" ? "info" : "warning";

  return (
    <section aria-labelledby="inv-h" className="space-y-5">
      <h2 id="inv-h" className="text-lg font-semibold text-white">
        Einladung
      </h2>

      <div className="space-y-3">
        <Notice variant={timingVariant}>
          <p>{p.timing.text}</p>
          {p.timing.state === "unknown" && !p.board && (
            <p className="mt-1">
              Trage die Einladungsfrist gemäss Statuten unter{" "}
              <Link href="/admin/verein" className="underline underline-offset-2">
                Vereinseinstellungen
              </Link>{" "}
              ein. Bis dahin ist der Versand der Einladung gesperrt.
            </p>
          )}
          {p.board && <p className="mt-1">Für Vorstandssitzungen gibt es keine Fristprüfung.</p>}
        </Notice>
        {p.invitationSentAtLabel && (
          <Notice variant={p.firstSentOnTime === false ? "warning" : "info"}>
            Erster Versand der Einladung: {p.invitationSentAtLabel}.
            {p.firstSentOnTime === true && " Die Einladungsfrist war eingehalten."}
            {p.firstSentOnTime === false && " Die Einladungsfrist war nicht eingehalten."}
          </Notice>
        )}
        {others.length > 0 && (
          <Notice variant="info">
            {others.length} {others.length === 1 ? "Person erhält" : "Personen erhalten"} keine E-Mail (Post oder keine gültige Adresse). Lade sie auf anderem Weg ein.
          </Notice>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Empfänger per E-Mail", byMail.length],
          ["Nimmt teil", counts.yes],
          ["Entschuldigt", counts.no],
          ["Ohne Antwort", counts.none],
        ].map(([label, n]) => (
          <Card key={label as string} className="p-4">
            <dt className="text-xs uppercase tracking-wide text-zinc-500">{label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-white">{n}</dd>
          </Card>
        ))}
      </dl>

      {p.canWrite && (
        <div className="flex flex-wrap gap-2">
          {p.canSend && (
            <>
              <Button type="button" disabled={sendBlocked || byMail.length === 0} onClick={() => { setError(null); setAckLate(false); setPlan({ kind: "EINLADUNG", mode: "ALL", label: first ? "Einladung versenden" : "Einladung erneut an alle senden" }); }}>
                <Send className="h-4 w-4" aria-hidden />
                {first ? "Einladung versenden" : "Einladung erneut an alle"}
              </Button>
              {!first && notInvited.length > 0 && (
                <Button type="button" variant="secondary" disabled={sendBlocked} onClick={() => { setError(null); setAckLate(false); setPlan({ kind: "EINLADUNG", mode: "MISSING", label: "Einladung an Nachzügler senden" }); }}>
                  <Mail className="h-4 w-4" aria-hidden />
                  An noch nicht Eingeladene ({notInvited.length})
                </Button>
              )}
              <Button type="button" variant="secondary" disabled={unanswered.length === 0 || first} onClick={() => { setError(null); setAckLate(false); setPlan({ kind: "ERINNERUNG", mode: "ALL", label: "Erinnerung versenden" }); }} title={first ? "Zuerst die Einladung versenden." : undefined}>
                <Bell className="h-4 w-4" aria-hidden />
                Erinnerung an Unbeantwortete ({unanswered.length})
              </Button>
              <Button type="button" variant="ghost" disabled={busy || sendBlocked} onClick={() => send({ kind: "EINLADUNG", testOnly: true }, "Testmail an deine Adresse versendet.")}>
                Testmail an mich
              </Button>
            </>
          )}
          <a href={`/api/admin/meetings/${encodeURIComponent(p.meetingId)}/ics`} className={buttonClass("ghost", "md")} download>
            Kalendereintrag (.ics)
          </a>
        </div>
      )}
      {!p.canSend && <Notice variant="info">Für abgesagte oder bereits begonnene Sitzungen lassen sich keine Einladungen mehr versenden.</Notice>}

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-zinc-300">Empfänger</h3>
          {!p.board && (
            <Link href={`?tab=einladung${p.includeNonVoting ? "" : "&alle=1"}`} className="text-sm text-emerald-400 hover:underline" replace>
              {p.includeNonVoting ? "Nur Stimmberechtigte anzeigen" : "Auch Mitglieder ohne Stimmrecht anzeigen"}
            </Link>
          )}
        </div>
        {p.recipients.length === 0 ? (
          <Notice variant="info">{p.board ? "Es sind keine aktiven Ämter eingetragen. Trage den Vorstand unter «Mitglieder, Ämter und Vorstand» ein." : "Es gibt keine aktiven stimmberechtigten Mitglieder."}</Notice>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto" role="region" aria-label="Empfänger" tabIndex={0}>
              <table className="w-full min-w-[34rem] text-left text-sm">
                <thead className="border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">Name</th>
                    <th scope="col" className="px-4 py-3 font-medium">Zustellung</th>
                    <th scope="col" className="px-4 py-3 font-medium">Eingeladen</th>
                    <th scope="col" className="px-4 py-3 font-medium">Rückmeldung</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {p.recipients.map((r) => (
                    <tr key={r.memberId}>
                      <td className="px-4 py-2.5 text-zinc-200">{r.name}</td>
                      <td className="px-4 py-2.5 text-zinc-400">{CHANNEL_LABEL[r.channel]}</td>
                      <td className="px-4 py-2.5">{r.invited ? <span className={cn(PILL, TONE_CLASS.green)}>Ja</span> : <span className="text-zinc-500">–</span>}</td>
                      <td className="px-4 py-2.5">
                        <RsvpPill rsvp={r.rsvp} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium text-zinc-300">Versandprotokoll</h3>
        {p.batches.length === 0 ? (
          <p className="text-sm text-zinc-500">Noch nichts versendet.</p>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto" role="region" aria-label="Versandprotokoll" tabIndex={0}>
              <table className="w-full min-w-[34rem] text-left text-sm">
                <thead className="border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">Zeitpunkt</th>
                    <th scope="col" className="px-4 py-3 font-medium">Art</th>
                    <th scope="col" className="px-4 py-3 font-medium">Von</th>
                    <th scope="col" className="px-4 py-3 font-medium">Ergebnis</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {p.batches.map((b) => (
                    <tr key={b.batchId} className="align-top">
                      <td className="px-4 py-2.5 tabular-nums text-zinc-300">{b.sentAtLabel}</td>
                      <td className="px-4 py-2.5 text-zinc-300">
                        {b.kind === "EINLADUNG" ? "Einladung" : b.kind === "ERINNERUNG" ? "Erinnerung" : "Absage"}
                        {b.late && <span className={cn(PILL, TONE_CLASS.amber, "ml-2")}>Frist unterschritten</span>}
                      </td>
                      <td className="px-4 py-2.5 text-zinc-400">{b.sentByName || "–"}</td>
                      <td className="px-4 py-2.5 text-zinc-300">
                        {b.ok} von {b.total} zugestellt
                        {b.failed > 0 && (
                          <details className="mt-1 text-xs text-rose-300">
                            <summary className="cursor-pointer">{b.failed} fehlgeschlagen</summary>
                            <ul className="mt-1 space-y-0.5">
                              {b.errors.map((e, i) => (
                                <li key={i}>
                                  {e.name}: {e.error || "unbekannter Fehler"}
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      <Modal open={plan !== null} onClose={() => !busy && setPlan(null)} title={plan?.label ?? ""} description={plan ? `Die Mail geht an ${planCount(plan)} ${planCount(plan) === 1 ? "Person" : "Personen"}.` : undefined} size="md" dismissible={!busy}>
        {plan && (
          <div className="space-y-4">
            {plan.kind === "ERINNERUNG" && <p className="text-sm text-zinc-300">Die Erinnerung erhalten nur Personen, die noch nicht geantwortet haben.</p>}
            {plan.kind === "EINLADUNG" && lateNow && (
              <Notice variant="warning">
                <p>{p.timing.text}</p>
                <div className="mt-3 flex items-start gap-2.5">
                  <input id="ack-late" type="checkbox" checked={ackLate} onChange={(e) => setAckLate(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-600 bg-surface accent-emerald-400" />
                  <label htmlFor="ack-late" className="text-sm">
                    Ich weiss, dass die Frist unterschritten ist, und möchte trotzdem einladen. Der Versand wird als verspätet protokolliert.
                  </label>
                </div>
              </Notice>
            )}
            {error && <Notice variant="error">{error}</Notice>}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => setPlan(null)} disabled={busy}>
                Abbrechen
              </Button>
              <Button
                type="button"
                disabled={busy || planCount(plan) === 0 || (plan.kind === "EINLADUNG" && lateNow && !ackLate)}
                onClick={() => send({ kind: plan.kind, mode: plan.mode, acknowledgeLate: ackLate, includeNonVoting: p.includeNonVoting }, plan.kind === "EINLADUNG" ? "Einladung an {n} Personen versendet." : "Erinnerung an {n} Personen versendet.")}
              >
                {busy ? "Wird versendet …" : "Jetzt versenden"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
