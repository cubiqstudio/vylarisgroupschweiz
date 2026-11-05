// Helfer für Route Handlers: einheitliche Antworten, Fehlerbehandlung, Admin-Schutz, Origin-Check.
import "server-only";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { getCurrentAdmin, type CurrentAdmin } from "@/lib/auth";
import { swissFields, swissText } from "@/i18n/server-messages";
import { canAccess, isAllowedWhilePasswordChangeRequired, levelForMethod, moduleForPath, type AccessLevel, type VereinModule } from "@/lib/verein/permissions";

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
  NextResponse.json({ error: { code, message: swissText(message), ...(fields ? { fields: swissFields(fields) } : {}) } }, { status, headers });

function zodFields(err: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_";
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}

/**
 * Wrapper: fängt ApiError, Zod- und Prisma-Fehler und mappt sie auf JSON-Antworten.
 * Auch Fehlerantworten, die eine Route direkt per fail() liefert, laufen durch die Schweizer Schreibweise.
 */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      return errorResponse(e);
    }
  };
}

function errorResponse(e: unknown): Response {
  if (e instanceof ApiError) return fail(e.status, e.code, e.message, e.fields);
  if (e instanceof ZodError) return fail(422, "VALIDATION_ERROR", "Ungültige Eingabe.", zodFields(e));
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2002") return fail(409, "CONFLICT", "Ein Eintrag mit diesem eindeutigen Wert existiert bereits.");
    if (e.code === "P2025") return fail(404, "NOT_FOUND", "Eintrag nicht gefunden.");
  }
  // Nur Art und Fehlercode ins Log: Meldungstexte von Prisma enthalten die übergebenen Werte (Namen, Adressen, Notizen).
  console.error("[api]", describeErrorForLog(e));
  return fail(500, "INTERNAL_ERROR", "Interner Serverfehler.");
}

/** Fehlerbeschreibung für das Log ohne Meldungstext und ohne meta-Felder (Datenminimierung, revDSG). */
export function describeErrorForLog(e: unknown): string {
  if (!(e instanceof Error)) return "unbekannt";
  const code = (e as { code?: unknown }).code;
  return typeof code === "string" && /^[A-Za-z0-9_-]{1,20}$/.test(code) ? `${e.name} ${code}` : e.name;
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

/**
 * Pflicht für alle /api/admin/*-Handler (Defense in Depth zusätzlich zur Middleware).
 * Prüft Sitzung, Origin UND die Rolle: Das Modul ergibt sich aus dem Pfad (moduleForPath), die Stufe aus der Methode
 * (GET = lesen, sonst ändern). Strengere Prüfungen innerhalb eines Moduls: requireAdminModule (src/lib/verein/guard.ts).
 */
export async function requireAdmin(req: Request): Promise<CurrentAdmin> {
  assertSameOrigin(req);
  const admin = await getCurrentAdmin();
  if (!admin) throw new ApiError(401, "UNAUTHORIZED", "Nicht angemeldet.");
  const pathname = new URL(req.url).pathname;
  assertPasswordChanged(admin, pathname);
  assertRole(admin, moduleForPath(pathname), levelForMethod(req.method));
  return admin;
}

/** Startpasswort noch nicht geändert: nur das Ändern des eigenen Passworts ist erlaubt. */
export function assertPasswordChanged(admin: CurrentAdmin, pathname: string): void {
  if (admin.mustChangePassword && !isAllowedWhilePasswordChangeRequired(pathname)) {
    throw new ApiError(403, "PASSWORD_CHANGE_REQUIRED", "Bitte ändere zuerst dein Startpasswort.");
  }
}

/** Wirft 403, wenn die Rollen des Admins das Modul nicht auf der verlangten Stufe erlauben. */
export function assertRole(admin: CurrentAdmin, module: VereinModule, level: AccessLevel = "read"): void {
  if (!canAccess(admin.roles, module, level)) {
    throw new ApiError(403, "FORBIDDEN", "Dafür fehlt dir die Berechtigung.");
  }
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
