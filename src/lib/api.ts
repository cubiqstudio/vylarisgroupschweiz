// Helfer für Route Handlers: einheitliche Antworten, Fehlerbehandlung, Admin-Schutz, Origin-Check.
import "server-only";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { headers } from "next/headers";
import { getCurrentAdmin, type CurrentAdmin } from "@/lib/auth";
import { translateApiFields, translateApiMessage } from "@/i18n/server-messages";
import { siteForHost, type Locale } from "@/lib/sites";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export const ok = <T>(data: T, status = 200, init?: ResponseInit) => NextResponse.json({ data }, { status, ...init });

export const fail = (status: number, code: string, message: string, fields?: Record<string, string>, headers?: HeadersInit) =>
  NextResponse.json({ error: { code, message, ...(fields ? { fields } : {}) } }, { status, headers });

function zodFields(err: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_";
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}

/** Sprache der laufenden Anfrage (Host-Header, hinter Proxy/Tunnel X-Forwarded-Host). Außerhalb einer Anfrage: Deutsch. */
async function requestLocale(): Promise<Locale> {
  try {
    const h = await headers();
    return siteForHost(h.get("x-forwarded-host") ?? h.get("host")).locale;
  } catch {
    return "de";
  }
}

/**
 * Übersetzt die Meldungen einer JSON-Fehlerantwort (error.message und error.fields) in die Sprache der Anfrage.
 * Status, Header (auch Cookies) und alle übrigen Felder bleiben erhalten; andere Antworten werden nicht angefasst.
 */
export async function localizeErrorResponse(res: Response, locale: Locale): Promise<Response> {
  if (locale === "de" || res.status < 400) return res;
  if (!(res.headers.get("content-type") ?? "").toLowerCase().includes("json")) return res;

  const raw = await res.clone().text();
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return res;
  }
  const error = (body as { error?: { message?: unknown; fields?: unknown } } | null)?.error;
  if (!error || typeof error !== "object") return res;

  if (typeof error.message === "string") error.message = translateApiMessage(error.message, locale);
  if (error.fields && typeof error.fields === "object") {
    error.fields = translateApiFields(error.fields as Record<string, string>, locale);
  }

  const headersOut = new Headers(res.headers);
  headersOut.delete("content-length");
  return new Response(JSON.stringify(body), {
    status: res.status,
    statusText: res.statusText,
    headers: headersOut,
  });
}

/**
 * Wrapper: fängt ApiError, Zod- und Prisma-Fehler und mappt sie auf JSON-Antworten.
 * Fehlerantworten (auch solche, die eine Route direkt per fail()/tooManyRequests liefert) werden für englische Domains übersetzt.
 */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    let res: Response;
    try {
      res = await fn(...args);
    } catch (e) {
      res = errorResponse(e);
    }
    // Die Sprache wird nur bei Fehlerantworten ermittelt, damit erfolgreiche Antworten nichts von den Headern abhängig machen.
    if (res.status < 400) return res;
    return localizeErrorResponse(res, await requestLocale());
  };
}

function errorResponse(e: unknown): Response {
  if (e instanceof ApiError) return fail(e.status, e.code, e.message, e.fields);
  if (e instanceof ZodError) return fail(422, "VALIDATION_ERROR", "Ungültige Eingabe.", zodFields(e));
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2002") return fail(409, "CONFLICT", "Ein Eintrag mit diesem eindeutigen Wert existiert bereits.");
    if (e.code === "P2025") return fail(404, "NOT_FOUND", "Eintrag nicht gefunden.");
  }
  console.error("[api]", e);
  return fail(500, "INTERNAL_ERROR", "Interner Serverfehler.");
}

/** CSRF-Schutz für schreibende Requests: Origin (falls gesetzt) muss zum Host passen. */
export function assertSameOrigin(req: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  const origin = req.headers.get("origin");
  if (!origin) return; // Nicht-Browser-Clients (curl); Cookies sind zusätzlich SameSite=Lax
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new ApiError(403, "FORBIDDEN", "Ungültiger Origin.");
  }
  if (originHost !== host) throw new ApiError(403, "FORBIDDEN", "Cross-Origin-Anfrage abgelehnt.");
}

/** Pflicht für alle /api/admin/*-Handler (Defense in Depth zusätzlich zur Middleware). */
export async function requireAdmin(req: Request): Promise<CurrentAdmin> {
  assertSameOrigin(req);
  const admin = await getCurrentAdmin();
  if (!admin) throw new ApiError(401, "UNAUTHORIZED", "Nicht angemeldet.");
  return admin;
}

/** Lehnt NUL-Zeichen (\u0000) in beliebiger Tiefe ab: PostgreSQL kann sie nicht speichern (sonst Fehler 500), SQLite schon. */
export function assertNoNul(value: unknown): void {
  if (typeof value === "string") {
    if (value.includes("\u0000")) throw new ApiError(400, "BAD_INPUT", "Die Eingabe enthält ungültige Zeichen.");
  } else if (Array.isArray(value)) {
    for (const v of value) assertNoNul(v);
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      assertNoNul(k);
      assertNoNul(v);
    }
  }
}

export async function parseJson<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ApiError(400, "BAD_JSON", "Ungültiger JSON-Body.");
  }
  assertNoNul(body);
  return schema.parse(body);
}
