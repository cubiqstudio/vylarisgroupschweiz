import { handle } from "@/lib/api";
import { db } from "@/lib/db";
import { auditActorMember, logAudit } from "@/lib/verein/audit";
import { csvResponse, safeDownloadName } from "@/lib/verein/csv";
import { requireMember } from "@/lib/verein/guard";
import { loadDisclosure } from "@/lib/verein/members-data";
import { disclosureCsvRows } from "@/lib/verein/members-lib";

export const dynamic = "force-dynamic";

/** Auskunft über die eigenen Daten (revDSG) als JSON (Standard) oder CSV: `?format=csv`. Enthält nur Daten des angemeldeten Mitglieds. */
export const GET = handle(async (req: Request) => {
  const { member } = await requireMember(req);
  const format = new URL(req.url).searchParams.get("format") === "csv" ? "csv" : "json";
  const disclosure = await loadDisclosure(member.id);
  await logAudit(db, {
    actor: auditActorMember(member),
    action: "export.disclosure",
    objectType: "Member",
    objectId: member.id,
    summary: `Mitglied ${member.memberNumber} hat die eigenen Daten heruntergeladen (${format.toUpperCase()})`,
  });
  const base = safeDownloadName(`Meine-Daten-Mitglied-${member.memberNumber}`);
  if (format === "csv") return csvResponse(base, ["Bereich", "Eintrag", "Feld", "Wert"], disclosureCsvRows(disclosure));
  return new Response(JSON.stringify(disclosure, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${base}.json"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
