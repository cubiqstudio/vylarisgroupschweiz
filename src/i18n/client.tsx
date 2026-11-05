"use client";

import { createContext, useContext } from "react";
import { pick, type Messages } from "@/i18n";
import { SITE, type Locale, type SiteProfile } from "@/lib/sites";

const SiteContext = createContext<SiteProfile>(SITE);

/** Stellt Profil + Sprache der Seite für Client-Komponenten bereit (im (site)-Layout eingebunden). */
export function SiteProvider({ site, children }: { site: SiteProfile; children: React.ReactNode }) {
  return <SiteContext.Provider value={site}>{children}</SiteContext.Provider>;
}

export function useSite(): SiteProfile {
  return useContext(SiteContext);
}

export function useLocale(): Locale {
  return useContext(SiteContext).locale;
}

export function useMessages<T>(m: Messages<T>): T {
  return pick(m, useLocale());
}
