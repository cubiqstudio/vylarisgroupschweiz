import "server-only";
import fs from "node:fs";
import path from "node:path";

/**
 * Markenbilder (Logos) liegen in public/images/. Es wird die erste vorhandene Datei in der Reihenfolge
 * svg → png → webp verwendet. Namen:
 *   logo-schweiz-on-light  Logo (Zeichen + Schriftzug „Vylaris Group“) für HELLE Flächen
 *   logo-schweiz-on-dark   Logo für DUNKLE Flächen (z. B. Footer)
 *   logo-mark-on-light    nur das „V“-Zeichen für helle Flächen
 *   logo-mark-on-dark     nur das „V“-Zeichen für dunkle Flächen
 */
export type BrandAsset = "logo-schweiz-on-light" | "logo-schweiz-on-dark" | "logo-mark-on-light" | "logo-mark-on-dark";

const EXTENSIONS = ["svg", "png", "webp"] as const;

export function findBrandAsset(name: BrandAsset): string | null {
  try {
    for (const ext of EXTENSIONS) {
      if (fs.existsSync(path.join(process.cwd(), "public", "images", `${name}.${ext}`))) return `/images/${name}.${ext}`;
    }
  } catch {
    /* Dateisystem nicht lesbar: Rückfall auf Standard-Logo */
  }
  return null;
}
