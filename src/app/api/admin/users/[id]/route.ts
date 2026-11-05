import { db } from "@/lib/db";
import { handle, requireAdmin } from "@/lib/api";
import { userAdminUpdateSchema } from "@/lib/validation";
import { decideBusiness } from "@/lib/licenses";
import { adminOk, notFound, parsePatch, type IdContext } from "../../../_lib/http";

export const dynamic = "force-dynamic";

const userSelect = {
  id: true,
  name: true,
  email: true,
  emailVerifiedAt: true,
  disabled: true,
  lastLoginAt: true,
  createdAt: true,
  isTeam: true,
  teamTitle: true,
  businessStatus: true,
  companyName: true,
} as const;

export const PATCH = handle(async (req: Request, { params }: IdContext) => {
  await requireAdmin(req);
  const { id } = await params;
  const patch = await parsePatch(req, userAdminUpdateSchema);

  const existing = await db.user.findUnique({ where: { id }, select: { id: true, emailVerifiedAt: true } });
  if (!existing) notFound("Nutzer");

  const data: { disabled?: boolean; emailVerifiedAt?: Date | null; isTeam?: boolean; teamTitle?: string | null } = {};
  if (patch.disabled !== undefined) data.disabled = patch.disabled;
  if (patch.verified !== undefined) {
    if (patch.verified) {
      if (!existing.emailVerifiedAt) data.emailVerifiedAt = new Date();
    } else {
      data.emailVerifiedAt = null;
    }
  }

  if (patch.team !== undefined) {
    data.isTeam = patch.team;
    if (!patch.team) data.teamTitle = null;
  }
  if (patch.teamTitle !== undefined && patch.team !== false) data.teamTitle = patch.teamTitle || null;

  if (patch.business) await decideBusiness(id, patch.business);

  const user = Object.keys(data).length
    ? await db.user.update({ where: { id }, data, select: userSelect })
    : await db.user.findUniqueOrThrow({ where: { id }, select: userSelect });
  return adminOk(user);
});

export const DELETE = handle(async (req: Request, { params }: IdContext) => {
  await requireAdmin(req);
  const { id } = await params;
  const existing = await db.user.findUnique({ where: { id }, select: { id: true } });
  if (!existing) notFound("Nutzer");
  await db.user.delete({ where: { id } }); // AuthTokens werden per Cascade entfernt
  return adminOk({ id });
});
