// Edge-kompatible Session-Helfer (nur jose, kein Prisma/bcrypt) – wird auch von der Middleware genutzt.
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "vge_session";
export const SESSION_MAX_AGE = 60 * 60 * 8; // Admin: 8 Stunden
export const USER_SESSION_MAX_AGE = 60 * 60 * 24 * 14; // Website-Nutzer: 14 Tage

export type SessionKind = "admin" | "user";
export type SessionPayload = { sub: string; email: string; name: string; role: string; kind: SessionKind; sv?: number };

export const sessionMaxAge = (kind: SessionKind) => (kind === "admin" ? SESSION_MAX_AGE : USER_SESSION_MAX_AGE);

/** Geheimnis als String (auch für die Verschlüsselung der Einstellungen genutzt). */
export function authSecretString(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET fehlt oder ist kürzer als 32 Zeichen.");
    }
    return "dev-only-insecure-secret-dev-only-insecure-secret";
  }
  return s;
}

function getSecret(): Uint8Array {
  return new TextEncoder().encode(authSecretString());
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ email: payload.email, name: payload.name, role: payload.role, kind: payload.kind, sv: payload.sv ?? 0 })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setIssuer("vylaris-europe")
    .setAudience("vylaris-admin")
    .setExpirationTime(`${sessionMaxAge(payload.kind)}s`)
    .sign(getSecret());
}

export async function verifySession(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ["HS256"],
      issuer: "vylaris-europe",
      audience: "vylaris-admin",
    });
    if (!payload.sub || typeof payload.email !== "string") return null;
    return {
      sub: payload.sub,
      email: payload.email,
      name: String(payload.name ?? ""),
      role: String(payload.role ?? "ADMIN"),
      // Tokens ohne "kind" stammen aus der Zeit vor den Website-Konten und sind Admin-Sitzungen.
      kind: payload.kind === "user" ? "user" : "admin",
      // Sitzungsversion: Tokens aus der Zeit davor haben keine (= 0).
      sv: typeof payload.sv === "number" ? payload.sv : 0,
    };
  } catch {
    return null;
  }
}

export function sessionCookieOptions(kind: SessionKind = "admin") {
  const secure = process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === "true" : process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: sessionMaxAge(kind),
  };
}
