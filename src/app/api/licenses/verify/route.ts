// Öffentliche Prüf-API für Programme (Autoinstaller, Webspace-Backend). Nicht für Browser gedacht (kein CORS).
//   POST /api/licenses/verify   Authorization: Bearer vgsk_…
//   { "key": "VGS-WEB-…", "product": "webspace", "instance": "meine-domain.example", "nonce": "<8–64 Zeichen>" }
// Die Antwort enthält ts, nonce und eine HMAC-SHA256-Signatur (siehe src/lib/licenses.ts, signVerifyResponse).
import { NextResponse } from "next/server";
import { authenticateApiClient, normalizeKey, verifyLicense } from "@/lib/licenses";
import { clientIp, rateLimit, resetRateLimit } from "@/lib/rate-limit";
import { verifySchema } from "@/lib/validation-licenses";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const reply = (status: number, body: unknown, extra?: Record<string, string>) =>
  NextResponse.json(body, { status, headers: { ...HEADERS, ...extra } });
const err = (status: number, code: string, message: string, extra?: Record<string, string>) =>
  reply(status, { error: { code, message } }, extra);

export async function POST(req: Request) {
  const ip = clientIp(req);

  // 1. Grobe Begrenzung je IP (bevor irgendetwas geprüft wird)
  const ipLimit = rateLimit(`verify-ip:${ip}`, 120, 60 * 1000);
  if (!ipLimit.ok) return err(429, "RATE_LIMITED", "Zu viele Anfragen.", { "Retry-After": String(ipLimit.retryAfter) });

  // 2. Zugang prüfen. Fehlversuche je IP stark begrenzen (Token raten lohnt nicht).
  const client = await authenticateApiClient(req.headers.get("authorization"));
  if (!client) {
    const bad = rateLimit(`verify-badauth:${ip}`, 20, 10 * 60 * 1000);
    if (!bad.ok) return err(429, "RATE_LIMITED", "Zu viele Anfragen.", { "Retry-After": String(bad.retryAfter) });
    return err(401, "UNAUTHORIZED", "API-Token fehlt oder ist ungültig.", { "WWW-Authenticate": "Bearer" });
  }
  const perClient = rateLimit(`verify-client:${client.id}`, 600, 60 * 1000);
  if (!perClient.ok) return err(429, "RATE_LIMITED", "Zu viele Anfragen.", { "Retry-After": String(perClient.retryAfter) });

  // 3. Body: klein, JSON, streng validiert
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > 2048) return err(413, "TOO_LARGE", "Anfrage ist zu gross.");
  let raw: unknown;
  try {
    const text = await req.text();
    if (text.length > 2048) return err(413, "TOO_LARGE", "Anfrage ist zu gross.");
    raw = JSON.parse(text);
  } catch {
    return err(400, "BAD_JSON", "Ungültiger JSON-Inhalt.");
  }
  const parsed = verifySchema.safeParse(raw);
  if (!parsed.success) return err(422, "VALIDATION_ERROR", "Ungültige Anfrage.");
  const { key, product, instance, nonce } = parsed.data;

  // 4. Schlüsselformat: ein Schlüssel im falschen Format ist ohne DB-Zugriff ungültig; Fehlversuche je Zugang zählen
  const normalized = normalizeKey(key);
  const invalidKeyLimit = rateLimit(`verify-invalid:${client.id}:${ip}`, 60, 10 * 60 * 1000);
  if (!invalidKeyLimit.ok) return err(429, "RATE_LIMITED", "Zu viele Anfragen.", { "Retry-After": String(invalidKeyLimit.retryAfter) });

  await db.apiClient.update({ where: { id: client.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);

  const result = normalized
    ? await verifyLicense(client, { key: normalized, product, instance: instance ?? null, nonce })
    : await verifyLicense(client, { key: "VGS-XXX-AAAAA-AAAAA-AAAAA-AAAAA", product, instance: instance ?? null, nonce });
  if (normalized && result.valid) {
    // Gültige Prüfungen belasten das Fehlversuch-Limit nicht.
    resetRateLimit(`verify-invalid:${client.id}:${ip}`);
  }
  return reply(200, { data: result });
}
