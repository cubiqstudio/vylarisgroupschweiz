import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/section";
import { getMessages } from "@/i18n/server";
import { home } from "@/i18n/home";

/** «Freude an freiwilliger Arbeit»: Haltung des Vereins als Textblock, bewusst ohne Zitat einzelner Personen. */
export async function Volunteer() {
  const m = (await getMessages(home)).volunteer;
  return (
    <section className="py-20 sm:py-28" aria-labelledby="freude-heading">
      <Container>
        <div className="rounded-3xl border border-zinc-800 bg-surface px-6 py-12 shadow-sm shadow-slate-900/5 sm:px-14 sm:py-16">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">{m.eyebrow}</p>
          <h2
            id="freude-heading"
            className="mx-auto mt-4 max-w-3xl text-balance text-center text-2xl font-medium leading-snug tracking-tight text-white sm:text-3xl"
          >
            {m.heading}
          </h2>
          <div className="mx-auto mt-8 max-w-3xl space-y-5 text-center leading-relaxed text-zinc-400">
            {m.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-6">
            <Link
              href="/about"
              className="inline-flex items-center gap-2 text-sm font-medium text-emerald-400 transition-colors hover:text-emerald-300"
            >
              {m.aboutLink}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 text-sm font-medium text-emerald-400 transition-colors hover:text-emerald-300"
            >
              {m.blogLink}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}
