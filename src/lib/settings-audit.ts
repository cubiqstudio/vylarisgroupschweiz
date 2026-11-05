// Protokollinhalt für Änderungen an sensiblen Systemeinstellungen (Mailserver). Reine Funktion ohne Seiteneffekte.
// Das Passwort gelangt nie ins Protokoll, nur der Vermerk «Passwort geändert» bzw. «Passwort entfernt».

export type MailSettingsView = { host: string; port: number; security: string; user: string; fromName: string; fromEmail: string; hasPassword: boolean };
export type MailSettingsChange = { host: string; port: number; security: string; user: string; fromName: string; fromEmail: string; password?: string };

const FIELDS = ["host", "port", "security", "user", "fromName", "fromEmail"] as const;

/** Geänderte Felder (vorher/nachher) und Hinweis zum Passwort. Leeres `changed` = nichts geändert. */
export function mailSettingsAudit(before: MailSettingsView, next: MailSettingsChange): { changed: string[]; before: Record<string, unknown>; after: Record<string, unknown> } {
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  const changed: string[] = [];
  for (const f of FIELDS) {
    const prev = before[f];
    const now = typeof next[f] === "string" ? (next[f] as string).trim() : next[f];
    if (prev !== now) {
      b[f] = prev;
      a[f] = now;
      changed.push(f);
    }
  }
  if (next.password !== undefined) {
    if (next.password === "" && before.hasPassword) {
      changed.push("password");
      b.password = "[gesetzt]";
      a.password = "[entfernt]";
    } else if (next.password !== "") {
      changed.push("password");
      b.password = before.hasPassword ? "[gesetzt]" : "[nicht gesetzt]";
      a.password = "[geändert]";
    }
  }
  return { changed, before: b, after: a };
}
