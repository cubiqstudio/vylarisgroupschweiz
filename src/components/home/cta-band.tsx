import { ArrowRight, Mail } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/section";
import { getMessages } from "@/i18n/server";
import { home } from "@/i18n/home";

export async function CtaBand() {
  const m = (await getMessages(home)).cta;
  return (
    <section className="py-20 sm:py-28" aria-labelledby="cta-heading">
      <Container>
        <div className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-surface px-6 py-14 text-center sm:px-12 sm:py-20">
          <div className="bg-glow pointer-events-none absolute inset-0" aria-hidden />
          <div className="relative">
            <h2 id="cta-heading" className="mx-auto max-w-2xl text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {m.headingLead}<span className="text-gradient">{m.headingEm}</span>{m.headingTail}
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-zinc-400">
              {m.text}
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <ButtonLink href="/services" size="lg">
                {m.services}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </ButtonLink>
              <ButtonLink href="/contact" variant="secondary" size="lg">
                <Mail className="h-4 w-4" aria-hidden />
                {m.contact}
              </ButtonLink>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
