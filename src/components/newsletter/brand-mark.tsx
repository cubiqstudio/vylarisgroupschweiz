/* eslint-disable @next/next/no-img-element -- kleines statisches Logo, keine Bildoptimierung nötig */
import { cn } from "@/lib/utils";

/**
 * Das V-Zeichen der Marke (rein dekorativ). `src` kommt vom Server (resolveMarkSrc) und passt zum Untergrund –
 * helle Variante auf hellen, dunkle Variante auf dunklen Flächen. Fehlt die Datei, wird ein schlichtes V gezeichnet.
 */
export function BrandMark({ src, tone = "light", className }: { src?: string | null; tone?: "light" | "dark"; className?: string }) {
  if (src) return <img src={src} alt="" aria-hidden="true" draggable={false} className={cn("select-none object-contain", className)} />;
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn(tone === "dark" ? "text-ondark-link" : "text-emerald-400", className)}>
      <path d="M2.5 4h4.2l5.3 10.6L17.3 4h4.2L13.6 20h-3.2z" fill="currentColor" />
    </svg>
  );
}
