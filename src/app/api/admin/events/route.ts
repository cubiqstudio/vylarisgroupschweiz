import { handle, requireAdmin } from "@/lib/api";
import { listEventsAdmin, parseEventFilters } from "@/lib/verein/events-data";
import { createEvent } from "@/lib/verein/events-ops";
import { eventCreateSchema } from "@/lib/verein/events-schemas";
import { listParams, pageMeta } from "@/lib/verein/pagination";
import { adminOk, readJson } from "../../_lib/http";

export const dynamic = "force-dynamic";

/** Anlässe auflisten (Ansicht, Suche, Seiten). */
export const GET = handle(async (req: Request) => {
  await requireAdmin(req);
  const sp = new URL(req.url).searchParams;
  const { page, pageSize } = listParams(sp);
  const filters = parseEventFilters(sp);
  const first = await listEventsAdmin(filters, (page - 1) * pageSize, pageSize);
  const meta = pageMeta(first.total, page, pageSize);
  const rows = meta.page === page ? first.rows : (await listEventsAdmin(filters, (meta.page - 1) * pageSize, pageSize)).rows;
  return adminOk({ items: rows, meta });
});

/** Anlass anlegen (Entwurf oder gleich veröffentlicht). */
export const POST = handle(async (req: Request) => {
  const admin = await requireAdmin(req);
  const input = eventCreateSchema.parse(await readJson(req));
  const event = await createEvent(admin, input);
  return adminOk({ id: event.id }, 201);
});
