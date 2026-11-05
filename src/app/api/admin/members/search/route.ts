import { handle, requireAdmin } from "@/lib/api";
import { searchActiveMembers } from "@/lib/verein/members-data";
import { listParams } from "@/lib/verein/pagination";
import { adminOk } from "../../../_lib/http";

export const dynamic = "force-dynamic";

/** Suche nach aktiven Mitgliedern für Auswahlfelder (z. B. Amt vergeben). */
export const GET = handle(async (req: Request) => {
  await requireAdmin(req);
  const { q } = listParams(new URL(req.url).searchParams);
  const rows = q.length >= 1 ? await searchActiveMembers(q, 10) : [];
  return adminOk({ items: rows.map((m) => ({ id: m.id, memberNumber: m.memberNumber, name: `${m.firstName} ${m.lastName}`.trim(), city: m.city })) });
});
