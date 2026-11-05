/* eslint-disable @next/next/no-img-element -- kleine statische Markendatei; <img> unterstützt auch SVG/WebP ohne Bildoptimierung */
import { findBrandAsset } from "@/lib/brand";
import { cn } from "@/lib/utils";

/**
 * Nur das „V“-Zeichen der Marke als kleine Kachel. `tone` gibt den Untergrund an, auf dem die Kachel steht:
 * - "onLight": helle Fläche, Kachel weiß mit dem Zeichen für helle Flächen (logo-mark-on-light)
 * - "onDark": dunkle Fläche, dunkle Kachel mit dem Zeichen für dunkle Flächen (logo-mark-on-dark)
 * Fehlt die Bilddatei, wird ein „V“ als Text gesetzt. Größe über `className` (z. B. "size-10").
 */
export function BrandMark({ tone = "onLight", className }: { tone?: "onLight" | "onDark"; className?: string }) {
  const src = findBrandAsset(tone === "onDark" ? "logo-mark-on-dark" : "logo-mark-on-light");
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl ring-1 ring-inset",
        tone === "onDark" ? "bg-ink ring-surface/20" : "bg-surface ring-zinc-800",
        className,
      )}
    >
      {src ? (
        <img src={src} alt="" className="size-full object-contain p-[14%]" draggable={false} />
      ) : (
        <span className={cn("text-lg font-bold leading-none", tone === "onDark" ? "text-surface" : "text-emerald-400")}>V</span>
      )}
    </span>
  );
}
