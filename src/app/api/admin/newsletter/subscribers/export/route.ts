import { db } from "@/lib/db";
import { handle, requireAdmin } from "@/lib/api";
import { auditActor, logAudit } from "@/lib/verein/audit";
import { csvCell } from "@/lib/newsletter";
import { SUBSCRIBER_STATUS_LABEL, SUBSCRIBER_STATUSES } from "@/components/admin/newsletter/types";

export const dynamic = "force-dynamic";

/** CSV-Export (E-Mail, Name, Status, Bestätigt am). Semikolon + BOM, damit Excel (de) die Datei direkt öffnet. */
export const GET = handle(async (req: Request) => {
  const admin = await requireAdmin(req);
  const status = new URL(req.url).searchParams.get("status") ?? "";
  const where = (SUBSCRIBER_STATUSES as readonly string[]).includes(status) ? { status } : {};
  const rows = await db.newsletterSubscriber.findMany({
    where,
    orderBy: { createdAt: "asc" },
    select: { email: true, name: true, status: true, confirmedAt: true },
  });

  await logAudit(db, {
    actor: auditActor(admin),
    action: "export.newsletter",
    objectType: "NewsletterSubscriber",
    summary: `Newsletter-Abonnenten exportiert (${rows.length} ${rows.length === 1 ? "Eintrag" : "Einträge"})`,
    after: { anzahl: rows.length, status: status || "alle" },
  });

  const lines = [["E-Mail", "Name", "Status", "Bestätigt am"].map(csvCell).join(";")];
  for (const r of rows) {
    lines.push(
      [r.email, r.name, SUBSCRIBER_STATUS_LABEL[r.status] ?? r.status, r.confirmedAt ? r.confirmedAt.toISOString() : ""].map(csvCell).join(";"),
    );
  }
  const day = new Date().toISOString().slice(0, 10);
  return new Response(`﻿${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="newsletter-abonnenten-${day}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
