import { db } from "@/lib/db";
import { handle, requireAdmin } from "@/lib/api";
import { listAuditForExport, parseAuditFilters } from "@/lib/verein/audit-data";
import { auditActionLabel, auditObjectLabel } from "@/lib/verein/audit-view";
import { auditActor, logAudit } from "@/lib/verein/audit";
import { csvResponse } from "@/lib/verein/csv";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = { ADMIN: "Verwaltung", MEMBER: "Mitglied", SYSTEM: "System" };

/** CSV-Export des Änderungsprotokolls (aktuelle Filter). Nur Klartext, keine Vorher/Nachher-Werte. Der Export selbst steht im Protokoll. */
export const GET = handle(async (req: Request) => {
  const admin = await requireAdmin(req);
  const filters = parseAuditFilters(new URL(req.url).searchParams);
  const rows = await listAuditForExport(filters);
  await logAudit(db, {
    actor: auditActor(admin),
    action: "export.audit",
    objectType: "AuditLog",
    summary: `Änderungsprotokoll exportiert (${rows.length} Einträge)`,
  });
  return csvResponse(
    "aenderungsprotokoll.csv",
    ["Zeitpunkt", "Wer", "Art", "Aktion", "Objekt", "Objekt-ID", "Zusammenfassung"],
    rows.map((r) => [r.createdAt, r.actorName, TYPE_LABEL[r.actorType] ?? r.actorType, auditActionLabel(r.action), auditObjectLabel(r.objectType), r.objectId ?? "", r.summary]),
  );
});
