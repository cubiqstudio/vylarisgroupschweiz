import { ApiError, assertRole, handle, requireAdmin } from "@/lib/api";
import { getEventDetail } from "@/lib/verein/events-data";
import { deleteEvent, updateEvent } from "@/lib/verein/events-ops";
import { eventPatchSchema } from "@/lib/verein/events-schemas";
import { adminOk, parsePatch, type IdContext } from "../../../_lib/http";

export const dynamic = "force-dynamic";

/** Ein Anlass mit allen Anmeldungen (enthält Namen und E-Mail-Adressen: braucht auch das Leserecht auf «Mitglieder»). */
export const GET = handle(async (req: Request, { params }: IdContext) => {
  const admin = await requireAdmin(req);
  assertRole(admin, "members", "read");
  const { id } = await params;
  const event = await getEventDetail(id);
  if (!event) throw new ApiError(404, "NOT_FOUND", "Anlass nicht gefunden.");
  return adminOk(event);
});

/** Angaben ändern (nur gesendete Felder). Wartende rücken nach, wenn die Kapazität steigt. */
export const PATCH = handle(async (req: Request, { params }: IdContext) => {
  const admin = await requireAdmin(req);
  const { id } = await params;
  const patch = await parsePatch(req, eventPatchSchema);
  const result = await updateEvent(admin, id, patch);
  return adminOk(result);
});

/** Anlass samt Anmeldungen löschen. */
export const DELETE = handle(async (req: Request, { params }: IdContext) => {
  const admin = await requireAdmin(req);
  const { id } = await params;
  await deleteEvent(admin, id);
  return adminOk({ id });
});
