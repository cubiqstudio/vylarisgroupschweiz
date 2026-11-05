"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ban, Lock, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useMessages } from "@/i18n/client";
import { consent } from "@/i18n/consent";
import { BANNER_HIDDEN_PATHS } from "./consent-config";
import { ConsentMark } from "./consent-mark";
import { consentButtonPrimary, consentButtonSecondary, consentLink } from "./consent-styles";
import { CookieSettingsDialog } from "./cookie-settings-dialog";
import { useConsent } from "./use-consent";

function isHiddenPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return BANNER_HIDDEN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

const FACT_ICONS = [Ban, ShieldCheck, Lock] as const;

/**
 * Cookie-Hinweis unten (mobil volle Breite, ab sm unten links). Zeigt sich erst nach der Hydration und nur, solange noch
 * keine Entscheidung vorliegt; nicht auf /datenschutz und /impressum. Er stiehlt keinen Fokus; Escape betrifft nur den
 * Einstellungs-Dialog. Der Dialog selbst ist immer eingehängt, damit der Footer-Link überall funktioniert.
 */
export function CookieBanner({ markLight, markDark }: { markLight: string | null; markDark: string | null }) {
  const pathname = usePathname();
  const m = useMessages(consent);
  const { ready, decided, accept, open } = useConsent();
  const visible = ready && !decided && !isHiddenPath(pathname);

  return (
    <>
      {visible && (
        <div
          role="region"
          aria-label={m.banner.region}
          className="pointer-events-none fixed inset-x-0 bottom-0 z-50 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:inset-x-auto sm:bottom-4 sm:left-4 sm:w-full sm:max-w-md sm:p-0"
        >
          <div
            className={cn(
              "animate-fade-up pointer-events-auto relative overflow-hidden rounded-2xl bg-surface shadow-2xl shadow-navy/20 ring-1 ring-zinc-800",
              "dark:bg-ink dark:ring-white/15 dark:shadow-black/50",
            )}
          >
            {/* Markenakzent: Farbverlauf-Leiste und weiches Leuchten hinter dem Zeichen */}
            <div aria-hidden="true" className="h-1 bg-gradient-to-r from-emerald-400 via-indigo-400 to-emerald-400" />
            <div aria-hidden="true" className="pointer-events-none absolute -left-8 top-0 size-36 rounded-full bg-emerald-400/15 blur-3xl dark:bg-emerald-400/25" />

            <div className="relative p-5">
              <div className="flex items-center gap-3.5">
                <ConsentMark light={markLight} dark={markDark} />
                <div className="min-w-0">
                  <h2 className="text-base font-semibold leading-tight tracking-tight text-white dark:text-zinc-100">
                    {m.banner.title}
                  </h2>
                  <p className="mt-0.5 text-xs font-medium uppercase tracking-[0.14em] text-emerald-400 dark:text-ondark-link">
                    {m.banner.eyebrow}
                  </p>
                </div>
              </div>

              <p className="mt-4 text-sm leading-relaxed text-zinc-400 dark:text-zinc-300">{m.banner.body}</p>

              <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={m.banner.factsLabel}>
                {m.banner.facts.map((label, i) => {
                  const Icon = FACT_ICONS[i] ?? Ban;
                  return (
                  <li
                    key={label}
                    className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-2.5 py-1 text-xs font-medium text-zinc-300 ring-1 ring-inset ring-zinc-800 dark:bg-white/10 dark:text-zinc-200 dark:ring-white/15"
                  >
                    <Icon className="size-3.5 text-emerald-400 dark:text-ondark-link" aria-hidden="true" />
                    {label}
                  </li>
                  );
                })}
              </ul>

              <div className="mt-5 flex flex-col gap-2 min-[400px]:flex-row">
                <button type="button" onClick={accept} className={buttonClass("primary", "md", cn("flex-1", consentButtonPrimary))}>
                  {m.banner.accept}
                </button>
                <button
                  type="button"
                  onClick={open}
                  aria-haspopup="dialog"
                  className={buttonClass("secondary", "md", cn("flex-1", consentButtonSecondary))}
                >
                  <SlidersHorizontal className="size-4" aria-hidden="true" />
                  {m.banner.settings}
                </button>
              </div>

              <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
                {m.banner.moreBefore}
                <Link href={m.privacyHref} className={consentLink}>
                  {m.privacyLink}
                </Link>
                {m.banner.moreAfter}
              </p>
            </div>
          </div>
        </div>
      )}
      <CookieSettingsDialog markLight={markLight} markDark={markDark} />
    </>
  );
}
