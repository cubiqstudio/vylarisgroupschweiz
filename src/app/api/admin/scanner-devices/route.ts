import { handle, parseJson, requireAdmin } from "@/lib/api";
import { createScannerDevice, listScannerDevices, scannerDeviceCreateSchema } from "@/lib/verein/scanner-devices";
import { adminOk } from "../../_lib/http";

export const dynamic = "force-dynamic";

/** Scanner-Geräte (Modul «system»): Liste. Nie mit Token oder Hash, nur mit Hinweis. */
export const GET = handle(async (req: Request) => {
  await requireAdmin(req);
  const rows = await listScannerDevices();
  return adminOk(
    rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), lastUsedAt: r.lastUsedAt?.toISOString() ?? null, revokedAt: r.revokedAt?.toISOString() ?? null })),
  );
});

/** Legt ein Gerät an. Token und Kopplungs-Link stehen NUR in dieser Antwort und sind später nicht mehr abrufbar. */
export const POST = handle(async (req: Request) => {
  const admin = await requireAdmin(req);
  const input = await parseJson(req, scannerDeviceCreateSchema);
  const { device, token, pairingUrl, qr } = await createScannerDevice(admin, input);
  return adminOk(
    { id: device.id, label: device.label, canCheckIn: device.canCheckIn, tokenHint: device.tokenHint, token, pairingUrl, qr },
    201,
  );
});
