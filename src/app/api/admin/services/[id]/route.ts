import { db } from "@/lib/db";
import { ApiError, handle, requireAdmin } from "@/lib/api";
import { serviceUpdateSchema } from "@/lib/validation";
import { adminOk, notFound, parsePatch, type IdContext } from "../../../_lib/http";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request, ctx: IdContext) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const service = await db.saasService.findUnique({ where: { id } });
  if (!service) notFound("Service");
  return adminOk(service);
});

export const PATCH = handle(async (req: Request, ctx: IdContext) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const data = await parsePatch(req, serviceUpdateSchema);
  const current = await db.saasService.findUnique({ where: { id }, select: { url: true, comingSoon: true } });
  if (!current) notFound("Service");
  const url = data.url ?? current.url;
  const comingSoon = data.comingSoon ?? current.comingSoon;
  if (!comingSoon && !url) {
    throw new ApiError(422, "VALIDATION_ERROR", "Bitte gib die Service-URL an (oder markiere den Dienst als „Bald verfügbar“).", {
      url: "Bitte gib die Service-URL an (oder markiere den Dienst als „Bald verfügbar“).",
    });
  }
  const service = await db.saasService.update({ where: { id }, data });
  return adminOk(service);
});

// Zugehörige Incidents bleiben erhalten (serviceId wird per onDelete: SetNull geleert).
export const DELETE = handle(async (req: Request, ctx: IdContext) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  await db.saasService.delete({ where: { id } });
  return adminOk({ id });
});
