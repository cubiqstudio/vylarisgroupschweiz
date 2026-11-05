import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Mail, MessageCircle } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container, PageHeader, SectionHeading } from "@/components/ui/section";
import { pricing } from "@/i18n/pricing";
import { getMessages } from "@/i18n/server";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages(pricing);
  return {
    title: m.meta.title,
    description: m.meta.description(site.name),
    alternates: { canonical: "/preise" },
  };
}

export default async function PricingPage() {
  const m = await getMessages(pricing);

  return (
    <>
      <PageHeader
        eyebrow={m.hero.eyebrow}
        title={
          <>
            {m.hero.titlePre}{" "}
            <span className="text-gradient">{m.hero.titleAccent}</span>
            {m.hero.titlePost}
          </>
        }
        description={m.hero.description}
      />

      <section className="py-16 sm:py-24" aria-label={m.plans.label}>
        <Container>
          <ul className="grid gap-6 lg:grid-cols-2">
            {m.plans.items.map((plan) => (
              <li key={plan.name} className="flex">
                <Card
                  className={cn(
                    "flex w-full flex-col p-7 sm:p-9",
                    plan.featured && "border-emerald-400/30",
                  )}
                >
                  <h2 className="text-xl font-semibold tracking-tight text-white">{plan.name}</h2>
                  <p
                    className={cn(
                      "mt-3 text-3xl font-semibold tracking-tight sm:text-4xl",
                      plan.featured ? "text-emerald-400" : "text-white",
                    )}
                  >
                    {plan.price}
                  </p>
                  <p className="mt-4 leading-relaxed text-zinc-400">{plan.text}</p>
                  <p className="mt-8 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    {m.plans.included}
                  </p>
                  <ul className="mt-4 flex-1 space-y-2.5 border-t border-zinc-800 pt-5 text-sm text-zinc-300">
                    {plan.features.map((f) => (
                      <li key={f} className="flex gap-2.5">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <ButtonLink
                    href="/contact"
                    size="lg"
                    variant={plan.featured ? "primary" : "secondary"}
                    className="mt-8 w-full"
                  >
                    {plan.cta}
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </ButtonLink>
                </Card>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section className="border-y border-zinc-900 bg-zinc-900/20 py-16 sm:py-24" aria-labelledby="ablauf-heading">
        <Container>
          <SectionHeading
            eyebrow={m.process.eyebrow}
            title={<span id="ablauf-heading">{m.process.title}</span>}
            description={m.process.text}
          />
          <p className="mt-8">
            <Link
              href="/about#prozess"
              className="inline-flex items-center gap-2 text-sm font-medium text-emerald-400 transition-colors hover:text-emerald-300"
            >
              {m.process.link}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </p>
        </Container>
      </section>

      <Container className="py-14 sm:py-20">
        <aside
          aria-label={m.aside.label}
          className="flex flex-col gap-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.05] p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8"
        >
          <div>
            <p className="text-lg font-semibold tracking-tight text-white">{m.aside.title}</p>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-zinc-400">{m.aside.text}</p>
          </div>
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
            <ButtonLink href="/contact">
              <Mail className="h-4 w-4" aria-hidden />
              {m.aside.contact}
            </ButtonLink>
            <ButtonLink href={site.social.discord} external variant="secondary">
              <MessageCircle className="h-4 w-4" aria-hidden />
              {m.aside.discord}
              <span className="sr-only">{m.aside.discordNewTab}</span>
            </ButtonLink>
          </div>
        </aside>
      </Container>
    </>
  );
}
