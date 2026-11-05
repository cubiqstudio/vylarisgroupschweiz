import { ApiError, handle, parseJson, requireAdmin } from "@/lib/api";
import { isMailConfigured } from "@/lib/mailer";
import { getRegistrationEnabled, setRegistrationEnabled } from "@/lib/settings";
import { siteSettingsSchema } from "@/lib/validation";
import { adminOk } from "../../../_lib/http";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  await requireAdmin(req);
  const [registrationEnabled, mailConfigured] = await Promise.all([getRegistrationEnabled(), isMailConfigured()]);
  return adminOk({ registrationEnabled, mailConfigured });
});

export const PUT = handle(async (req: Request) => {
  await requireAdmin(req);
  const { registrationEnabled } = await parseJson(req, siteSettingsSchema);
  const mailConfigured = await isMailConfigured();
  if (registrationEnabled && !mailConfigured) {
    throw new ApiError(409, "MAIL_NOT_CONFIGURED", "Zuerst E-Mail einrichten: Die Registrierung braucht einen Mailserver für die Bestätigungs-E-Mails.");
  }
  await setRegistrationEnabled(registrationEnabled);
  return adminOk({ registrationEnabled, mailConfigured });
});
