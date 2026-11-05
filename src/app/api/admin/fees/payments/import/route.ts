import { handle, parseJson, requireAdmin } from "@/lib/api";
import { commitPaymentImport, previewPaymentImport } from "@/lib/verein/fees-ops";
import { paymentImportSchema } from "@/lib/verein/fees-schemas";
import { adminOk } from "../../../../_lib/http";

export const dynamic = "force-dynamic";

/**
 * Zahlungsabgleich per CSV (Spalten Referenz, Betrag, optional Datum, Text).
 * commit=false: Zeilen den Rechnungen zuordnen (Vorschau). commit=true: gewählte Zeilen als Zahlungen erfassen.
 */
export const POST = handle(async (req: Request) => {
  const admin = await requireAdmin(req);
  const input = await parseJson(req, paymentImportSchema);
  if (!input.commit) {
    const { error, lines } = await previewPaymentImport(input.csv);
    return adminOk({
      error,
      lines: lines.map(({ row, result }) => ({
        line: row.line,
        reference: row.reference,
        amountRappen: row.amountRappen,
        date: row.date,
        text: row.text,
        kind: result.kind,
        message: result.kind === "MATCH" ? result.note : result.message,
        invoice: result.kind === "MATCH" ? { id: result.invoice.id, number: result.invoice.number, memberName: result.invoice.memberName } : null,
      })),
    });
  }
  const results = await commitPaymentImport(admin, input.csv, input.lines, { assetAccountId: input.assetAccountId ?? null, incomeAccountId: input.incomeAccountId ?? null, method: input.method });
  return adminOk({ results, booked: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length });
});
