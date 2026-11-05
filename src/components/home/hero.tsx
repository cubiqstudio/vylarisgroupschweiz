import fs from "node:fs";
import path from "node:path";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/section";
import { findBrandAsset } from "@/lib/brand";
import { getMessages, getSite } from "@/i18n/server";
import { home } from "@/i18n/home";
import { siteMeta } from "@/i18n/meta";

const TEAM_IMAGES = ["team.webp", "team.png", "team.jpg"];

/** Liefert den öffentlichen Pfad eines hinterlegten Teamfotos – oder null, wenn keines existiert. */
function findTeamImage(): string | null {
  try {
    for (const file of TEAM_IMAGES) {
      if (fs.existsSync(path.join(process.cwd(), "public", "images", file))) return `/images/${file}`;
    }
  } catch {
    /* Dateisystem nicht lesbar: Platzhalter zeigen */
  }
  return null;
}

/**
 * Schild-/Netzwerk-Motiv mit dem V-G-Zeichen der Marke in Blau (public/images/logo-mark-blue.png, siehe src/lib/brand.ts).
 * `tone` ist der UNTERGRUND: "onLight" (Standard) = weißes Schild, "onDark" = dunkles Glas-Schild; das blaue Zeichen
 * passt auf beide. Fehlt die blaue Datei, werden die Hell-/Dunkel-Zeichen bzw. ein gezeichnetes V verwendet.
 */
export function ShieldVisual({ tone = "onLight", idp = "vge" }: { tone?: "onLight" | "onDark"; idp?: string }) {
  const darkShield = tone === "onDark";
  const mark = findBrandAsset("logo-mark-blue") ?? findBrandAsset(darkShield ? "logo-mark-on-dark" : "logo-mark-on-light");
  const nodes: [number, number][] = [
    [70, 150], [130, 70], [250, 40], [370, 70], [430, 150], [90, 215], [410, 215],
  ];
  const line = "#1e73be";
  return (
    <div className="relative mx-auto aspect-[500/262] w-full max-w-xl select-none" aria-hidden>
      <svg viewBox="0 0 500 262" className="absolute inset-0 h-full w-full overflow-visible" fill="none" focusable="false">
        <defs>
          <radialGradient id={`${idp}-glow`} cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#1e73be" stopOpacity="0.45" />
            <stop offset="0.55" stopColor="#1e73be" stopOpacity="0.12" />
            <stop offset="1" stopColor="#1e73be" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${idp}-shield-dark`} x1="190" y1="62" x2="320" y2="240" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#26365f" />
            <stop offset="0.55" stopColor="#111a33" />
            <stop offset="1" stopColor="#070b17" />
          </linearGradient>
          <linearGradient id={`${idp}-shield-light`} x1="190" y1="62" x2="320" y2="240" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="1" stopColor="#dfe7f6" />
          </linearGradient>
          <linearGradient id={`${idp}-sheen`} x1="250" y1="62" x2="250" y2="170" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#ffffff" stopOpacity={darkShield ? 0.22 : 0.7} />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>

        <circle cx="250" cy="150" r="150" fill={`url(#${idp}-glow)`} className="animate-glow-pulse" />

        <g stroke={line} strokeOpacity="0.28" strokeWidth="1.5">
          {nodes.map(([x, y]) => (
            <line key={`${x}-${y}`} x1="250" y1="150" x2={x} y2={y} />
          ))}
        </g>
        <g className="animate-spin-slow" stroke={line} strokeOpacity="0.3" strokeWidth="1.5">
          <circle cx="250" cy="150" r="118" strokeDasharray="3 7" />
        </g>
        <g className="animate-spin-slow-rev" stroke={line} strokeOpacity="0.2" strokeWidth="1.5">
          <circle cx="250" cy="150" r="170" strokeDasharray="3 9" />
        </g>

        {nodes.map(([x, y], i) => (
          <g key={`n-${x}-${y}`}>
            <circle
              cx={x}
              cy={y}
              r="16"
              fill="#1e73be"
              opacity="0.14"
              className="animate-node-pulse"
              style={{ animationDelay: `${i * 0.45}s` }}
            />
            <circle cx={x} cy={y} r="9" fill="#ffffff" stroke="#1e73be" strokeWidth="2" />
            <circle cx={x} cy={y} r="3.5" fill="#1e73be" />
          </g>
        ))}

        <path
          d="M250 62 178 90v52c0 46 30 80 72 96 42-16 72-50 72-96V90L250 62Z"
          fill={darkShield ? `url(#${idp}-shield-dark)` : `url(#${idp}-shield-light)`}
          stroke={darkShield ? "#2f6fa8" : "#0f1f4d"}
          strokeOpacity={darkShield ? 0.9 : 1}
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path d="M250 70 185 95v47c0 40 26 70 65 85V70Z" fill={`url(#${idp}-sheen)`} opacity="0.55" />
        {!mark && (
          <g>
            <polygon points="214,112 229,112 258,176 243,176" fill={darkShield ? "#ffffff" : "#0f1f4d"} />
            <polygon points="251,176 282,112 296,112 266,176" fill="#1e73be" />
          </g>
        )}
      </svg>
      {mark && (
        // eslint-disable-next-line @next/next/no-img-element -- kleine statische Marke, kein Bild-Optimierer nötig
        <img
          src={mark}
          alt=""
          className="absolute left-1/2 top-[57.25%] aspect-square w-[23.5%] -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_4px_12px_rgba(30,115,190,0.3)]"
        />
      )}
    </div>
  );
}

export async function Hero() {
  const teamImage = findTeamImage();
  const site = await getSite();
  const m = (await getMessages(home)).hero;
  const meta = await getMessages(siteMeta);
  return (
    <section className="relative overflow-hidden border-b border-zinc-800 bg-hero">
      <Container className="relative flex flex-col items-center pt-14 text-center sm:pt-20">
        <div className="animate-fade-up flex w-full min-w-0 flex-col items-center">
          <h1 className="min-w-0 max-w-3xl text-balance break-words text-[1.75rem] font-semibold leading-[1.14] tracking-tight text-white min-[390px]:text-3xl min-[480px]:text-4xl sm:text-5xl lg:text-[3.1rem]">
            {m.headingLead}<br className="hidden sm:block" /> {site.name}.
          </h1>
          <p className="mt-5 text-xl font-semibold tracking-tight text-white sm:text-2xl">{meta.tagline}</p>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg">
            {m.body}
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/services" size="lg">
              {m.ctaServices}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </ButtonLink>
            <ButtonLink href="/allianz" variant="secondary" size="lg">
              {m.ctaAlliance}
            </ButtonLink>
          </div>
        </div>

        <div className="mt-12 w-full sm:mt-16">
          {teamImage ? (
            <div className="relative mx-auto h-72 w-full max-w-3xl sm:h-[26rem]">
              <Image
                src={teamImage}
                alt={m.teamAlt}
                fill
                priority
                sizes="(min-width: 768px) 768px, 100vw"
                className="object-contain object-bottom"
              />
            </div>
          ) : (
            <>
              <div className="w-full dark:hidden">
                <ShieldVisual idp="vge-l" />
              </div>
              <div className="hidden w-full dark:block">
                <ShieldVisual tone="onDark" idp="vge-d" />
              </div>
            </>
          )}
        </div>
      </Container>
    </section>
  );
}
