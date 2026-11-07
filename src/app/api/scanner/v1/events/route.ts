// Scanner-Schnittstelle v1: GET /api/scanner/v1/events liefert die Anlässe der Tür (veröffentlicht, im Zeitfenster) mit Zahlen.
import { ok } from "@/lib/api";
import { scannerRoute } from "@/lib/scanner";
import { listScannerEvents } from "@/lib/scanner-data";

export const dynamic = "force-dynamic";

export const GET = scannerRoute({}, async () => ok({ events: await listScannerEvents() }));
