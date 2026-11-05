import { handle, requireAdmin } from "@/lib/api";
import { createDocument, listDocuments } from "@/lib/verein/documents-data";
import { parseDocumentFilters } from "@/lib/verein/documents-lib";
import { documentCreateSchema } from "@/lib/verein/documents-schemas";
import { readDocumentForm } from "@/lib/verein/documents-upload";
import { listParams, pageMeta } from "@/lib/verein/pagination";
import { adminOk } from "../../_lib/http";

export const dynamic = "force-dynamic";

/** Dokumentliste (ohne Dateiinhalt) mit Suche und Filtern. */
export const GET = handle(async (req: Request) => {
  await requireAdmin(req);
  const sp = new URL(req.url).searchParams;
  const filters = parseDocumentFilters((k) => sp.get(k) ?? "");
  const { page, pageSize, skip } = listParams(sp);
  const { rows, total } = await listDocuments(filters, skip, pageSize);
  return adminOk({
    items: rows.map((d) => ({ ...d, versions: undefined, file: d.versions[0] ?? null })),
    meta: pageMeta(total, page, pageSize),
  });
});

/** Neues Dokument hochladen (multipart: Feld «file» sowie title, description, category, visibility, meetingId, changeNote). */
export const POST = handle(async (req: Request) => {
  const admin = await requireAdmin(req);
  const { fields, file } = await readDocumentForm(req);
  const input = documentCreateSchema.parse(fields);
  const doc = await createDocument(admin, input, file);
  return adminOk({ id: doc.id }, 201);
});
