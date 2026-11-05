import { ApiError, handle, parseJson, requireAdmin } from "@/lib/api";
import { db } from "@/lib/db";
import { auditActor, logAudit } from "@/lib/verein/audit";
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
  const admin = await requireAdmin(req);
  const { registrationEnabled } = await parseJson(req, siteSettingsSchema);
  const mailConfigured = await isMailConfigured();
  if (registrationEnabled && !mailConfigured) {
    throw new ApiError(409, "MAIL_NOT_CONFIGURED", "Zuerst E-Mail einrichten: Die Registrierung braucht einen Mailserver für die Bestätigungs-E-Mails.");
  }
  const was = await getRegistrationEnabled();
  await setRegistrationEnabled(registrationEnabled);
  if (was !== registrationEnabled) {
    await logAudit(db, {
      actor: auditActor(admin),
      action: "settings.registration",
      objectType: "SiteSetting",
      objectId: "site.registrationEnabled",
      summary: `Registrierung von Website-Konten ${registrationEnabled ? "eingeschaltet" : "ausgeschaltet"}`,
      before: { registrationEnabled: was },
      after: { registrationEnabled },
    });
  }
  return adminOk({ registrationEnabled, mailConfigured });
});
