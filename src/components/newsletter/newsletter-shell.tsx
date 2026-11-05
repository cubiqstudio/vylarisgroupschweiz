import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/section";
import { BrandMark } from "./brand-mark";
import { resolveMarkSrc } from "./mark-src";

/** Schmale, zentrierte Karte mit V-Zeichen für die Newsletter-Seiten (Bestätigen / Abmelden). */
export function NewsletterShell({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  const markSrc = resolveMarkSrc("light");
  return (
    <div className="bg-hero relative overflow-hidden">
      <div className="bg-grid pointer-events-none absolute inset-0" aria-hidden />
      <Container className="relative py-12 sm:py-20">
        <div className="mx-auto w-full max-w-md motion-safe:animate-fade-up">
          <Card className="relative overflow-hidden p-6 sm:p-8">
            <BrandMark src={markSrc} className="pointer-events-none absolute -bottom-10 -right-8 size-48 opacity-[0.07]" />
            <div className="relative">
              <span className="flex size-14 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950 shadow-sm">
                <BrandMark src={markSrc} className="size-9" />
              </span>
              <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">{eyebrow}</p>
              <h1 className="mt-2 text-balance text-2xl font-semibold tracking-tight text-white sm:text-3xl">{title}</h1>
              <div className="mt-5">{children}</div>
            </div>
          </Card>
        </div>
      </Container>
    </div>
  );
}
