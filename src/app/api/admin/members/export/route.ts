import { handle, requireAdmin } from "@/lib/api";
import { db } from "@/lib/db";
import { auditActor, logAudit } from "@/lib/verein/audit";
import { csvResponse } from "@/lib/verein/csv";
import { listMembersForExport, parseMemberFilters } from "@/lib/verein/members-data";
import { MEMBER_CSV_HEADERS, memberCsvRows } from "@/lib/verein/members-lib";
import { formatDateCh, todayZurich } from "@/lib/verein/dates";

export const dynamic = "force-dynamic";

/** Mitgliederliste als CSV (Semikolon, Excel). Mit den Filtern der Liste; jeder Export steht im Änderungsprotokoll. */
export const GET = handle(async (req: Request) => {
  const admin = await requireAdmin(req);
  const filters = parseMemberFilters(new URL(req.url).searchParams);
  const rows = await listMembersForExport(filters);
  await logAudit(db, {
    actor: auditActor(admin),
    action: "export.members",
    objectType: "Member",
    summary: `Mitgliederliste exportiert (${rows.length} ${rows.length === 1 ? "Eintrag" : "Einträge"})`,
    after: { anzahl: rows.length, status: filters.status || "alle", suche: filters.q ? "ja" : "nein" },
  });
  const data = memberCsvRows(
    rows.map((m) => ({
      memberNumber: m.memberNumber,
      salutation: m.salutation,
      firstName: m.firstName,
      lastName: m.lastName,
      street: m.street,
      houseNumber: m.houseNumber,
      zip: m.zip,
      city: m.city,
      country: m.country,
      email: m.email,
      phone: m.phone,
      status: m.status,
      applicationAt: m.applicationAt,
      joinedAt: m.joinedAt,
      leftAt: m.leftAt,
      communicationPref: m.communicationPref,
      anonymizedAt: m.anonymizedAt,
      membershipTypeName: m.membershipType?.name ?? "",
    })),
  );
  return csvResponse(`Mitglieder-${formatDateCh(todayZurich()).replaceAll(".", "-")}`, MEMBER_CSV_HEADERS, data);
});
