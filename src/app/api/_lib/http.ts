// Gemeinsame Helfer der Route Handlers (Ordner mit "_" ist privat und wird nicht geroutet).
import "server-only";
import type { z } from "zod";
import { ApiError, assertNoNul, ok } from "@/lib/api";

export const PUBLIC_CACHE = "public, max-age=15, stale-while-revalidate=60";
export const NO_STORE = "no-store";

export type IdContext = { params: Promise<{ id: string }> };

/** 200-Antwort für öffentliche, kurz cachebare GETs. */
export const publicOk = <T>(data: T) => ok(data, 200, { headers: { "Cache-Control": PUBLIC_CACHE } });

/** Antwort für Admin-/Auth-Endpunkte: niemals cachen. */
export const adminOk = <T>(data: T, status = 200) => ok(data, status, { headers: { "Cache-Control": NO_STORE } });

/** Liest den JSON-Body; wirft 400 bei ungültigem JSON. */
export async function readJson(req: Request): Promise<unknown> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ApiError(400, "BAD_JSON", "Ungültiger JSON-Body.");
  }
  assertNoNul(body);
  return body;
}

/**
 * Validiert einen PATCH-Body gegen ein partielles Schema und liefert NUR die tatsächlich gesendeten Felder.
 * Hintergrund: In zod 4 greifen `.default(...)`-Werte auch bei `.partial()`; ohne Filter würde ein PATCH
 * mit {status:"OUTAGE"} z. B. uptime auf 100 oder published auf false zurücksetzen.
 */
export async function parsePatch<S extends z.ZodType>(req: Request, schema: S): Promise<Partial<z.infer<S>>> {
  const raw = await readJson(req);
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new ApiError(400, "BAD_JSON", "Der Body muss ein JSON-Objekt sein.");
  }
  const parsed = schema.parse(raw) as Record<string, unknown>;
  const sent = new Set(Object.keys(raw));
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (sent.has(key) && value !== undefined) out[key] = value;
  }
  return out as Partial<z.infer<S>>;
}

export function notFound(what = "Eintrag"): never {
  throw new ApiError(404, "NOT_FOUND", `${what} nicht gefunden.`);
}
