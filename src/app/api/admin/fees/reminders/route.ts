import { handle, parseJson, requireAdmin } from "@/lib/api";
import { listReminderRows, sendReminders } from "@/lib/verein/fees-ops";
import { reminderSendSchema } from "@/lib/verein/fees-schemas";
import { adminOk } from "../../../_lib/http";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  await requireAdmin(req);
  return adminOk({ items: await listReminderRows() });
});

/** Nächste Mahnstufe der gewählten Rechnungen erstellen und versenden. */
export const POST = handle(async (req: Request) => {
  const admin = await requireAdmin(req);
  const { ids, interest } = await parseJson(req, reminderSendSchema);
  const results = await sendReminders(admin, ids, interest);
  return adminOk({ results, sent: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length });
});
