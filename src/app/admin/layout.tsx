import type { Metadata } from "next";
import { SITE } from "@/lib/sites";

export const metadata: Metadata = {
  title: { default: `${SITE.name} – Verwaltung`, template: `%s | ${SITE.name} – Verwaltung` },
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

// Der gesamte Admin-Bereich ist sitzungsabhängig und liest die Datenbank.
export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-zinc-950 text-zinc-200">{children}</div>;
}
