import { AlertTriangle, ArrowRight, PackageOpen } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container, SectionHeading } from "@/components/ui/section";
import { db } from "@/lib/db";
import { getLocale, getMessages } from "@/i18n/server";
import { home } from "@/i18n/home";
import { HomeServiceCard, type HomeService } from "./service-card";

async function loadServices(): Promise<{ services: HomeService[]; failed: boolean }> {
  try {
    const rows = await db.saasService.findMany({
      orderBy: [{ featured: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
      take: 4,
      select: {
        id: true,
        name: true,
        tagline: true,
        category: true,
        url: true,
        repoUrl: true,
        status: true,
        comingSoon: true,
      },
    });
    return { services: rows satisfies HomeService[], failed: false };
  } catch {
    return { services: [], failed: true };
  }
}

export async function ServicesPreview() {
  const locale = await getLocale();
  const m = (await getMessages(home)).services;
  const { services, failed } = await loadServices();

  return (
    <section className="py-20 sm:py-28" aria-labelledby="dienste-heading">
      <Container>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeading
            eyebrow={m.eyebrow}
            title={<span id="dienste-heading">{m.title}</span>}
            description={m.description}
          />
          {services.length > 0 && (
            <ButtonLink href="/services" variant="secondary" className="shrink-0 self-start sm:self-auto">
              {m.all}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </ButtonLink>
          )}
        </div>

        {services.length > 0 ? (
          <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {services.map((s) => (
              <li key={s.id}>
                <HomeServiceCard service={s} locale={locale} />
              </li>
            ))}
          </ul>
        ) : (
          <Card className="mt-12 flex flex-col items-center px-6 py-14 text-center">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-800/80 text-zinc-400 ring-1 ring-inset ring-zinc-700">
              {failed ? <AlertTriangle className="h-5 w-5 text-amber-400" aria-hidden /> : <PackageOpen className="h-5 w-5" aria-hidden />}
            </span>
            <h3 className="mt-5 text-lg font-semibold text-white">
              {failed ? m.failedTitle : m.emptyTitle}
            </h3>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-400">
              {failed ? m.failedText : m.emptyText}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <ButtonLink href="/status" variant="secondary" size="sm">{m.toStatus}</ButtonLink>
              <ButtonLink href="/contact" variant="ghost" size="sm">{m.toContact}</ButtonLink>
            </div>
          </Card>
        )}
      </Container>
    </section>
  );
}
