"use client";

import Link from "next/link";
import { useId, useState, type FormEvent } from "react";
import { BellRing, MailCheck, MailX, Settings2 } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { Modal } from "@/components/admin/core/modal";
import { useToast } from "@/components/admin/core/toast";
import { cn } from "@/lib/utils";
import { Notice } from "./notice";

export type TicketMailSettingsValue = { confirmationEnabled: boolean; notifyEmail: string };

/** Kompakte Übersicht der Ticket-Mail-Einstellungen mit Dialog zum Bearbeiten (GET/PUT /api/admin/settings/tickets). */
export function TicketMailSettings({ initial, mailConfigured }: { initial: TicketMailSettingsValue; mailConfigured: boolean }) {
  const [saved, setSaved] = useState(initial);
  const [open, setOpen] = useState(false);

  return (
    <>
      <Card className="mb-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex min-w-0 items-start gap-3.5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-400 ring-1 ring-inset ring-emerald-400/25">
            <BellRing className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-white">E-Mail-Benachrichtigungen</h2>
            <ul className="mt-1 space-y-0.5 text-sm text-zinc-400">
              <li className="flex items-center gap-1.5">
                {saved.confirmationEnabled ? (
                  <MailCheck className="size-3.5 shrink-0 text-green-700" aria-hidden />
                ) : (
                  <MailX className="size-3.5 shrink-0 text-zinc-500" aria-hidden />
                )}
                Eingangsbestätigung an den Absender: {saved.confirmationEnabled ? "an" : "aus"}
              </li>
              <li className="flex items-center gap-1.5">
                {saved.notifyEmail ? (
                  <MailCheck className="size-3.5 shrink-0 text-green-700" aria-hidden />
                ) : (
                  <MailX className="size-3.5 shrink-0 text-zinc-500" aria-hidden />
                )}
                <span className="min-w-0 break-all">
                  Hinweis bei neuen Tickets: {saved.notifyEmail ? `an ${saved.notifyEmail}` : "keine Adresse hinterlegt"}
                </span>
              </li>
            </ul>
            {!mailConfigured && (
              <p className="mt-1.5 text-xs text-amber-400">
                Es ist noch kein Mailserver eingerichtet – E-Mails werden erst nach der{" "}
                <Link href="/admin/settings" className="underline underline-offset-2">
                  Einrichtung
                </Link>{" "}
                versendet.
              </p>
            )}
          </div>
        </div>
        <Button type="button" variant="secondary" onClick={() => setOpen(true)} className="shrink-0">
          <Settings2 className="h-4 w-4" aria-hidden />
          Einstellungen
        </Button>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="E-Mail-Benachrichtigungen"
        description="Lege fest, wann bei Tickets automatisch E-Mails verschickt werden."
      >
        <SettingsForm
          initial={saved}
          mailConfigured={mailConfigured}
          onCancel={() => setOpen(false)}
          onSaved={(v) => {
            setSaved(v);
            setOpen(false);
          }}
        />
      </Modal>
    </>
  );
}

function SettingsForm({
  initial,
  mailConfigured,
  onCancel,
  onSaved,
}: {
  initial: TicketMailSettingsValue;
  mailConfigured: boolean;
  onCancel: () => void;
  onSaved: (v: TicketMailSettingsValue) => void;
}) {
  const toast = useToast();
  const uid = useId();
  const [enabled, setEnabled] = useState(initial.confirmationEnabled);
  const [email, setEmail] = useState(initial.notifyEmail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | undefined>();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setEmailError(undefined);
    try {
      const saved = await api<TicketMailSettingsValue>("/api/admin/settings/tickets", {
        method: "PUT",
        body: { confirmationEnabled: enabled, notifyEmail: email.trim() },
      });
      toast.success("Einstellungen gespeichert.");
      onSaved({ confirmationEnabled: saved?.confirmationEnabled ?? enabled, notifyEmail: saved?.notifyEmail ?? email.trim().toLowerCase() });
    } catch (err) {
      if (err instanceof ApiClientError) {
        setEmailError(err.fields?.notifyEmail);
        setError(err.fields?.notifyEmail ? null : err.message);
      } else {
        setError("Einstellungen konnten nicht gespeichert werden.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" aria-busy={busy}>
      {!mailConfigured && <Notice tone="info">Ohne eingerichteten Mailserver werden keine E-Mails versendet. Die Einstellungen werden trotzdem gespeichert.</Notice>}

      <div className="flex items-start justify-between gap-4 rounded-xl border border-zinc-800 p-4">
        <div className="min-w-0">
          <label htmlFor={`${uid}-confirm`} className="text-sm font-medium text-zinc-100">
            Eingangsbestätigung
          </label>
          <p id={`${uid}-confirm-hint`} className="mt-0.5 text-sm text-zinc-400">
            Sendet dem Absender direkt nach dem Absenden eine Bestätigung mit der Ticket-ID.
          </p>
        </div>
        <button
          id={`${uid}-confirm`}
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-describedby={`${uid}-confirm-hint`}
          onClick={() => setEnabled((v) => !v)}
          className={cn(
            "relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400",
            enabled ? "bg-emerald-400" : "bg-zinc-700",
          )}
        >
          <span
            className={cn(
              "inline-block size-5 rounded-full bg-surface shadow transition-transform motion-reduce:transition-none",
              enabled ? "translate-x-[1.375rem]" : "translate-x-0.5",
            )}
            aria-hidden
          />
          <span className="sr-only">{enabled ? "An" : "Aus"}</span>
        </button>
      </div>

      <Field
        label="Hinweis bei neuen Tickets an"
        htmlFor={`${uid}-notify`}
        error={emailError}
        hint="Optional. An diese Adresse geht bei jedem neuen Ticket eine Hinweis-Mail. Leer lassen, um keine zu senden."
      >
        <Input
          id={`${uid}-notify`}
          type="email"
          inputMode="email"
          autoComplete="off"
          maxLength={200}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setEmailError(undefined);
          }}
          aria-invalid={!!emailError}
        />
      </Field>

      {error && <Notice tone="error">{error}</Notice>}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
          Abbrechen
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Wird gespeichert …" : "Speichern"}
        </Button>
      </div>
    </form>
  );
}
