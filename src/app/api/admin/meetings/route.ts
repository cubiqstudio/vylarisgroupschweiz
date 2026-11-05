import { handle, requireAdmin } from "@/lib/api";
import { listMeetings, createMeeting, parseMeetingFilters } from "@/lib/verein/meetings-data";
import { meetingCreateSchema } from "@/lib/verein/meetings-schemas";
import { listParams, pageMeta } from "@/lib/verein/pagination";
import { adminOk, readJson } from "../../_lib/http";

export const dynamic = "force-dynamic";

/** Sitzungen (Suche, Filter, Seiten). Lesen: Rollen mit Leserecht auf «Versammlungen». */
export const GET = handle(async (req: Request) => {
  await requireAdmin(req);
  const sp = new URL(req.url).searchParams;
  const { page, pageSize } = listParams(sp);
  const filters = parseMeetingFilters(sp);
  const first = await listMeetings(filters, (page - 1) * pageSize, pageSize);
  const meta = pageMeta(first.total, page, pageSize);
  const rows = meta.page === page ? first.rows : (await listMeetings(filters, (meta.page - 1) * pageSize, pageSize)).rows;
  return adminOk({
    items: rows.map((m) => ({
      id: m.id,
      kind: m.kind,
      title: m.title,
      startsAt: m.startsAt.toISOString(),
      status: m.status,
      minutesApproved: m.minutesApprovedAt !== null,
    })),
    meta,
  });
});

/** Sitzung anlegen. */
export const POST = handle(async (req: Request) => {
  const admin = await requireAdmin(req);
  const input = meetingCreateSchema.parse(await readJson(req));
  const m = await createMeeting(admin, input);
  return adminOk({ id: m.id }, 201);
});
