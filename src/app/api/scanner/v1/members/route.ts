// Scanner-Schnittstelle v1: GET /api/scanner/v1/members?q=…&eventId=… ist die manuelle Suche (Ausweis vergessen, QR unlesbar).
import { assertNoNul, ok } from "@/lib/api";
import { scannerRoute } from "@/lib/scanner";
import { searchScannerMembers } from "@/lib/scanner-data";
import { membersQuerySchema } from "@/lib/scanner-lib";

export const dynamic = "force-dynamic";

export const GET = scannerRoute({ heavy: true, search: true }, async (_device, req) => {
  const sp = new URL(req.url).searchParams;
  const input = { q: sp.get("q") ?? "", eventId: sp.get("eventId") };
  assertNoNul(input);
  const { q, eventId } = membersQuerySchema.parse(input);
  return ok({ entries: await searchScannerMembers(q, eventId) });
});
