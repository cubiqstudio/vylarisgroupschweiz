import { db } from "@/lib/db";
import { handle, requireAdmin } from "@/lib/api";
import { apiClientPatchSchema } from "@/lib/validation-licenses";
import { adminOk, notFound, parsePatch, type IdContext } from "../../../_lib/http";

export const dynamic = "force-dynamic";

export const PATCH = handle(async (req: Request, { params }: IdContext) => {
  await requireAdmin(req);
  const { id } = await params;
  const patch = await parsePatch(req, apiClientPatchSchema);
  if (!(await db.apiClient.findUnique({ where: { id }, select: { id: true } }))) notFound("Zugang");
  const row = await db.apiClient.update({ where: { id }, data: patch, select: { id: true, name: true, active: true } });
  return adminOk(row);
});

/** Widerruft den Zugang endgültig (das Token funktioniert danach nie wieder). */
export const DELETE = handle(async (req: Request, { params }: IdContext) => {
  await requireAdmin(req);
  const { id } = await params;
  if (!(await db.apiClient.findUnique({ where: { id }, select: { id: true } }))) notFound("Zugang");
  await db.apiClient.update({ where: { id }, data: { active: false, revokedAt: new Date() } });
  return adminOk({ id });
});
