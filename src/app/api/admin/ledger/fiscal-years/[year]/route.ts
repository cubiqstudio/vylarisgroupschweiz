import { handle } from "@/lib/api";
import { applyFiscalAction } from "@/lib/verein/ledger-data";
import { fiscalActionSchema, yearSchema } from "@/lib/verein/ledger-schemas";
import { requireAdminModule } from "@/lib/verein/guard";
import { adminOk, readJson } from "../../../../_lib/http";

export const dynamic = "force-dynamic";

type YearContext = { params: Promise<{ year: string }> };

/**
 * Geschäftsjahr abschliessen, wieder öffnen oder die Genehmigung vermerken. Lesezugriff genügt für den Wächter hier; das Recht
 * «Geschäftsjahr abschliessen» (fiscalYearClose, zusammen mit Leserecht auf die Kasse) prüft applyFiscalAction. Jede Aktion steht im Änderungsprotokoll.
 */
export const POST = handle(async (req: Request, { params }: YearContext) => {
  const admin = await requireAdminModule(req, "ledger", "read");
  const year = yearSchema.parse((await params).year);
  const input = fiscalActionSchema.parse(await readJson(req));
  await applyFiscalAction(admin, year, input);
  return adminOk({ year, action: input.action });
});
