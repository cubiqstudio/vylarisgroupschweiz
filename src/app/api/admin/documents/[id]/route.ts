import { ApiError, handle, requireAdmin } from "@/lib/api";
import { deleteDocument, getDocumentDetail, updateDocument } from "@/lib/verein/documents-data";
import { documentPatchSchema } from "@/lib/verein/documents-schemas";
import { idSchema } from "@/lib/verein/validation";
import { adminOk, parsePatch, type IdContext } from "../../../_lib/http";

export const dynamic = "force-dynamic";

/** Ein Dokument mit allen Versionen (Metadaten). */
export const GET = handle(async (req: Request, { params }: IdContext) => {
  await requireAdmin(req);
  const doc = await getDocumentDetail(idSchema.parse((await params).id));
  if (!doc) throw new ApiError(404, "NOT_FOUND", "Dokument nicht gefunden.");
  return adminOk(doc);
});

/** Angaben ändern (nur gesendete Felder): Titel, Beschreibung, Kategorie, Sichtbarkeit, Sitzung, archived. */
export const PATCH = handle(async (req: Request, { params }: IdContext) => {
  const admin = await requireAdmin(req);
  const id = idSchema.parse((await params).id);
  const patch = await parsePatch(req, documentPatchSchema);
  return adminOk(await updateDocument(admin, id, patch));
});

/** Dokument mit allen Versionen endgültig löschen (steht im Änderungsprotokoll). */
export const DELETE = handle(async (req: Request, { params }: IdContext) => {
  const admin = await requireAdmin(req);
  return adminOk(await deleteDocument(admin, idSchema.parse((await params).id)));
});
