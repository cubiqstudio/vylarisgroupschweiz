// Scanner-Schnittstelle v1: PATCH /api/scanner/v1/events/{id}/attendance setzt die Anwesenheit von Hand oder nimmt sie zurück (verlangt «darf einchecken»).
import { ok } from "@/lib/api";
import { assertCanCheckIn, readScannerBody, scannerRoute } from "@/lib/scanner";
import { setScannerAttendance } from "@/lib/scanner-data";
import { attendanceBodySchema } from "@/lib/scanner-lib";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = scannerRoute({}, async (device, req, { params }: Ctx) => {
  assertCanCheckIn(device);
  const { id } = await params;
  const { memberId, attended } = await readScannerBody(req, attendanceBodySchema);
  return ok(await setScannerAttendance(device, id, memberId, attended));
});
