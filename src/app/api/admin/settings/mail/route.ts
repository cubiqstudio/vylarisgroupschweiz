import { handle, parseJson, requireAdmin } from "@/lib/api";
import { db } from "@/lib/db";
import { mailSettingsAudit } from "@/lib/settings-audit";
import { auditActor, logAudit } from "@/lib/verein/audit";
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
  const admin = await requireAdmin(req);
  const input = await parseJson(req, mailSettingsSchema);
  const previous = await getMailSettingsPublic();
  // password: undefined = unverändert, "" = löschen
  await saveMailSettings(input);
  // Wer den Mailserver umlenkt, fängt Rechnungslinks, Einladungen und Passwort-Resets ab: jede Änderung steht im Protokoll (ohne Passwort).
  const audit = mailSettingsAudit(previous, input);
  if (audit.changed.length > 0) {
    await logAudit(db, {
      actor: auditActor(admin),
      action: "settings.mail",
      objectType: "SiteSetting",
      objectId: "mail",
      summary: `Mailserver-Einstellungen geändert (${audit.changed.join(", ")})`,
      before: audit.before,
      after: audit.after,
    });
  }
  const [mail, mailConfigured] = await Promise.all([getMailSettingsPublic(), isMailConfigured()]);
  // Ohne funktionsfähige Mail-Einstellungen darf die Registrierung nicht aktiv bleiben.
  if (!mailConfigured && (await getRegistrationEnabled())) await setRegistrationEnabled(false);
  return adminOk({ mail, mailConfigured });
});
