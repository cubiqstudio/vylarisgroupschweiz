/* eslint-disable @next/next/no-img-element -- Logos sind kleine statische Dateien; <img> unterstützt auch SVG/WebP ohne Bildoptimierung */
import Link from "next/link";
import { findBrandAsset } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { getMessages, getSite } from "@/i18n/server";
import { shell } from "@/i18n/shell";

type Tone = "onLight" | "onDark";
type Size = "md" | "lg";

/**
 * Wortmarke für Seiten ohne eigenes Logo-Bild: V-Zeichen oben, darunter "Vylaris Group <Region>" als Text – im
 * gleichen Aufbau wie die Bilddatei (Zeichen über der Schrift). Alle Maße in em, die Schriftgröße steuert die Größe;
 * sie ist so gewählt, dass die Höhe der des Logo-Bilds entspricht (md 4,25 rem, lg 7 rem).
 */
function Wordmark({ region, tone, size, markSrc }: { region: string; tone: Tone; size: Size; markSrc: string | null }) {
  const dark = tone === "onDark";
  return (
    <span
      className={cn("flex flex-col items-center whitespace-nowrap font-medium leading-none tracking-tight", size === "lg" ? "h-28 w-[13.35rem] text-[1.125rem]" : "h-[4.25rem] w-[8.1rem] text-[0.6875rem]")}
      aria-hidden="true"
    >
      {markSrc ? (
        <img src={markSrc} alt="" className="-mt-[0.2em] size-[4.1em] max-w-none" draggable={false} />
      ) : (
        <span className="mt-[0.4em] flex h-[3.2em] items-center text-[2.6em] font-bold text-[#2a66d9]">V</span>
      )}
      <span className="mt-[0.45em] flex items-baseline gap-[0.12em] text-[1.05em]">
        <span className={dark ? "text-[#ffffff]" : "text-white"}>Vylaris</span>
        <span className="ml-[0.1em] text-[#3d95f2]">Group</span>
        <span className="text-[#1e5fdc]">{region}</span>
      </span>
    </span>
  );
}

/**
 * Logo der aktuellen Marke. vylaris.eu nutzt die Bilddateien aus public/images (siehe src/lib/brand.ts):
 * `logo-europe-on-light.*` für helle, `logo-europe-on-dark.*` für dunkle Flächen. Für die anderen Marken gibt es keine
 * Wortmarken-Bilder: dort stehen das vorhandene V-Zeichen (`logo-mark-on-light/dark`) und die Wortmarke als Text.
 * `tone` gibt den Untergrund an: "onLight" (Standard, Header) oder "onDark" (Footer).
 */
export async function Logo({ className, size = "md", tone = "onLight" }: { className?: string; size?: Size; tone?: Tone }) {
  const site = await getSite();
  const m = await getMessages(shell);
  const eu = site.key === "eu";
  const imgClass = cn("w-auto", size === "lg" ? "h-28" : "h-[4.25rem]");
  // Auf hellem Untergrund (Header) gibt es im Dunkelmodus die Variante für dunkle Flächen; der Footer ist immer dunkel.
  const light = eu ? findBrandAsset("logo-europe-on-light") : null;
  const dark = eu ? findBrandAsset("logo-europe-on-dark") : null;
  const markLight = eu ? null : findBrandAsset("logo-mark-on-light");
  const markDark = eu ? null : findBrandAsset("logo-mark-on-dark");
  const swap = tone === "onLight";
  return (
    <Link href="/" aria-label={m.logo.homeLabel(site.name)} className={cn("inline-flex shrink-0 items-center", className)}>
      {eu ? (
        <>
          {swap && light && <img src={light} alt="" className={cn(imgClass, "dark:hidden")} />}
          {(swap ? dark : dark ?? light) && <img src={(swap ? dark : dark ?? light) as string} alt="" className={cn(imgClass, swap && "hidden dark:block")} />}
        </>
      ) : (
        <>
          {swap && <span className="dark:hidden"><Wordmark region={site.region} tone="onLight" size={size} markSrc={markLight} /></span>}
          <span className={swap ? "hidden dark:block" : undefined}>
            <Wordmark region={site.region} tone="onDark" size={size} markSrc={markDark} />
          </span>
        </>
      )}
    </Link>
  );
}
