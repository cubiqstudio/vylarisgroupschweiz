import { ApiError, handle, parseJson, requireAdmin } from "@/lib/api";
import { FINANCE_SETTING_FIELDS, financeSettingsInputSchema } from "@/lib/verein/settings-forms";
import { accountConflicts, getVereinSettings, saveVereinSettings } from "@/lib/verein/settings";
import { adminOk } from "../../../../_lib/http";

export const dynamic = "force-dynamic";

async function load() {
  const all = await getVereinSettings();
  return { settings: Object.fromEntries(FINANCE_SETTING_FIELDS.map((f) => [f, all[f]])) };
}

/** Finanzeinstellungen (Modul «finance_settings»: Konto, Zahlungsfrist, Mahnwesen). Lesen für Vorstandsrollen, ändern nur mit Schreibrecht. */
export const GET = handle(async (req: Request) => {
  await requireAdmin(req);
  return adminOk(await load());
});

export const PUT = handle(async (req: Request) => {
  const admin = await requireAdmin(req);
  const input = await parseJson(req, financeSettingsInputSchema);
  if (Object.keys(input.settings).length > 0) {
    // Feldübergreifende Prüfung auf dem Stand nach dem Speichern: ausländische IBAN und QR-IBAN schliessen sich aus.
    const conflicts = accountConflicts({ ...(await getVereinSettings()), ...input.settings });
    if (conflicts.qrIban) throw new ApiError(422, "VALIDATION_ERROR", conflicts.qrIban, { "settings.qrIban": conflicts.qrIban });
    await saveVereinSettings(input.settings, admin);
  }
  return adminOk(await load());
});
