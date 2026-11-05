"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { CheckCircle2, Clock, LogOut, UserPlus } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/form";
import { ConfirmDialog } from "@/components/admin/core/confirm-dialog";
import { FieldBox, FormAlert, FormSuccess } from "@/components/account/form-parts";
import { useMessages } from "@/i18n/client";
import { vereinAnlaesse } from "@/i18n/verein-anlaesse";

type Props = {
  eventId: string;
  eventTitle: string;
  /** Eigene Anmeldung (bisher) */
  own: { status: "ANGEMELDET" | "WARTELISTE" | "ABGESAGT"; seats: number } | null;
  maxSeats: number;
  seatsLeft: number | null;
  /** Anmelden ist möglich (Anlass offen, Mitglied aktiv) */
  canRegister: boolean;
  /** Abmelden ist möglich (Anlass hat noch nicht begonnen) */
  canCancel: boolean;
};

/** Anmelden und Abmelden mit einem Klick für aktuelle Mitglieder. Betrifft immer nur die eigene Anmeldung (der Server leitet das Mitglied aus der Sitzung ab). */
export function MemberRegistration({ eventId, eventTitle, own, maxSeats, seatsLeft, canRegister, canCancel }: Props) {
  const m = useMessages(vereinAnlaesse).member;
  const router = useRouter();
  const uid = useId();
  const [seats, setSeats] = useState("1");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<string | null>(null);

  const active = own && own.status !== "ABGESAGT" ? own : null;
  const base = `/api/events/${encodeURIComponent(eventId)}/registration`;
  const fail = (err: unknown) => {
    if (err instanceof ApiClientError) {
      setFieldErrors(err.fields ?? {});
      setError(err.status === 429 ? m.tooMany : err.message);
    } else setError(m.failed);
  };

  async function register() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setFieldErrors({});
    setDone(null);
    try {
      const res = await api<{ status: string }>(base, { method: "POST", body: { seats, note } });
      setDone(res.status === "WARTELISTE" ? m.doneWaitlist : m.doneRegistered);
      router.refresh();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await api(base, { method: "DELETE" });
      setConfirm(false);
      setDone(m.doneCancelled);
      router.refresh();
    } catch (err) {
      setConfirm(false);
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  const max = seatsLeft !== null && seatsLeft > 0 ? Math.min(maxSeats, seatsLeft) : maxSeats;
  const waitlist = seatsLeft !== null && Number(seats) > seatsLeft;

  return (
    <div className="space-y-4">
      {error && (
        <FormAlert>
          <p>{error}</p>
        </FormAlert>
      )}
      {done && <FormSuccess>{done}</FormSuccess>}

      {active ? (
        <div className="space-y-3">
          <p className="flex items-start gap-2 text-sm font-medium text-white" role="status">
            {active.status === "ANGEMELDET" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" aria-hidden /> : <Clock className="mt-0.5 size-4 shrink-0 text-amber-300" aria-hidden />}
            <span>{active.status === "ANGEMELDET" ? m.registeredSeats(active.seats) : m.waitlisted}</span>
          </p>
          {canCancel && (
            <>
              <Button type="button" variant="secondary" onClick={() => setConfirm(true)} disabled={busy}>
                <LogOut className="size-4" aria-hidden />
                {m.cancel}
                <span className="sr-only"> ({eventTitle})</span>
              </Button>
              <ConfirmDialog
                open={confirm}
                title={m.cancelTitle}
                description={m.cancelText(eventTitle)}
                confirmLabel={busy ? m.cancelling : m.cancelConfirm}
                cancelLabel={m.cancelBack}
                danger
                busy={busy}
                onConfirm={cancel}
                onCancel={() => setConfirm(false)}
              />
            </>
          )}
        </div>
      ) : (
        canRegister && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void register();
            }}
            className="space-y-3"
            aria-busy={busy}
          >
            <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
              <FieldBox id={`${uid}-seats`} label={m.seatsLabel} error={fieldErrors.seats}>
                <Input id={`${uid}-seats`} type="number" min={1} max={max} inputMode="numeric" value={seats} onChange={(e) => setSeats(e.target.value)} disabled={busy} aria-invalid={fieldErrors.seats ? true : undefined} />
              </FieldBox>
              <FieldBox id={`${uid}-note`} label={m.noteLabel} error={fieldErrors.note}>
                <Textarea id={`${uid}-note`} rows={1} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} disabled={busy} aria-invalid={fieldErrors.note ? true : undefined} />
              </FieldBox>
            </div>
            <Button type="submit" disabled={busy}>
              <UserPlus className="size-4" aria-hidden />
              {busy ? m.registering : waitlist || seatsLeft === 0 ? m.registerWaitlist : m.register}
              <span className="sr-only"> ({eventTitle})</span>
            </Button>
          </form>
        )
      )}
    </div>
  );
}
