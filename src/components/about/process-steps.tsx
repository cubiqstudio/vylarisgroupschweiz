import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Container, SectionHeading } from "@/components/ui/section";
import { about } from "@/i18n/about";
import { getMessages } from "@/i18n/server";

/** So läuft eine Anfrage ab: vier nummerierte Schritte von der Anfrage bis zum gemeinsamen Launch. */
export async function ProcessSteps() {
  const m = (await getMessages(about)).process;
  return (
    <section
      id="prozess"
      className="scroll-mt-20 border-y border-zinc-900 bg-zinc-900/20 py-20 sm:py-28"
      aria-labelledby="prozess-heading"
    >
      <Container>
        <SectionHeading
          align="center"
          eyebrow={m.eyebrow}
          title={<span id="prozess-heading">{m.title}</span>}
          description={m.description}
        />
        <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {m.steps.map((step, i) => (
            <li key={step.title} className="flex">
              <Card className="w-full p-7 transition-colors hover:border-emerald-400/30">
                <p className="font-mono text-xs text-emerald-400">0{i + 1}</p>
                <h3 className="mt-3 text-lg font-semibold tracking-tight text-white">{step.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-zinc-400">{step.text}</p>
              </Card>
            </li>
          ))}
        </ol>
        <p className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-8">
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 text-sm font-medium text-emerald-400 transition-colors hover:text-emerald-300"
          >
            {m.request}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link
            href="/preise"
            className="inline-flex items-center gap-2 text-sm font-medium text-emerald-400 transition-colors hover:text-emerald-300"
          >
            {m.pricing}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </p>
      </Container>
    </section>
  );
}
