import Link from "next/link";
import {
  ArrowRight,
  Heart,
  KeyRound,
  Server,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Container, SectionHeading } from "@/components/ui/section";
import { about } from "@/i18n/about";
import { getMessages } from "@/i18n/server";

const icons: LucideIcon[] = [Heart, KeyRound, Server];

export async function FundingPrinciples() {
  const m = (await getMessages(about)).funding;
  return (
    <section
      className="border-t border-zinc-900 bg-zinc-900/20 py-20 sm:py-28"
      aria-labelledby="kostenlos-heading"
    >
      <Container>
        <SectionHeading
          eyebrow={m.eyebrow}
          title={<span id="kostenlos-heading">{m.title}</span>}
          description={m.description}
        />
        <ul className="mt-12 grid gap-6 md:grid-cols-3">
          {m.principles.map((p, i) => {
            const Icon = icons[i]!;
            return (
              <li key={p.title} className="flex">
                <Card className="w-full p-7">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-400 ring-1 ring-inset ring-emerald-400/20">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <h3 className="mt-5 text-lg font-semibold tracking-tight text-white">
                    {p.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                    {p.body}
                  </p>
                </Card>
              </li>
            );
          })}
        </ul>
        <p className="mt-8">
          <Link
            href="/contact?category=B2B_HOSTING"
            className="inline-flex items-center gap-2 text-sm font-medium text-emerald-400 transition-colors hover:text-emerald-300"
          >
            {m.cta}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </p>
      </Container>
    </section>
  );
}
