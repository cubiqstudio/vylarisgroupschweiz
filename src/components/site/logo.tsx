/* eslint-disable @next/next/no-img-element -- Logos sind kleine statische Dateien; <img> unterstützt auch SVG/WebP ohne Bildoptimierung */
import Link from "next/link";
import { findBrandAsset } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { getMessages, getSite } from "@/i18n/server";
import { shell } from "@/i18n/shell";

type Tone = "onLight" | "onDark";
type Size = "md" | "lg";

/**
 * Logo der VylarisGroup Schweiz aus den Bilddateien in public/images (siehe src/lib/brand.ts):
 * `logo-schweiz-on-light.*` für helle, `logo-schweiz-on-dark.*` für dunkle Flächen.
 * `tone` gibt den Untergrund an: "onLight" (Standard, Header) oder "onDark" (Footer).
 */
export async function Logo({ className, size = "md", tone = "onLight" }: { className?: string; size?: Size; tone?: Tone }) {
  const site = await getSite();
  const m = await getMessages(shell);
  const imgClass = cn("w-auto", size === "lg" ? "h-28" : "h-[4.25rem]");
  // Auf hellem Untergrund (Header) gibt es im Dunkelmodus die Variante für dunkle Flächen; der Footer ist immer dunkel.
  const light = findBrandAsset("logo-schweiz-on-light");
  const dark = findBrandAsset("logo-schweiz-on-dark");
  const swap = tone === "onLight";
  const onDarkSrc = dark ?? light;
  return (
    <Link href="/" aria-label={m.logo.homeLabel(site.name)} className={cn("inline-flex shrink-0 items-center", className)}>
      {swap && light && <img src={light} alt="" className={cn(imgClass, "dark:hidden")} />}
      {(swap ? dark : onDarkSrc) && <img src={(swap ? dark : onDarkSrc) as string} alt="" className={cn(imgClass, swap && "hidden dark:block")} />}
    </Link>
  );
}
