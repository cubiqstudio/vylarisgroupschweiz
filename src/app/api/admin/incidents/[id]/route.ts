import { db } from "@/lib/db";
import { ApiError, handle, requireAdmin } from "@/lib/api";
import { incidentUpdateSchema } from "@/lib/validation";
import { adminOk, notFound, parsePatch, type IdContext } from "../../../_lib/http";

export const dynamic = "force-dynamic";

const include = { service: { select: { id: true, name: true, slug: true } } } as const;

export const GET = handle(async (req: Request, ctx: IdContext) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const incident = await db.incident.findUnique({ where: { id }, include });
  if (!incident) notFound("Meldung");
  return adminOk(incident);
});

export const PATCH = handle(async (req: Request, ctx: IdContext) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const data = await parsePatch(req, incidentUpdateSchema);

  const existing = await db.incident.findUnique({ where: { id }, select: { resolvedAt: true } });
  if (!existing) notFound("Meldung");

  if (data.serviceId) {
    const service = await db.saasService.findUnique({ where: { id: data.serviceId }, select: { id: true } });
    if (!service) {
      throw new ApiError(422, "VALIDATION_ERROR", "Ungültige Eingabe.", { serviceId: "Dieser Service existiert nicht." });
    }
  }

  // RESOLVED setzt resolvedAt (falls leer); jeder andere Status leert es wieder.
  let resolvedAt: Date | null | undefined;
  if (data.status === "RESOLVED") resolvedAt = existing.resolvedAt ?? new Date();
  else if (data.status !== undefined) resolvedAt = null;

  const incident = await db.incident.update({
    where: { id },
    data: { ...data, ...(resolvedAt !== undefined ? { resolvedAt } : {}) },
    include,
  });
  return adminOk(incident);
});

export const DELETE = handle(async (req: Request, ctx: IdContext) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  await db.incident.delete({ where: { id } });
  return adminOk({ id });
});
