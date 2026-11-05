import { ApiError, handle, requireAdmin } from "@/lib/api";
import { getMemberDetail, updateMember } from "@/lib/verein/members-data";
import { memberPatchSchema } from "@/lib/verein/members-schemas";
import { hasBoardRole } from "@/lib/verein/permissions";
import { adminOk, parsePatch, type IdContext } from "../../../_lib/http";

export const dynamic = "force-dynamic";

/** Ein Mitglied lesen. Vorstandsnotizen nur für Rollen mit Vorstandsrecht. */
export const GET = handle(async (req: Request, { params }: IdContext) => {
  const admin = await requireAdmin(req);
  const { id } = await params;
  const m = await getMemberDetail(id);
  if (!m) throw new ApiError(404, "NOT_FOUND", "Mitglied nicht gefunden.");
  const { adminAccount, user, boardNotes, ...rest } = m;
  return adminOk({
    ...rest,
    boardNotes: hasBoardRole(admin.roles) ? boardNotes : null,
    user: user ? { id: user.id, email: user.email, verified: user.emailVerifiedAt !== null, disabled: user.disabled } : null,
    adminAccount: adminAccount ? { id: adminAccount.id, name: adminAccount.name } : null,
  });
});

/** Stammdaten ändern (nur gesendete Felder). */
export const PATCH = handle(async (req: Request, { params }: IdContext) => {
  const admin = await requireAdmin(req);
  const { id } = await params;
  const patch = await parsePatch(req, memberPatchSchema);
  const { member, linked } = await updateMember(admin, id, patch);
  return adminOk({ id: member.id, memberNumber: member.memberNumber, linked });
});
