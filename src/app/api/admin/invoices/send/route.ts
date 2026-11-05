import { handle, parseJson, requireAdmin } from "@/lib/api";
import { ApiError } from "@/lib/api";
import { sendInvoice } from "@/lib/verein/fees-data";
import { invoiceBulkSendSchema } from "@/lib/verein/fees-schemas";
import { adminOk } from "../../../_lib/http";

export const dynamic = "force-dynamic";

/** Mehrere Entwürfe nacheinander versenden. Jede Rechnung einzeln: ein Fehler stoppt die anderen nicht. */
export const POST = handle(async (req: Request) => {
  const admin = await requireAdmin(req);
  const { ids, channel } = await parseJson(req, invoiceBulkSendSchema);
  const results: Array<{ id: string; ok: boolean; number?: string; message: string }> = [];
  for (const id of ids) {
    try {
      const r = await sendInvoice(admin, id, channel);
      results.push({ id, ok: true, number: r.number, message: channel === "MAIL" ? "Per E-Mail versendet." : "Als per Post zugestellt markiert." });
    } catch (e) {
      results.push({ id, ok: false, message: e instanceof ApiError ? e.message : "Fehler beim Versand." });
    }
  }
  return adminOk({ results, sent: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length });
});
