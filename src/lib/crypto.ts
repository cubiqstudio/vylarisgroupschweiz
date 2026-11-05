import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { authSecretString } from "@/lib/session";

// Verschlüsselung für Geheimnisse in der Datenbank (z. B. SMTP-Passwort): AES-256-GCM,
// Schlüssel abgeleitet aus AUTH_SECRET. Wird AUTH_SECRET geändert, sind gespeicherte Geheimnisse
// nicht mehr entschlüsselbar und müssen im Admin neu eingegeben werden.
const key = () => createHash("sha256").update(`vgs-settings-v1:${authSecretString()}`).digest();

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), ct.toString("base64")].join(":");
}

/** Liefert null, wenn der Wert leer, beschädigt oder mit einem anderen Schlüssel verschlüsselt wurde. */
export function decryptSecret(blob: string | null | undefined): string | null {
  if (!blob) return null;
  const [v, iv, tag, ct] = blob.split(":");
  if (v !== "v1" || !iv || !tag || !ct) return null;
  try {
    const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
    d.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([d.update(Buffer.from(ct, "base64")), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}
