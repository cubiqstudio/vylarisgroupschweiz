import { handle, requireAdmin } from "@/lib/api";
import { createMemberByAdmin, listMembers, parseMemberFilters } from "@/lib/verein/members-data";
import { memberCreateSchema } from "@/lib/verein/members-schemas";
import { listParams, pageMeta } from "@/lib/verein/pagination";
import { adminOk, readJson } from "../../_lib/http";

export const dynamic = "force-dynamic";

/** Mitgliederliste (Suche, Filter, Sortierung, Seiten). Lesen: Rollen mit Leserecht auf «Mitglieder». */
export const GET = handle(async (req: Request) => {
  await requireAdmin(req);
  const sp = new URL(req.url).searchParams;
  const { page, pageSize } = listParams(sp);
  const filters = parseMemberFilters(sp);
  const first = await listMembers(filters, (page - 1) * pageSize, pageSize);
  const meta = pageMeta(first.total, page, pageSize);
  const rows = meta.page === page ? first.rows : (await listMembers(filters, (meta.page - 1) * pageSize, pageSize)).rows;
  return adminOk({
    items: rows.map((m) => ({
      id: m.id,
      memberNumber: m.memberNumber,
      firstName: m.anonymizedAt ? "" : m.firstName,
      lastName: m.anonymizedAt ? "Anonymisiert" : m.lastName,
      city: m.anonymizedAt ? "" : m.city,
      status: m.status,
      membershipType: m.membershipType?.name ?? null,
      anonymized: m.anonymizedAt !== null,
    })),
    meta,
  });
});

/** Mitglied manuell erfassen. */
export const POST = handle(async (req: Request) => {
  const admin = await requireAdmin(req);
  const input = memberCreateSchema.parse(await readJson(req));
  const { member, linked } = await createMemberByAdmin(admin, input);
  return adminOk({ id: member.id, memberNumber: member.memberNumber, linked }, 201);
});
