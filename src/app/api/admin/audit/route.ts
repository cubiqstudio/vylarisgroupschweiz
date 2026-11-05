import { handle, requireAdmin } from "@/lib/api";
import { auditActionLabel, auditChanges } from "@/lib/verein/audit-view";
import { listAuditLog, parseAuditFilters } from "@/lib/verein/audit-data";
import { listParams, pageMeta } from "@/lib/verein/pagination";
import { adminOk } from "../../_lib/http";

export const dynamic = "force-dynamic";

/** Änderungsprotokoll als JSON (seitenweise, mit Filtern). Nur Lesen; Modul «audit». */
export const GET = handle(async (req: Request) => {
  await requireAdmin(req);
  const params = new URL(req.url).searchParams;
  const filters = parseAuditFilters(params);
  const { page, pageSize } = listParams(params);
  const first = await listAuditLog(filters, (page - 1) * pageSize, pageSize);
  const meta = pageMeta(first.total, page, pageSize);
  const rows = meta.page === page ? first.rows : (await listAuditLog(filters, (meta.page - 1) * pageSize, pageSize)).rows;
  return adminOk({
    meta,
    items: rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      actorType: r.actorType,
      actorName: r.actorName,
      action: r.action,
      actionLabel: auditActionLabel(r.action),
      objectType: r.objectType,
      objectId: r.objectId,
      summary: r.summary,
      changes: auditChanges(r.before, r.after),
    })),
  });
});
