import { handle, requireAdmin } from "@/lib/api";
import { resolveSegmentInput, segmentRecipientCount } from "@/lib/verein/newsletter-segment-data";
import { firstParam } from "@/lib/verein/pagination";
import { adminOk } from "../../../_lib/http";

export const dynamic = "force-dynamic";

/** Vorschau der Empfängerzahl für einen Empfängerkreis (?segment=ALL|MEMBERS|MEMBERSHIP_TYPE&type=<Mitgliedschaftsart>). Nur die Zahl, keine Adressen. */
export const GET = handle(async (req: Request) => {
  await requireAdmin(req);
  const params = new URL(req.url).searchParams;
  const selection = await resolveSegmentInput(firstParam(params, "segment") || "ALL", firstParam(params, "type") || null);
  return adminOk({ segment: selection.segment, segmentTypeId: selection.segmentTypeId, count: await segmentRecipientCount(selection) });
});
