import { ApiError, handle, requireAdmin } from "@/lib/api";
import { getDocumentFile } from "@/lib/verein/documents-data";
import { downloadFileName, parseVersionParam } from "@/lib/verein/documents-lib";
import { downloadHeaders } from "@/lib/verein/files";
import { idSchema } from "@/lib/verein/validation";
import type { IdContext } from "../../../../_lib/http";

export const dynamic = "force-dynamic";

/** Datei für die Verwaltung herunterladen (aktuelle Fassung oder ?version=N); immer als Anhang. */
export const GET = handle(async (req: Request, { params }: IdContext) => {
  await requireAdmin(req);
  const id = idSchema.parse((await params).id);
  const file = await getDocumentFile(id, parseVersionParam(new URL(req.url).searchParams.get("version")));
  if (!file) throw new ApiError(404, "NOT_FOUND", "Dokument nicht gefunden.");
  const name = downloadFileName(file.title, file.version, file.fileName, file.isCurrent);
  return new Response(new Uint8Array(file.data), { status: 200, headers: downloadHeaders(name, file.mimeType, file.sizeBytes) });
});
