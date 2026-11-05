import "server-only";
import { createHash, randomBytes } from "node:crypto";

/** Zufälliges URL-sicheres Token (für Bestätigungs- und Abmelde-Links). */
export const newToken = () => randomBytes(32).toString("base64url");
export const hashToken = (raw: string) => createHash("sha256").update(raw).digest("hex");

/** Alle Links führen auf die Domain (Basis-URL) der Seite, bei der sich der Abonnent angemeldet hat. */
const url = (baseUrl: string, path: string, token: string) => `${baseUrl.replace(/\/+$/, "")}${path}?token=${encodeURIComponent(token)}`;
/** Seite mit Bestätigungs-Button (Double-Opt-In) */
export const confirmUrl = (confirmToken: string, baseUrl: string) => url(baseUrl, "/newsletter/confirm", confirmToken);
/** Seite mit Abmelde-Button (im Mailtext verlinkt) */
export const unsubscribeUrl = (unsubscribeToken: string, baseUrl: string) => url(baseUrl, "/newsletter/unsubscribe", unsubscribeToken);
/** API-Endpunkt für One-Click-Abmeldung (List-Unsubscribe-Post, RFC 8058) */
export const unsubscribeApiUrl = (unsubscribeToken: string, baseUrl: string) => url(baseUrl, "/api/newsletter/unsubscribe", unsubscribeToken);
