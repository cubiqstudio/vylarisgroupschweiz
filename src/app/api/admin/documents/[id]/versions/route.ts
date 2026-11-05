import { handle, requireAdmin } from "@/lib/api";
import { addDocumentVersion } from "@/lib/verein/documents-data";
import { documentVersionSchema } from "@/lib/verein/documents-schemas";
import { readDocumentForm } from "@/lib/verein/documents-upload";
import { idSchema } from "@/lib/verein/validation";
import { adminOk, type IdContext } from "../../../../_lib/http";

export const dynamic = "force-dynamic";

/** Neue Version hochladen (multipart: «file», optional changeNote). Frühere Versionen bleiben abrufbar. */
export const POST = handle(async (req: Request, { params }: IdContext) => {
  const admin = await requireAdmin(req);
  const id = idSchema.parse((await params).id);
  const { fields, file } = await readDocumentForm(req);
  const input = documentVersionSchema.parse(fields);
  return adminOk(await addDocumentVersion(admin, id, file, input.changeNote), 201);
});
