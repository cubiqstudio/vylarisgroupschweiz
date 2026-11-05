import { db } from "@/lib/db";
import { ApiError, handle, requireAdmin } from "@/lib/api";
import { productSchema } from "@/lib/validation-licenses";
import { adminOk, notFound, parsePatch, type IdContext } from "../../../_lib/http";

export const dynamic = "force-dynamic";

export const PATCH = handle(async (req: Request, { params }: IdContext) => {
  await requireAdmin(req);
  const { id } = await params;
  const patch = await parsePatch(req, productSchema.partial());
  const data: Record<string, unknown> = { ...patch };
  if ("nameEn" in patch) data.nameEn = patch.nameEn || null;
  if ("descriptionEn" in patch) data.descriptionEn = patch.descriptionEn || null;
  if (!(await db.product.findUnique({ where: { id }, select: { id: true } }))) notFound("Produkt");
  return adminOk(await db.product.update({ where: { id }, data }));
});

export const DELETE = handle(async (req: Request, { params }: IdContext) => {
  await requireAdmin(req);
  const { id } = await params;
  const p = await db.product.findUnique({ where: { id }, include: { _count: { select: { keys: true, webspaceRequests: true } } } });
  if (!p) notFound("Produkt");
  if (p._count.keys + p._count.webspaceRequests > 0) {
    throw new ApiError(409, "CONFLICT", "Das Produkt hat Schlüssel oder Anträge. Deaktiviere es stattdessen.");
  }
  await db.product.delete({ where: { id } });
  return adminOk({ id });
});
