// Scanner-Schnittstelle v1: GET /api/scanner/v1/me prüft das Token und liefert Angaben zum Gerät. Beschreibung: docs/verein-scanner.md.
import { ok } from "@/lib/api";
import { scannerRoute } from "@/lib/scanner";
import { scannerMe } from "@/lib/scanner-data";

export const dynamic = "force-dynamic";

export const GET = scannerRoute({}, async (device) => ok(await scannerMe(device)));
