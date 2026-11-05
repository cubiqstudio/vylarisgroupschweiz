"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, Eye, EyeOff, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { api, ApiClientError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Notice } from "./notice";

export function PasswordForm() {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});

  const rules = [
    { ok: next.length >= 12, text: "Mindestens 12 Zeichen" },
    { ok: /[a-z]/.test(next), text: "Kleinbuchstaben" },
    { ok: /[A-Z]/.test(next), text: "Großbuchstaben" },
    { ok: /\d/.test(next), text: "Ziffern" },
  ];

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setSuccess(false);
    setError(null);

    // Gleiche Regeln wie passwordChangeSchema (src/lib/validation.ts); der Server prüft verbindlich erneut.
    const local: Record<string, string> = {};
    if (!current) local.currentPassword = "Aktuelles Passwort erforderlich.";
    if (next.length < 12) local.newPassword = "Mindestens 12 Zeichen.";
    else if (next.length > 200) local.newPassword = "Maximal 200 Zeichen.";
    else if (!(/[a-z]/.test(next) && /[A-Z]/.test(next) && /\d/.test(next))) local.newPassword = "Groß-/Kleinbuchstaben und Ziffern verwenden.";
    else if (next === current) local.newPassword = "Das neue Passwort muss sich vom aktuellen unterscheiden.";
    if (next !== repeat) local.repeat = "Die Wiederholung stimmt nicht überein.";
    if (Object.keys(local).length > 0) {
      setFields(local);
      return;
    }
    setFields({});

    setBusy(true);
    try {
      await api("/api/admin/account/password", { method: "PATCH", body: { currentPassword: current, newPassword: next } });
      setCurrent("");
      setNext("");
      setRepeat("");
      setSuccess(true);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setFields(err.fields ?? {});
        setError(err.fields ? "Bitte prüfe die markierten Felder." : err.message);
      } else {
        setError("Das Passwort konnte nicht geändert werden. Bitte versuche es erneut.");
      }
    } finally {
      setBusy(false);
    }
  }

  const invalid = (k: string) => (fields[k] ? true : undefined);

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {success && <Notice variant="success">Dein Passwort wurde geändert. Beim nächsten Login gilt das neue Passwort.</Notice>}
      {error && <Notice variant="error">{error}</Notice>}

      <Field label="Aktuelles Passwort" htmlFor="currentPassword" error={fields.currentPassword}>
        <Input
          id="currentPassword"
          type={show ? "text" : "password"}
          autoComplete="current-password"
          value={current}
          required
          disabled={busy}
          aria-invalid={invalid("currentPassword")}
          onChange={(e) => setCurrent(e.target.value)}
        />
      </Field>
      <Field label="Neues Passwort" htmlFor="newPassword" error={fields.newPassword}>
        <Input
          id="newPassword"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          value={next}
          required
          disabled={busy}
          aria-invalid={invalid("newPassword")}
          aria-describedby="password-rules"
          onChange={(e) => setNext(e.target.value)}
        />
      </Field>
      <ul id="password-rules" className="grid gap-1.5 text-xs sm:grid-cols-2" aria-label="Anforderungen an das neue Passwort">
        {rules.map((r) => (
          <li key={r.text} className={cn("flex items-center gap-2", r.ok ? "text-emerald-400" : "text-zinc-500")}>
            <Check className={cn("h-3.5 w-3.5", r.ok ? "opacity-100" : "opacity-30")} aria-hidden="true" />
            <span>
              {r.text}
              <span className="sr-only">{r.ok ? " – erfüllt" : " – noch offen"}</span>
            </span>
          </li>
        ))}
      </ul>
      <Field label="Neues Passwort wiederholen" htmlFor="repeat" error={fields.repeat}>
        <Input
          id="repeat"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          value={repeat}
          required
          disabled={busy}
          aria-invalid={invalid("repeat")}
          onChange={(e) => setRepeat(e.target.value)}
        />
      </Field>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-pressed={show}
          className="inline-flex items-center gap-2 self-start rounded-lg px-2 py-1.5 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-white"
        >
          {show ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
          {show ? "Passwörter verbergen" : "Passwörter anzeigen"}
        </button>
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
          {busy ? "Speichern …" : "Passwort ändern"}
        </Button>
      </div>
    </form>
  );
}
