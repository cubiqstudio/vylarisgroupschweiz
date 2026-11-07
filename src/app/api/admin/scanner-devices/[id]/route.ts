import { handle, requireAdmin } from "@/lib/api";
import { deleteScannerDevice, scannerDevicePatchSchema, updateScannerDevice } from "@/lib/verein/scanner-devices";
import { adminOk, readJson, type IdContext } from "../../../_lib/http";

export const dynamic = "force-dynamic";

/** Sperrt oder aktiviert ein Gerät (`active`) und ändert «darf einchecken» (`canCheckIn`). */
export const PATCH = handle(async (req: Request, { params }: IdContext) => {
  const admin = await requireAdmin(req);
  const { id } = await params;
  const patch = scannerDevicePatchSchema.parse(await readJson(req));
  const row = await updateScannerDevice(admin, id, patch);
  return adminOk({ id: row.id, label: row.label, canCheckIn: row.canCheckIn, active: row.active, revokedAt: row.revokedAt?.toISOString() ?? null });
});

/** Löscht das Gerät endgültig (das Token funktioniert danach nie wieder). */
export const DELETE = handle(async (req: Request, { params }: IdContext) => {
  const admin = await requireAdmin(req);
  const { id } = await params;
  await deleteScannerDevice(admin, id);
  return adminOk({ id });
});
