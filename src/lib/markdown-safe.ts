// Sicherheitsregeln für Markdown-Inhalte (Beschreibungen, Protokolle, Blog). Reine Funktion.

/**
 * Darf ein Bild aus Markdown dargestellt werden? Nur Bilder derselben Website (Pfad mit einem «/» am Anfang, kein «//»).
 * Bilder von fremden Servern würden die IP-Adresse der Besuchenden an Dritte weitergeben (Datenschutz, revDSG) und dienen als Zählpixel.
 */
export function isOwnImageSrc(src: unknown): src is string {
  if (typeof src !== "string") return false;
  if (!src.startsWith("/") || src.startsWith("//") || src.startsWith("/\\")) return false;
  return !/[\u0000-\u001f\\]/.test(src);
}
