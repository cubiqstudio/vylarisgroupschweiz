import "server-only";
import { findBrandAsset } from "@/lib/brand";

/** Pfad des V-Zeichens passend zum Untergrund: "light" = helle Fläche, "dark" = dunkle Fläche (z. B. Footer). */
export function resolveMarkSrc(surface: "light" | "dark"): string | null {
  return findBrandAsset(surface === "dark" ? "logo-mark-on-dark" : "logo-mark-on-light");
}
