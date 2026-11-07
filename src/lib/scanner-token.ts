// Zugangs-Token der Scanner-Geräte («vgst_» + 32 Zufallsbytes, base64url). Gespeichert wird nur der SHA-256-Hash.
// Reine Funktionen ohne Datenbankzugriff (testbar). Die Anmeldung der Geräte steht in src/lib/scanner.ts.
import { createHash, randomBytes } from "node:crypto";

export const SCANNER_TOKEN_PREFIX = "vgst_";
/** «vgst_» + 43 Zeichen base64url (32 Bytes). */
export const SCANNER_TOKEN_PATTERN = /^vgst_[A-Za-z0-9_-]{43}$/;

export const hashScannerToken = (token: string): string => createHash("sha256").update(token).digest("hex");

/** Neues Token: der Klartext wird genau einmal angezeigt, in der Datenbank landen nur Hash und Hinweis (erste 8 Zeichen). */
export function generateScannerToken(): { token: string; tokenHash: string; tokenHint: string } {
  const token = `${SCANNER_TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
  return { token, tokenHash: hashScannerToken(token), tokenHint: token.slice(0, 8) };
}

/** Bearer-Token aus dem Authorization-Header, sonst null (falsches Format wird gar nicht erst nachgeschlagen). */
export function parseScannerBearer(header: string | null | undefined): string | null {
  const m = /^Bearer (\S+)$/.exec(header ?? "");
  return m && SCANNER_TOKEN_PATTERN.test(m[1]!) ? m[1]! : null;
}
