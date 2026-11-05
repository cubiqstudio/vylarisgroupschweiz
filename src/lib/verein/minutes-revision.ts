// Sicherung von Protokollfassungen im vollen Wortlaut (Revisionssicherheit). Reine Funktion, nur auf dem Server genutzt.
import { createHash } from "node:crypto";

/** Fassung im vollen Wortlaut samt SHA-256-Hash (Nachweis der Unverändertheit). */
export function minutesSnapshot(text: string): { text: string; sha256: string } {
  return { text, sha256: createHash("sha256").update(text, "utf8").digest("hex") };
}
