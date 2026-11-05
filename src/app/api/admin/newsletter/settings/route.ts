import { ApiError, handle, parseJson, requireAdmin } from "@/lib/api";
import { isMailConfigured } from "@/lib/mailer";
import { getNewsletterEnabled, setNewsletterEnabled } from "@/lib/settings";
import { newsletterSettingsSchema } from "@/lib/validation";
import { adminOk } from "../../../_lib/http";

export const dynamic = "force-dynamic";

async function current() {
  const [enabled, mailConfigured] = await Promise.all([getNewsletterEnabled(), isMailConfigured()]);
  return { enabled, mailConfigured };
}

export const GET = handle(async (req: Request) => {
  await requireAdmin(req);
  return adminOk(await current());
});

export const PUT = handle(async (req: Request) => {
  await requireAdmin(req);
  const { enabled } = await parseJson(req, newsletterSettingsSchema);
  if (enabled && !(await isMailConfigured())) {
    throw new ApiError(409, "MAIL_NOT_CONFIGURED", "Der Newsletter kann erst eingeschaltet werden, wenn unter Einstellungen ein Mailserver eingerichtet ist.");
  }
  await setNewsletterEnabled(enabled);
  return adminOk(await current());
});
