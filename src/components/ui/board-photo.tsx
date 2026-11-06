import Image from "next/image";
import { cn } from "@/lib/utils";

/** Abmessungen von public/images/vorstand.webp (seitlich beschnitten, nicht hochskaliert). */
const WIDTH = 843;
const HEIGHT = 506;

/**
 * Foto des Vorstands (freigestellt, mit Transparenz) auf einer ruhigen, bewusst hellen Fläche. Die Fläche bleibt in Hell und
 * Dunkel hell/mittel, damit die dunkle Kleidung nicht im Hintergrund verschwindet. Das Foto steht am unteren Rand der Karte.
 * Die Bildunterschrift nennt nur den Vorstand insgesamt, nie einzelne Personen.
 */
export function BoardPhoto({
  alt,
  caption,
  sizes,
  priority = false,
  className,
}: {
  alt: string;
  caption?: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <figure className={cn("m-0", className)}>
      <div className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-[linear-gradient(180deg,#f7f9fd_0%,#dfe5f0_100%)] px-4 pt-8 shadow-sm shadow-slate-900/5 dark:bg-[linear-gradient(180deg,#dbe3f0_0%,#aebbd0_100%)] sm:px-10 sm:pt-12">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(520px_circle_at_20%_0%,rgba(42,102,217,0.14),transparent_60%),radial-gradient(520px_circle_at_85%_10%,rgba(66,86,224,0.12),transparent_60%)]"
          aria-hidden
        />
        <Image
          src="/images/vorstand.webp"
          alt={alt}
          width={WIDTH}
          height={HEIGHT}
          sizes={sizes}
          priority={priority}
          loading={priority ? undefined : "lazy"}
          className="relative mx-auto block h-auto w-full max-w-2xl"
        />
      </div>
      {caption ? <figcaption className="mt-3 text-center text-sm text-zinc-500">{caption}</figcaption> : null}
    </figure>
  );
}
