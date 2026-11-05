"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { api } from "@/lib/api-client";
import { Notice } from "@/components/admin/core/notice";
import { useToast } from "@/components/admin/core/toast";
import { describeError } from "./form-utils";

export type MailSecurity = "NONE" | "STARTTLS" | "SSL";
export type MailValues = {
  host: string;
  port: number;
  security: MailSecurity;
  user: string;
  hasPassword: boolean;
  passwordUnreadable: boolean;
  fromName: string;
  fromEmail: string;
};

const DEFAULT_PORT: Record<MailSecurity, number> = { NONE: 25, STARTTLS: 587, SSL: 465 };
const SECURITY_LABEL: Record<MailSecurity, string> = {
  NONE: "Keine Verschlüsselung",
  STARTTLS: "STARTTLS (Port 587)",
  SSL: "SSL/TLS = SMTPS (Port 465)",
};

export function MailForm({ initial, configured, adminEmail }: { initial: MailValues; configured: boolean; adminEmail: string }) {
  const router = useRouter();
  const toast = useToast();

  const [host, setHost] = useState(initial.host);
  const [port, setPort] = useState(String(initial.port));
  const [portTouched, setPortTouched] = useState(false);
  const [security, setSecurity] = useState<MailSecurity>(initial.security);
  const [user, setUser] = useState(initial.user);
  const [password, setPassword] = useState("");
  const [clearPassword, setClearPassword] = useState(false);
  const [fromName, setFromName] = useState(initial.fromName);
  const [fromEmail, setFromEmail] = useState(initial.fromEmail);

  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  const [to, setTo] = useState(adminEmail);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const touch = () => setDirty(true);
  const invalid = (k: string) => (fields[k] ? true : undefined);
  const hasStoredPassword = initial.hasPassword && !clearPassword;

  function onSecurityChange(next: MailSecurity) {
    // Standard-Port nur vorschlagen, wenn der Port nicht von Hand geändert wurde (oder noch dem alten Standard entspricht).
    if (!portTouched || Number(port) === DEFAULT_PORT[security]) setPort(String(DEFAULT_PORT[next]));
    setSecurity(next);
    touch();
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setFields({});

    const portNum = Number(port);
    if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
      setFields({ port: "Port zwischen 1 und 65535 angeben." });
      setError("Bitte prüfe die markierten Felder.");
      return;
    }

    // password: weglassen = unverändert, "" = löschen
    const body: Record<string, unknown> = { host, port: portNum, security, user, fromName, fromEmail };
    if (clearPassword) body.password = "";
    else if (password) body.password = password;

    setBusy(true);
    try {
      await api("/api/admin/settings/mail", { method: "PUT", body });
      toast.success("E-Mail-Einstellungen gespeichert.");
      setPassword("");
      setClearPassword(false);
      setDirty(false);
      setTestResult(null);
      router.refresh();
    } catch (err) {
      const d = describeError(err, "Die Einstellungen konnten nicht gespeichert werden.");
      setError(d.message);
      setFields(d.fields);
    } finally {
      setBusy(false);
    }
  }

  async function sendTest(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (testing) return;
    setTesting(true);
    setTestResult(null);
    try {
      await api("/api/admin/settings/mail/test", { method: "POST", body: { to } });
      setTestResult({ ok: true, message: `Testmail an ${to} wurde versendet. Prüfe dein Postfach (auch den Spam-Ordner).` });
    } catch (err) {
      setTestResult({ ok: false, message: describeError(err, "Die Testmail konnte nicht gesendet werden.").message });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-8">
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {configured ? (
          <Notice variant="success">Ein Mailserver ist eingerichtet. Bestätigungs- und Passwort-Reset-Mails werden darüber versendet.</Notice>
        ) : (
          <Notice variant="info">
            Noch kein Mailserver eingerichtet. Trage die SMTP-Zugangsdaten deines Mail-Anbieters ein – ohne sie ist keine Registrierung möglich.
          </Notice>
        )}
        {initial.passwordUnreadable && (
          <Notice variant="warning">
            Das gespeicherte Passwort kann nicht mehr entschlüsselt werden (z. B. weil sich AUTH_SECRET geändert hat). Bitte gib das SMTP-Passwort neu ein und speichere.
          </Notice>
        )}
        {error && <Notice variant="error">{error}</Notice>}

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="SMTP-Server" htmlFor="mail-host" error={fields.host} hint="z. B. smtp.example.org">
            <Input
              id="mail-host"
              value={host}
              onChange={(e) => { setHost(e.target.value); touch(); }}
              maxLength={253}
              disabled={busy}
              aria-invalid={invalid("host")}
              autoComplete="off"
              spellCheck={false}
              inputMode="url"
            />
          </Field>
          <Field label="Verschlüsselung" htmlFor="mail-security" error={fields.security}>
            <Select
              id="mail-security"
              value={security}
              onChange={(e) => onSecurityChange(e.target.value as MailSecurity)}
              disabled={busy}
              aria-invalid={invalid("security")}
            >
              {(Object.keys(SECURITY_LABEL) as MailSecurity[]).map((s) => (
                <option key={s} value={s}>
                  {SECURITY_LABEL[s]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Port" htmlFor="mail-port" error={fields.port}>
            <Input
              id="mail-port"
              type="number"
              inputMode="numeric"
              min={1}
              max={65535}
              value={port}
              onChange={(e) => { setPort(e.target.value); setPortTouched(true); touch(); }}
              disabled={busy}
              aria-invalid={invalid("port")}
            />
          </Field>
          <Field label="Benutzername (optional)" htmlFor="mail-user" error={fields.user}>
            <Input
              id="mail-user"
              value={user}
              onChange={(e) => { setUser(e.target.value); touch(); }}
              maxLength={200}
              disabled={busy}
              aria-invalid={invalid("user")}
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
          <div className="space-y-2 sm:col-span-2">
            <Field
              label="Passwort"
              htmlFor="mail-password"
              error={fields.password}
              hint={hasStoredPassword ? "Ein Passwort ist gespeichert. Leer lassen, um es unverändert zu lassen." : undefined}
            >
              <Input
                id="mail-password"
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); if (e.target.value) setClearPassword(false); touch(); }}
                placeholder={hasStoredPassword ? "••••••••" : ""}
                maxLength={500}
                disabled={busy || clearPassword}
                aria-invalid={invalid("password")}
                autoComplete="new-password"
              />
            </Field>
            {initial.hasPassword && (
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-zinc-400">
                <input
                  type="checkbox"
                  checked={clearPassword}
                  disabled={busy}
                  onChange={(e) => { setClearPassword(e.target.checked); if (e.target.checked) setPassword(""); touch(); }}
                  className="h-4 w-4 rounded border-zinc-700 accent-emerald-400"
                />
                Gespeichertes Passwort beim Speichern löschen
              </label>
            )}
          </div>
          <Field label="Absendername (optional)" htmlFor="mail-from-name" error={fields.fromName}>
            <Input
              id="mail-from-name"
              value={fromName}
              onChange={(e) => { setFromName(e.target.value); touch(); }}
              maxLength={100}
              disabled={busy}
              aria-invalid={invalid("fromName")}
              autoComplete="off"
            />
          </Field>
          <Field label="Absenderadresse" htmlFor="mail-from-email" error={fields.fromEmail} hint="Muss beim Mail-Anbieter als Absender zugelassen sein.">
            <Input
              id="mail-from-email"
              type="email"
              value={fromEmail}
              onChange={(e) => { setFromEmail(e.target.value); touch(); }}
              maxLength={200}
              disabled={busy}
              aria-invalid={invalid("fromEmail")}
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
            {busy ? "Speichern …" : "Speichern"}
          </Button>
        </div>
      </form>

      <form onSubmit={sendTest} noValidate className="space-y-4 border-t border-zinc-800 pt-6">
        <div>
          <h3 className="text-sm font-semibold text-white">Testmail senden</h3>
          <p className="mt-1 text-sm text-zinc-400">Verschickt eine Testnachricht mit den gespeicherten Einstellungen, um Zugangsdaten und Verschlüsselung zu prüfen.</p>
        </div>
        {dirty && <Notice variant="warning">Du hast ungespeicherte Änderungen. Die Testmail nutzt die zuletzt gespeicherten Einstellungen – speichere zuerst.</Notice>}
        {testResult && <Notice variant={testResult.ok ? "success" : "error"}>{testResult.message}</Notice>}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label="Empfängeradresse" htmlFor="mail-test-to" className="sm:flex-1">
            <Input
              id="mail-test-to"
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              maxLength={200}
              disabled={testing}
              autoComplete="email"
            />
          </Field>
          <Button type="submit" variant="secondary" disabled={testing || !configured || !to.trim()}>
            {testing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
            {testing ? "Sende …" : "Testmail senden"}
          </Button>
        </div>
        {!configured && <p className="text-xs text-zinc-500">Speichere zuerst die SMTP-Einstellungen, um eine Testmail zu senden.</p>}
      </form>
    </div>
  );
}
