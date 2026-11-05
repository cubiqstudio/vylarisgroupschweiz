import { handle, parseJson, requireAdmin } from "@/lib/api";
import { isMailConfigured } from "@/lib/mailer";
import { getTicketMailSettings, saveTicketMailSettings } from "@/lib/settings";
import { ticketMailSettingsSchema } from "@/lib/validation";
import { adminOk } from "../../../_lib/http";

export const dynamic = "force-dynamic";

async function current() {
  const [settings, mailConfigured] = await Promise.all([getTicketMailSettings(), isMailConfigured()]);
  return { ...settings, mailConfigured };
}

export const GET = handle(async (req: Request) => {
  await requireAdmin(req);
  return adminOk(await current());
});

export const PUT = handle(async (req: Request) => {
  await requireAdmin(req);
  const input = await parseJson(req, ticketMailSettingsSchema);
  await saveTicketMailSettings(input);
  return adminOk(await current());
});
