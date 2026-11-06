import { handle, ok } from "@/lib/api";
import { checkCronRequest } from "@/lib/verein/cron-auth";
import { sendEventReminders } from "@/lib/verein/events-ops";

export const dynamic = "force-dynamic";

/**
 * Erinnerungsmails für Anlässe, die innerhalb der nächsten 36 Stunden beginnen (jede Anmeldung höchstens einmal).
 * Der tägliche Lauf (POST /api/cron/daily, Dienst «cron») erledigt das bereits mit; diese Route bleibt für eigene Aufrufe, z. B.:
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://vylaris.ch/api/events/reminders
 * Gültig ist CRON_SECRET oder (weiterhin, optional) EVENTS_CRON_SECRET, je mindestens 24 Zeichen. Ohne eines von beiden ist die Schnittstelle abgeschaltet.
 * Von Hand lösen Vorstandsmitglieder die Erinnerung auf der Seite des Anlasses aus.
 */
export const POST = handle(async (req: Request) => {
  // EVENTS_CRON_SECRET bleibt gültig (bestehende Einrichtungen); zusätzlich gilt das Geheimnis des täglichen Laufs (CRON_SECRET).
  const limited = checkCronRequest(req, ["EVENTS_CRON_SECRET", "CRON_SECRET"], "event-cron");
  if (limited) return limited;

  const summary = await sendEventReminders();
  return ok(summary, 200, { headers: { "Cache-Control": "no-store" } });
});
