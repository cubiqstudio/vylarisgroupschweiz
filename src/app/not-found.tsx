import type { Metadata } from "next";
import { Logo } from "@/components/site/logo";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/section";
import { getMessages } from "@/i18n/server";
import { shell } from "@/i18n/shell";

export async function generateMetadata(): Promise<Metadata> {
  const m = (await getMessages(shell)).notFound;
  return { title: m.title, robots: { index: false } };
}

/** Globale 404-Seite (greift für alle nicht existierenden Pfade, auch außerhalb von (site)). Läuft ohne SiteProvider: Sprache und Marke kommen vom Server. */
export default async function GlobalNotFound() {
  const m = (await getMessages(shell)).notFound;
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-hero">
      <Container className="relative py-24 text-center">
        <Logo size="lg" className="mb-10" />
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-400">{m.eyebrow}</p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-white sm:text-5xl">{m.heading}</h1>
        <p className="mx-auto mt-4 max-w-md text-zinc-400">{m.text}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/">{m.toHome}</ButtonLink>
          <ButtonLink href="/services" variant="secondary">{m.toServices}</ButtonLink>
        </div>
      </Container>
    </main>
  );
}
