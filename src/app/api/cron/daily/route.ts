import { handle, ok } from "@/lib/api";
import { getLastRun, runDailyTasks } from "@/lib/verein/cron";
import { checkCronRequest } from "@/lib/verein/cron-auth";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Täglicher Lauf: fällige Austritte vollziehen, Anlass-Erinnerungen senden, abgelaufene unbestätigte Gast-Anmeldungen löschen.
 * Aufgerufen vom Dienst «cron» (scripts/cron-runner.mjs) intern von http://app:3000, z. B. von Hand:
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3000/api/cron/daily
 * Ohne die Umgebungsvariable CRON_SECRET (mindestens 24 Zeichen) gibt es die Schnittstelle nicht (404).
 * Die Antwort enthält nur Namen, Erfolg und Anzahl je Aufgabe, keine Personendaten.
 */
export const POST = handle(async (req: Request) => {
  const limited = checkCronRequest(req, ["CRON_SECRET"], "cron-daily");
  if (limited) return limited;
  const run = await runDailyTasks();
  return ok(run, 200, { headers: NO_STORE });
});

/** Ergebnis des letzten Laufs ({ lastRun } oder null); der Läufer entscheidet damit beim Start, ob er sofort laufen muss. */
export const GET = handle(async (req: Request) => {
  const limited = checkCronRequest(req, ["CRON_SECRET"], "cron-daily");
  if (limited) return limited;
  return ok({ lastRun: await getLastRun() }, 200, { headers: NO_STORE });
});
