// Scanner-Schnittstelle v1: POST /api/scanner/v1/scan prüft einen Mitgliederausweis (nur das Token aus dem QR-Code), optional Ticket und Check-in.
import { ok } from "@/lib/api";
import { readScannerBody, scannerRoute } from "@/lib/scanner";
import { scanCard } from "@/lib/scanner-data";
import { scanBodySchema } from "@/lib/scanner-lib";

export const dynamic = "force-dynamic";

export const POST = scannerRoute({ heavy: true }, async (device, req) => ok(await scanCard(device, await readScannerBody(req, scanBodySchema))));
