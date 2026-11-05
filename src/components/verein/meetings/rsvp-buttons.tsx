"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { useMessages } from "@/i18n/client";
import { versammlungen } from "@/i18n/verein-versammlungen";
import { api, ApiClientError } from "@/lib/api-client";

type Rsvp = "" | "ZUSAGE" | "ABSAGE";

/**
 * Rückmeldung zu einer Versammlung. Mit `token` (Link aus der Einladung, ohne Anmeldung) oder als angemeldetes Mitglied
 * (dann ergibt sich die Person aus der Sitzung, nie aus der Anfrage).
 */
export function RsvpButtons({ meetingId, token, initial, open }: { meetingId: string; token?: string; initial: Rsvp; open: boolean }) {
  const m = useMessages(versammlungen).rsvp;
  const router = useRouter();
  const [state, setState] = useState<Rsvp>(initial);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<Rsvp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Rsvp>("");

  async function send(status: "ZUSAGE" | "ABSAGE") {
    if (busy) return;
    setBusy(status);
    setError(null);
    try {
      if (token) await api("/api/meetings/rsvp", { method: "POST", body: { token, status, note: note.trim() } });
      else await api(`/api/account/verein/meetings/${encodeURIComponent(meetingId)}/rsvp`, { method: "POST", body: { status, note: note.trim() } });
      setState(status);
      setSaved(status);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : m.failed);
    } finally {
      setBusy(null);
    }
  }

  const current = state === "ZUSAGE" ? m.currentYes : state === "ABSAGE" ? m.currentNo : m.none;
  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-300" aria-live="polite">
        {saved ? (saved === "ZUSAGE" ? m.savedYes : m.savedNo) : current}
      </p>
      {open ? (
        <>
          <div className="flex flex-wrap gap-2" role="group" aria-label={m.question}>
            <Button type="button" variant={state === "ZUSAGE" ? "primary" : "secondary"} aria-pressed={state === "ZUSAGE"} disabled={busy !== null} onClick={() => send("ZUSAGE")}>
              <Check className="h-4 w-4" aria-hidden />
              {busy === "ZUSAGE" ? m.saving : m.yes}
            </Button>
            <Button type="button" variant={state === "ABSAGE" ? "primary" : "secondary"} aria-pressed={state === "ABSAGE"} disabled={busy !== null} onClick={() => send("ABSAGE")}>
              <X className="h-4 w-4" aria-hidden />
              {busy === "ABSAGE" ? m.saving : m.no}
            </Button>
          </div>
          <Field label={m.noteLabel} htmlFor={`rsvp-note-${meetingId}`} className="max-w-md">
            <Input id={`rsvp-note-${meetingId}`} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} autoComplete="off" />
          </Field>
          <p className="text-xs text-zinc-500">{m.change}</p>
        </>
      ) : (
        <p className="text-sm text-zinc-500">{m.closed}</p>
      )}
      {error && (
        <p role="alert" className="text-sm text-rose-400">
          {error}
        </p>
      )}
    </div>
  );
}
