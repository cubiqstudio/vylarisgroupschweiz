"use client";

import Link from "next/link";
import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { useToast } from "@/components/admin/core/toast";
import { cn } from "@/lib/utils";
import { Notice } from "./notice";

const MAX = 5000;

type ReplyResult = { reply: { id: string }; mailSent: boolean; mailError: string };

/** Antwortfeld: speichert die Antwort im Verlauf und sendet sie per E-Mail an den Absender. */
export function TicketReplyForm({
  id,
  recipientName,
  mailConfigured,
  apiBase = "/api/admin/tickets",
  settingsHref = "/admin/settings",
}: {
  id: string;
  recipientName: string;
  mailConfigured: boolean;
  /** Basis-URL der Ticket-API (Admin oder Team-Bereich) */
  apiBase?: string;
  /** Link zu den Mail-Einstellungen; im Team-Bereich null (dort gibt es sie nicht) */
  settingsHref?: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const uid = useId();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSend = mailConfigured && !busy && message.trim().length >= 2;

  async function send(e?: FormEvent) {
    e?.preventDefault();
    if (!canSend) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<ReplyResult>(`${apiBase}/${id}/reply`, { method: "POST", body: { message: message.trim() } });
      setMessage("");
      if (res?.mailSent === false) {
        toast.error(`Antwort gespeichert, aber nicht zugestellt${res.mailError ? `: ${res.mailError}` : "."}`);
      } else {
        toast.success("Antwort gesendet.");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? (err.fields?.message ?? err.message) : "Die Antwort konnte nicht gesendet werden.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={send} className="space-y-3" aria-busy={busy}>
      {!mailConfigured && (
        <Notice tone="info">
          Antworten per E-Mail sind erst möglich, wenn ein Mailserver eingerichtet ist.
          {settingsHref ? (
            <>
              {" "}
              <Link href={settingsHref} className="font-medium underline underline-offset-2">
                Zu den Einstellungen
              </Link>
            </>
          ) : (
            " Bitte wende dich an einen Administrator."
          )}
        </Notice>
      )}
      <div className="space-y-1.5">
        <label htmlFor={`${uid}-reply`} className="block text-sm font-medium text-zinc-300">
          Antwort an {recipientName}
        </label>
        <Textarea
          id={`${uid}-reply`}
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              void send();
            }
          }}
          rows={7}
          maxLength={MAX}
          disabled={!mailConfigured || busy}
          placeholder="Schreibe deine Antwort. Sie wird im Verlauf gespeichert und per E-Mail an den Absender gesendet."
          aria-describedby={`${uid}-count`}
          aria-invalid={!!error}
          className="resize-y"
        />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p id={`${uid}-count`} className={cn("text-xs tabular-nums", message.length > MAX * 0.95 ? "text-amber-400" : "text-zinc-500")}>
          {message.length.toLocaleString("de-DE")} / {MAX.toLocaleString("de-DE")} · Strg + Enter sendet
        </p>
        <Button type="submit" disabled={!canSend}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
          {busy ? "Wird gesendet …" : "Antwort senden"}
        </Button>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
    </form>
  );
}
