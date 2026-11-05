import { assertRole, handle, requireAdmin } from "@/lib/api";
import { adminAddRegistration } from "@/lib/verein/events-ops";
import { adminRegistrationSchema } from "@/lib/verein/events-schemas";
import { adminOk, readJson, type IdContext } from "../../../../_lib/http";

export const dynamic = "force-dynamic";

/** Person von Hand anmelden (Mitglied oder Gast). Ohne freien Platz kommt sie auf die Warteliste, ausser `force` ist gesetzt. */
export const POST = handle(async (req: Request, { params }: IdContext) => {
  const admin = await requireAdmin(req);
  assertRole(admin, "members", "read");
  const { id } = await params;
  const input = adminRegistrationSchema.parse(await readJson(req));
  const result = await adminAddRegistration(admin, id, input);
  return adminOk(result, result.created ? 201 : 200);
});
