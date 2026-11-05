import { handle, requireAdmin } from "@/lib/api";
import { createMembershipType, listMembershipTypes } from "@/lib/verein/members-data";
import { membershipTypeSchema } from "@/lib/verein/members-schemas";
import { adminOk, readJson } from "../../../_lib/http";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  await requireAdmin(req);
  const types = await listMembershipTypes();
  return adminOk({ items: types.map(({ _count, ...t }) => ({ ...t, memberCount: _count.members })) });
});

export const POST = handle(async (req: Request) => {
  const admin = await requireAdmin(req);
  const input = membershipTypeSchema.parse(await readJson(req));
  const created = await createMembershipType(admin, input);
  return adminOk({ id: created.id }, 201);
});
