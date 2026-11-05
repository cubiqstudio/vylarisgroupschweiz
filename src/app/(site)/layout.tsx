import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { ConsentProvider } from "@/components/consent/consent-provider";
import { CookieBanner } from "@/components/consent/cookie-banner";
import { findBrandAsset } from "@/lib/brand";
import { SiteProvider } from "@/i18n/client";
import { getMessages, getSite } from "@/i18n/server";
import { siteMeta } from "@/i18n/meta";

// Öffentliche Seiten: Header zeigt den Live-Status aus der DB → immer dynamisch rendern.
export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const site = await getSite();
  const meta = await getMessages(siteMeta);
  return (
    <SiteProvider site={site}>
    <ConsentProvider>
      <div className="flex min-h-screen flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-emerald-400 focus:px-4 focus:py-2 focus:text-surface">
          {meta.skip}
        </a>
        <SiteHeader />
        <main id="main" className="flex-1">{children}</main>
        <SiteFooter />
      </div>
      <CookieBanner markLight={findBrandAsset("logo-mark-on-light")} markDark={findBrandAsset("logo-mark-on-dark")} />
    </ConsentProvider>
    </SiteProvider>
  );
}
