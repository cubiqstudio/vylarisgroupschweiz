import { handle, requireAdmin } from "@/lib/api";
import { getLegal } from "@/lib/legal";
import { isMailConfigured } from "@/lib/mailer";
import { getLegalSettings, getMailSettingsPublic, getRegistrationEnabled } from "@/lib/settings";
import { adminOk } from "../../_lib/http";

export const dynamic = "force-dynamic";

/** Alle Einstellungen auf einmal – das SMTP-Passwort wird nie ausgegeben (nur `hasPassword`). */
export const GET = handle(async (req: Request) => {
  await requireAdmin(req);
  const [legal, legalState, mail, registrationEnabled, mailConfigured] = await Promise.all([
    getLegalSettings(),
    getLegal(),
    getMailSettingsPublic(),
    getRegistrationEnabled(),
    isMailConfigured(),
  ]);
  return adminOk({ legal, legalComplete: legalState.isComplete, mail, registrationEnabled, mailConfigured });
});
