import { ApiError, assertRole, handle, requireAdmin } from "@/lib/api";
import { db } from "@/lib/db";
import { auditActor, logAudit } from "@/lib/verein/audit";
import { REGISTRATION_STATUS_LABEL, labelOf } from "@/lib/verein/constants";
import { csvResponse } from "@/lib/verein/csv";
import { formatDateCh } from "@/lib/verein/dates";
import { listRegistrationsForExport } from "@/lib/verein/events-data";
import { REGISTRATION_CSV_HEADERS, registrantName, registrationCsvRows } from "@/lib/verein/events-lib";
import type { IdContext } from "../../../../../_lib/http";

export const dynamic = "force-dynamic";

/** Teilnehmerliste als CSV (Semikolon, Excel). Enthält Namen und E-Mail-Adressen: nur mit Leserecht auf «Mitglieder»; jeder Export steht im Änderungsprotokoll. */
export const GET = handle(async (req: Request, { params }: IdContext) => {
  const admin = await requireAdmin(req);
  assertRole(admin, "members", "read");
  const { id } = await params;
  const event = await db.event.findUnique({ where: { id }, select: { id: true, title: true, startsAt: true } });
  if (!event) throw new ApiError(404, "NOT_FOUND", "Anlass nicht gefunden.");
  const regs = await listRegistrationsForExport(id);
  await logAudit(db, {
    actor: auditActor(admin),
    action: "export.registrations",
    objectType: "Event",
    objectId: id,
    summary: `Teilnehmerliste von «${event.title}» exportiert (${regs.length} ${regs.length === 1 ? "Anmeldung" : "Anmeldungen"})`,
    after: { anzahl: regs.length },
  });
  const rows = registrationCsvRows(
    regs.map((r) => ({
      name: registrantName(r),
      isMember: r.member !== null,
      memberNumber: r.member?.memberNumber ?? null,
      email: r.member ? (r.member.anonymizedAt ? "" : r.member.email) : r.guestEmail,
      seats: r.seats,
      statusLabel: labelOf(REGISTRATION_STATUS_LABEL, r.status),
      attended: r.attendedAt !== null,
      createdAt: r.createdAt,
      note: r.note,
    })),
  );
  return csvResponse(`Teilnehmer-${event.title}-${formatDateCh(event.startsAt).replaceAll(".", "-")}`, REGISTRATION_CSV_HEADERS, rows);
});
