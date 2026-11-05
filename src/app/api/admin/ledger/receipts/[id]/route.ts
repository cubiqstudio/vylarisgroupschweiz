import { handle, requireAdmin } from "@/lib/api";
import { deleteReceipt, getReceiptFile } from "@/lib/verein/ledger-data";
import { downloadHeaders } from "@/lib/verein/files";
import { idSchema } from "@/lib/verein/validation";
import { adminOk, notFound, type IdContext } from "../../../../_lib/http";

export const dynamic = "force-dynamic";

/** Beleg herunterladen (immer als Anhang, Typ nicht erraten lassen). */
export const GET = handle(async (req: Request, { params }: IdContext) => {
  await requireAdmin(req);
  const id = idSchema.parse((await params).id);
  const file = (await getReceiptFile(id)) ?? notFound("Beleg");
  return new Response(new Uint8Array(file.data), { status: 200, headers: downloadHeaders(file.fileName, file.mimeType, file.sizeBytes) });
});

/** Beleg entfernen (nur im offenen Geschäftsjahr, mit Protokolleintrag). */
export const DELETE = handle(async (req: Request, { params }: IdContext) => {
  const admin = await requireAdmin(req);
  const id = idSchema.parse((await params).id);
  await deleteReceipt(admin, id);
  return adminOk({ id });
});
