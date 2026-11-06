import { ApiError, handle } from "@/lib/api";
import { getCurrentAdmin } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { getDocumentFile } from "@/lib/verein/documents-data";
import { adminAudience, canView, downloadFileName, isStaffAudience, parseVersionParam, type DocumentAudience } from "@/lib/verein/documents-lib";
import { downloadHeaders } from "@/lib/verein/files";
import { requireActiveMember } from "@/lib/verein/guard";
import { canAccess, canSeeBoardDocuments } from "@/lib/verein/permissions";
import { idSchema } from "@/lib/verein/validation";
import type { IdContext } from "../../../_lib/http";

export const dynamic = "force-dynamic";

const notFound = () => new ApiError(404, "NOT_FOUND", "Dokument nicht gefunden.");

/**
 * Dokument herunterladen (öffentlich, für Mitglieder oder Verwaltung). Die Sichtbarkeit wird hier serverseitig erzwungen:
 *  - OEFFENTLICH: jede Person, nur die aktuelle Fassung, nicht archiviert.
 *  - MITGLIEDER: nur aktive Mitglieder (Status AKTIV) oder die Verwaltung.
 *  - VORSTAND: nur die Verwaltung mit Leserecht auf Dokumente UND dem Einzelrecht «Dokumente „Nur Vorstand“ sehen»; sonst 404.
 * Frühere Versionen und archivierte Dokumente liefert die Route nur der Verwaltung.
 */
export const GET = handle(async (req: Request, { params }: IdContext) => {
  const limit = rateLimit(`doc-download:${clientIp(req)}`, 60, 60_000);
  if (!limit.ok) throw new ApiError(429, "RATE_LIMITED", `Zu viele Abrufe. Bitte in ${limit.retryAfter} Sekunden erneut versuchen.`);
  const id = idSchema.parse((await params).id);
  const version = parseVersionParam(new URL(req.url).searchParams.get("version"));
  const file = await getDocumentFile(id, version);
  if (!file) throw notFound();

  const admin = await getCurrentAdmin();
  let audience: DocumentAudience;
  if (admin && !admin.mustChangePassword && canAccess(admin.roles, "documents", "read")) {
    audience = adminAudience(canSeeBoardDocuments(admin.roles));
  } else if (file.visibility === "OEFFENTLICH") {
    audience = "PUBLIC";
  } else if (file.visibility === "MITGLIEDER") {
    await requireActiveMember(req);
    audience = "MEMBER";
  } else {
    throw notFound();
  }
  if (!canView(audience, file.visibility, file.archivedAt)) throw notFound();
  if (!isStaffAudience(audience) && !file.isCurrent) throw notFound();

  const name = downloadFileName(file.title, file.version, file.fileName, file.isCurrent);
  return new Response(new Uint8Array(file.data), { status: 200, headers: downloadHeaders(name, file.mimeType, file.sizeBytes) });
});
