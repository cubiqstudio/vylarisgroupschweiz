import { db } from "@/lib/db";
import { ApiError, handle, parseJson, requireAdmin } from "@/lib/api";
import { incidentCreateSchema } from "@/lib/validation";
import { adminOk } from "../../_lib/http";

export const dynamic = "force-dynamic";

const include = { service: { select: { id: true, name: true, slug: true } } } as const;

export const GET = handle(async (req: Request) => {
  await requireAdmin(req);
  const incidents = await db.incident.findMany({ include, orderBy: { startedAt: "desc" } });
  return adminOk(incidents);
});

export const POST = handle(async (req: Request) => {
  await requireAdmin(req);
  const input = await parseJson(req, incidentCreateSchema);

  if (input.serviceId) {
    const service = await db.saasService.findUnique({ where: { id: input.serviceId }, select: { id: true } });
    if (!service) {
      throw new ApiError(422, "VALIDATION_ERROR", "Ungültige Eingabe.", { serviceId: "Dieser Service existiert nicht." });
    }
  }

  const incident = await db.incident.create({
    data: { ...input, resolvedAt: input.status === "RESOLVED" ? new Date() : null },
    include,
  });
  return adminOk(incident, 201);
});
