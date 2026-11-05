import { handle, parseJson, requireAdmin } from "@/lib/api";
import { getVereinProfile, saveVereinProfile } from "@/lib/verein/profile";
import { GENERAL_SETTING_FIELDS, generalSettingsInputSchema } from "@/lib/verein/settings-forms";
import { getVereinSettings, saveVereinSettings } from "@/lib/verein/settings";
import { adminOk } from "../../../_lib/http";

export const dynamic = "force-dynamic";

async function load() {
  const [all, profile] = await Promise.all([getVereinSettings(), getVereinProfile()]);
  const settings = Object.fromEntries(GENERAL_SETTING_FIELDS.map((f) => [f, all[f]]));
  return { settings, profile };
}

/** Allgemeine Vereinseinstellungen (Modul «verein_settings»: lesen für Vorstandsrollen, ändern nur mit Schreibrecht). */
export const GET = handle(async (req: Request) => {
  await requireAdmin(req);
  return adminOk(await load());
});

export const PUT = handle(async (req: Request) => {
  const admin = await requireAdmin(req);
  const input = await parseJson(req, generalSettingsInputSchema);
  if (input.profile && Object.keys(input.profile).length > 0) await saveVereinProfile(input.profile, admin);
  if (input.settings && Object.keys(input.settings).length > 0) await saveVereinSettings(input.settings, admin);
  return adminOk(await load());
});
