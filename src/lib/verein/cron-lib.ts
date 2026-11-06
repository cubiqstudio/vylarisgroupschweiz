// Täglicher Lauf: Datentypen und reine Funktionen (Anzeige, Prüfung des gespeicherten Ergebnisses). Kein Datenbankzugriff.
// Ausführung und Aufgabenliste: ./cron.ts. Läufer ausserhalb der App: scripts/cron-runner.mjs.

/** Schlüssel in der Einstellungstabelle (SiteSetting), unter dem das Ergebnis des letzten Laufs liegt. */
export const CRON_LAST_RUN_KEY = "cron.lastRun";

/** Nach dieser Zeit ohne Lauf gilt der tägliche Lauf als nicht eingerichtet oder gestört (36 Stunden). */
export const CRON_STALE_AFTER_MS = 36 * 3_600_000;

/** Mindestlänge des Geheimnisses (CRON_SECRET, EVENTS_CRON_SECRET). */
export const CRON_MIN_SECRET_LENGTH = 24;

/**
 * Hinweistext, wenn eine Mail-Aufgabe mangels eingerichtetem Mailserver übersprungen wurde. Das ist kein Fehler: Die Aufgabe gilt als
 * erledigt (ok), nichts wird als versendet markiert, und die Erinnerungen werden nach der Einrichtung nachgeholt (solange sie fällig sind).
 */
export const MAIL_SKIPPED_NOTE = "Kein Mailserver eingerichtet, Erinnerungen wurden nicht verschickt.";

/**
 * Ergebnis einer Tagesaufgabe. Enthält nie Personendaten: nur Name, Erfolg, Anzahl und eine kurze Fehlerart.
 * `note` ist ein neutraler Hinweis bei einer übersprungenen Aufgabe (ok bleibt true).
 */
export type CronTaskResult = { name: string; ok: boolean; count: number; error?: string; note?: string };

/** Ergebnis eines Laufs. */
export type CronRun = { startedAt: string; finishedAt: string; ok: boolean; tasks: CronTaskResult[] };

/** Anzeigenamen der Aufgaben (Schlüssel = CronTaskResult.name). */
export const CRON_TASK_LABELS: Readonly<Record<string, string>> = {
  "exits-complete": "Fällige Austritte vollziehen",
  "event-reminders": "Erinnerungen zu Anlässen",
  "registrations-purge": "Unbestätigte Gast-Anmeldungen löschen",
  "guest-data-anonymize": "Angaben von Gästen nach dem Anlass entfernen",
};

export function cronTaskLabel(name: string): string {
  return CRON_TASK_LABELS[name] ?? name;
}

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

function isIso(value: unknown): value is string {
  return typeof value === "string" && ISO.test(value) && !Number.isNaN(Date.parse(value));
}

/** Liest den gespeicherten Wert tolerant: Ungültiges oder Fehlendes ergibt null (= «nie gelaufen»). */
export function parseCronRun(raw: string | null | undefined): CronRun | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (!isIso(v.startedAt) || !isIso(v.finishedAt) || !Array.isArray(v.tasks)) return null;
  const tasks: CronTaskResult[] = [];
  for (const t of v.tasks.slice(0, 20)) {
    if (!t || typeof t !== "object") continue;
    const r = t as Record<string, unknown>;
    if (typeof r.name !== "string" || typeof r.ok !== "boolean") continue;
    tasks.push({
      name: r.name.slice(0, 60),
      ok: r.ok,
      count: typeof r.count === "number" && Number.isFinite(r.count) ? Math.max(0, Math.trunc(r.count)) : 0,
      ...(typeof r.error === "string" && r.error ? { error: r.error.slice(0, 200) } : {}),
      ...(typeof r.note === "string" && r.note ? { note: r.note.slice(0, 200) } : {}),
    });
  }
  return { startedAt: v.startedAt, finishedAt: v.finishedAt, ok: tasks.every((t) => t.ok), tasks };
}

/** Hat mindestens eine Aufgabe des Laufs etwas übersprungen (z. B. mangels Mailserver)? */
export function cronRunHasNotes(run: CronRun | null): boolean {
  return Boolean(run?.tasks.some((t) => t.ok && t.note));
}

export type CronHealth = "ok" | "failed" | "stale" | "never";

/** Zustand des täglichen Laufs: nie gelaufen, zu lange her, mit Fehlern oder in Ordnung. */
export function cronHealth(run: CronRun | null, now: Date = new Date()): CronHealth {
  if (!run) return "never";
  const finished = Date.parse(run.finishedAt);
  if (Number.isNaN(finished) || now.getTime() - finished > CRON_STALE_AFTER_MS) return "stale";
  return run.ok ? "ok" : "failed";
}

/** Ist der letzte Lauf zu lange her (oder nie gewesen)? Der Läufer holt ihn dann beim Start nach. */
export function cronIsOverdue(run: CronRun | null, now: Date = new Date()): boolean {
  const h = cronHealth(run, now);
  return h === "never" || h === "stale";
}
