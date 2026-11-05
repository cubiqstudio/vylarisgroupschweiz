import type { Metadata, Viewport } from "next";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import "./globals.css";
import { findBrandAsset } from "@/lib/brand";
import { baseUrlFor, getSite } from "@/i18n/server";
import { pick } from "@/i18n";
import { siteMeta } from "@/i18n/meta";
import { ThemeScript } from "@/components/theme/theme-script";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSite();
  const m = pick(siteMeta, s.locale);
  const description = m.description(s.name);
  return {
    icons: { icon: findBrandAsset("logo-mark-on-light") ?? undefined },
    metadataBase: new URL(baseUrlFor(s)),
    title: { default: `${s.name} – ${m.tagline}`, template: `%s | ${s.name}` },
    description,
    applicationName: s.name,
    openGraph: { title: s.name, description, type: "website", locale: s.locale === "en" ? "en_US" : "de_DE", siteName: s.name },
    robots: { index: s.online, follow: s.online },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f8ff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0d11" },
  ],
  colorScheme: "light dark",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const s = await getSite();
  return (
    <html lang={s.locale} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
