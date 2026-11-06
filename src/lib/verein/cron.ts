// Täglicher Lauf (nur auf dem Server): Liste der Tagesaufgaben und runDailyTasks().
//
// Aufgerufen wird der Lauf von POST /api/cron/daily (Bearer-Token CRON_SECRET), das der Dienst «cron» aus docker-compose.yml täglich
// um 03:15 Uhr (Europe/Zurich) auslöst (scripts/cron-runner.mjs). Jede Aufgabe läuft für sich abgesichert: Ein Fehler in einer Aufgabe
// stoppt die anderen nicht. Das Ergebnis (Name, Erfolg, Anzahl) enthält keine Personendaten und wird als «cron.lastRun» in der
// Einstellungstabelle gespeichert; die Übersicht der Verwaltung zeigt es an.
//
// Neue Tagesaufgabe: einen Eintrag in DAILY_TASKS ergänzen (und den Anzeigenamen in cron-lib.ts, CRON_TASK_LABELS). Die Aufgabe
// liefert die Anzahl der bearbeiteten Einträge; ein Fehler wird als Ausnahme gemeldet. Aufgaben müssen wiederholbar sein
// (der Läufer versucht es bei einem Fehler noch zweimal).
import "server-only";
import { ApiError, describeErrorForLog } from "@/lib/api";
import { db } from "@/lib/db";
import { SYSTEM_ACTOR } from "./audit";
import { CRON_LAST_RUN_KEY, MAIL_SKIPPED_NOTE, parseCronRun, type CronRun, type CronTaskResult } from "./cron-lib";
import { purgeExpiredUnconfirmedRegistrations } from "./events-confirm";
import { anonymizePastGuestRegistrations } from "./events-guests";
import { sendEventReminders } from "./events-ops";
import { completeDueExitsAs } from "./members-data";

export type CronTask = {
  /** Technischer Name (Schlüssel im Ergebnis, Anzeigename in CRON_TASK_LABELS) */
  name: string;
  /** Führt die Aufgabe aus. Gibt die Anzahl der bearbeiteten Einträge zurück; ein Fehler wird als Ausnahme geworfen. */
  run: () => Promise<number | { count: number; failed?: number; note?: string }>;
};

/** Die Tagesaufgaben in der Reihenfolge der Ausführung. */
export const DAILY_TASKS: readonly CronTask[] = [
  // Austritte, deren letzter Tag der Mitgliedschaft vorbei ist (Frist wurde schon beim Erfassen geprüft), gleiche Fachlogik wie «Austritt vollziehen».
  { name: "exits-complete", run: async () => (await completeDueExitsAs(SYSTEM_ACTOR)).length },
  // Erinnerungsmails für Anlässe, die bald beginnen (jede Anmeldung höchstens einmal). Ohne eingerichteten Mailserver wird übersprungen
  // (kein Fehler, nichts als erinnert markiert); ein eingerichteter Mailserver, der den Versand ablehnt, bleibt ein Fehler.
  {
    name: "event-reminders",
    run: async () => {
      const s = await sendEventReminders({ actor: SYSTEM_ACTOR });
      if (s.skipped > 0) return { count: s.mailed, failed: s.failed, note: MAIL_SKIPPED_NOTE };
      return { count: s.mailed, failed: s.failed };
    },
  },
  // Unbestätigte Gast-Anmeldungen löschen, sobald die Frist von 48 Stunden abgelaufen ist (Datensparsamkeit).
  { name: "registrations-purge", run: async () => (await purgeExpiredUnconfirmedRegistrations()).deleted },
  // Gast-Anmeldungen vergangener Anlässe: Name, E-Mail-Adresse und Bemerkung entfernen (GUEST_RETENTION_DAYS nach dem Anlass), Akteur «System».
  { name: "guest-data-anonymize", run: async () => (await anonymizePastGuestRegistrations()).anonymized },
];

/** Kurze Fehlerangabe ohne Personendaten: Meldung nur bei eigenen Fehlern der App, sonst nur die Art des Fehlers. */
function errorSummary(e: unknown): string {
  if (e instanceof ApiError) return e.message.slice(0, 200);
  return `Unerwarteter Fehler (${describeErrorForLog(e)})`.slice(0, 200);
}

async function runTask(task: CronTask): Promise<CronTaskResult> {
  try {
    const out = await task.run();
    const count = typeof out === "number" ? out : out.count;
    const failed = typeof out === "number" ? 0 : (out.failed ?? 0);
    if (failed > 0) return { name: task.name, ok: false, count, error: `${failed} ${failed === 1 ? "Eintrag" : "Einträge"} konnten nicht verarbeitet werden` };
    const note = typeof out === "number" ? undefined : out.note;
    return { name: task.name, ok: true, count, ...(note ? { note } : {}) };
  } catch (e) {
    // Nur Name der Aufgabe und Art des Fehlers ins Log: keine Meldungstexte, die Personendaten enthalten könnten.
    console.error(`[cron] Aufgabe «${task.name}» fehlgeschlagen:`, describeErrorForLog(e));
    return { name: task.name, ok: false, count: 0, error: errorSummary(e) };
  }
}

let running = false;

/**
 * Führt alle Tagesaufgaben nacheinander aus und speichert das Ergebnis (Schlüssel «cron.lastRun»).
 * `tasks`, `now` und `save` sind für Tests austauschbar. Läuft schon ein Lauf, wird kein zweiter gestartet (409).
 */
export async function runDailyTasks(opts: { tasks?: readonly CronTask[]; now?: () => Date; save?: boolean } = {}): Promise<CronRun> {
  if (running) throw new ApiError(409, "CONFLICT", "Der tägliche Lauf läuft bereits.");
  running = true;
  try {
    const clock = opts.now ?? (() => new Date());
    const startedAt = clock();
    const tasks: CronTaskResult[] = [];
    for (const task of opts.tasks ?? DAILY_TASKS) tasks.push(await runTask(task));
    const run: CronRun = { startedAt: startedAt.toISOString(), finishedAt: clock().toISOString(), ok: tasks.every((t) => t.ok), tasks };
    if (opts.save !== false) await saveLastRun(run);
    return run;
  } finally {
    running = false;
  }
}

async function saveLastRun(run: CronRun): Promise<void> {
  const value = JSON.stringify(run);
  try {
    await db.siteSetting.upsert({ where: { key: CRON_LAST_RUN_KEY }, create: { key: CRON_LAST_RUN_KEY, value }, update: { value } });
  } catch (e) {
    // Ein Fehler beim Speichern darf den Lauf nicht als gescheitert erscheinen lassen; die Aufgaben sind erledigt.
    console.error("[cron] Ergebnis konnte nicht gespeichert werden:", describeErrorForLog(e));
  }
}

/** Ergebnis des letzten Laufs (null = nie gelaufen oder nicht lesbar). */
export async function getLastRun(): Promise<CronRun | null> {
  const row = await db.siteSetting.findUnique({ where: { key: CRON_LAST_RUN_KEY }, select: { value: true } });
  return parseCronRun(row?.value);
}
