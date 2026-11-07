// Scanner-Schnittstelle v1: Anmeldung der Geräte (Bearer-Token), Rate-Limits und der Rahmen jeder Route.
// Muster: authenticateApiClient in licenses.ts und die Prüf-API unter /api/licenses/verify. Token: scanner-token.ts (nur der Hash liegt in der Datenbank).
// Antworten: {data} bzw. {error:{code,message}} über handle/ApiError, immer mit Cache-Control: no-store. Beschreibung: docs/verein-scanner.md.
import "server-only";
import type { ScannerDevice } from "@prisma/client";
import { ApiError, assertNoNul, handle } from "@/lib/api";
import { db } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { BODY_MAX_BYTES, LAST_USED_INTERVAL_MS, SCANNER_LIMITS } from "@/lib/scanner-lib";
import { hashScannerToken, parseScannerBearer } from "@/lib/scanner-token";
import { z } from "zod";

export type { ScannerDevice };

/**
 * Prüft den Authorization-Header (Bearer) und liefert das aktive Gerät oder null (kein Token, falsches Format, unbekannt, gesperrt).
 * Führt `lastUsedAt` nach, aber höchstens alle 60 Sekunden je Gerät (kein Schreibzugriff bei jeder Abfrage).
 */
export async function authenticateScannerDevice(header: string | null | undefined, now: Date = new Date()): Promise<ScannerDevice | null> {
  const token = parseScannerBearer(header);
  if (!token) return null;
  const device = await db.scannerDevice.findUnique({ where: { tokenHash: hashScannerToken(token) } });
  if (!device || !device.active || device.revokedAt) return null;
  if (!device.lastUsedAt || now.getTime() - device.lastUsedAt.getTime() >= LAST_USED_INTERVAL_MS) {
    // Bedingt und atomar: gleichzeitige Anfragen schreiben höchstens einmal. Ein Fehler hier lässt die Anfrage nie scheitern.
    await db.scannerDevice
      .updateMany({ where: { id: device.id, OR: [{ lastUsedAt: null }, { lastUsedAt: { lt: new Date(now.getTime() - LAST_USED_INTERVAL_MS) } }] }, data: { lastUsedAt: now } })
      .catch(() => undefined);
  }
  return device;
}

/** 429 mit Wartezeit (wird als Retry-After-Header ausgegeben). */
export class ScannerRateLimited extends ApiError {
  constructor(public retryAfter: number) {
    super(429, "RATE_LIMITED", "Zu viele Anfragen.");
  }
}

type Window = { limit: number; windowMs: number };

function limit(key: string, w: Window): void {
  const r = rateLimit(key, w.limit, w.windowMs);
  if (!r.ok) throw new ScannerRateLimited(Math.max(1, r.retryAfter));
}

/**
 * Zugang prüfen: grobe Grenze je IP, Token (Fehlversuche je IP stark begrenzt, Token raten lohnt nicht), Grenze je Gerät,
 * bei /scan und /members zusätzlich die engere Grenze je Gerät.
 */
export async function requireScannerDevice(req: Request, opts: { heavy?: boolean } = {}): Promise<ScannerDevice> {
  const ip = clientIp(req);
  limit(`scanner-ip:${ip}`, SCANNER_LIMITS.ip);
  const device = await authenticateScannerDevice(req.headers.get("authorization"));
  if (!device) {
    limit(`scanner-badtoken:${ip}`, SCANNER_LIMITS.badToken);
    throw new ApiError(401, "UNAUTHORIZED", "Zugangs-Token fehlt oder ist ungültig.");
  }
  limit(`scanner-device:${device.id}`, SCANNER_LIMITS.device);
  if (opts.heavy) limit(`scanner-heavy:${device.id}`, SCANNER_LIMITS.deviceHeavy);
  return device;
}

/** Wirft 403, wenn das Gerät nicht einchecken darf. */
export function assertCanCheckIn(device: Pick<ScannerDevice, "canCheckIn">): void {
  if (!device.canCheckIn) throw new ApiError(403, "FORBIDDEN", "Dieses Gerät darf nicht einchecken.");
}

/**
 * Rahmen jeder Route der Schnittstelle: Zugang prüfen, Fehler auf JSON-Antworten abbilden (handle), Antwort ohne Zwischenspeicher
 * und mit Retry-After bei 429. Die Routen unter /api/scanner/v1 sind native Aufrufe der App: kein Cookie, kein CORS, keine Origin-Prüfung.
 */
export function scannerRoute<A extends unknown[]>(opts: { heavy?: boolean }, fn: (device: ScannerDevice, req: Request, ...rest: A) => Promise<Response>) {
  return async (req: Request, ...rest: A): Promise<Response> => {
    let retryAfter: number | null = null;
    const res = await handle(async () => {
      try {
        const device = await requireScannerDevice(req, opts);
        return await fn(device, req, ...rest);
      } catch (e) {
        if (e instanceof ScannerRateLimited) retryAfter = e.retryAfter;
        throw e;
      }
    })();
    res.headers.set("Cache-Control", "no-store");
    res.headers.set("X-Content-Type-Options", "nosniff");
    if (retryAfter !== null) res.headers.set("Retry-After", String(retryAfter));
    if (res.status === 401) res.headers.set("WWW-Authenticate", "Bearer");
    return res;
  };
}

/** JSON-Body lesen: klein (4 KB), gültiges JSON, ohne NUL-Zeichen, streng nach Schema. Fehler: 400 BAD_JSON, 422 VALIDATION_ERROR. */
export async function readScannerBody<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S>> {
  if (Number(req.headers.get("content-length") ?? "0") > BODY_MAX_BYTES) throw new ApiError(422, "VALIDATION_ERROR", "Die Anfrage ist zu gross.");
  const text = await req.text();
  if (text.length > BODY_MAX_BYTES) throw new ApiError(422, "VALIDATION_ERROR", "Die Anfrage ist zu gross.");
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new ApiError(400, "BAD_JSON", "Ungültiger JSON-Body.");
  }
  assertNoNul(body);
  return schema.parse(body);
}
