import { handle, parseJson, requireAdmin } from "@/lib/api";
import { isMailConfigured } from "@/lib/mailer";
import { getMailSettingsPublic, getRegistrationEnabled, saveMailSettings, setRegistrationEnabled } from "@/lib/settings";
import { mailSettingsSchema } from "@/lib/validation";
import { adminOk } from "../../../_lib/http";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  await requireAdmin(req);
  const [mail, mailConfigured] = await Promise.all([getMailSettingsPublic(), isMailConfigured()]);
  return adminOk({ mail, mailConfigured });
});

export const PUT = handle(async (req: Request) => {
  await requireAdmin(req);
  const input = await parseJson(req, mailSettingsSchema);
  // password: undefined = unverändert, "" = löschen
  await saveMailSettings(input);
  const [mail, mailConfigured] = await Promise.all([getMailSettingsPublic(), isMailConfigured()]);
  // Ohne funktionsfähige Mail-Einstellungen darf die Registrierung nicht aktiv bleiben.
  if (!mailConfigured && (await getRegistrationEnabled())) await setRegistrationEnabled(false);
  return adminOk({ mail, mailConfigured });
});
