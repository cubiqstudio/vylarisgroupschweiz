import { Asterisk, Users, Wallet } from "lucide-react";
import { Container } from "@/components/ui/section";
import { getMessages } from "@/i18n/server";
import { home } from "@/i18n/home";

const ICONS = [Asterisk, Wallet, Users] as const;

export async function ValueGrid() {
  const m = (await getMessages(home)).values;
  const values = m.items.map((v, i) => ({ ...v, icon: ICONS[i] ?? Asterisk }));
  return (
    <section className="py-20 sm:py-28" aria-labelledby="werte-heading">
      <Container>
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">{m.eyebrow}</p>
        <h2 id="werte-heading" className="max-w-3xl text-balance text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl">
          {m.heading}
        </h2>
        <ul className="mt-12 grid gap-5 md:grid-cols-3">
          {values.map((v) => (
            <li key={v.title} className="flex">
              <div className="bg-card-soft flex w-full flex-col rounded-2xl border border-zinc-800/60 p-7 pt-12 shadow-sm shadow-slate-900/5 transition-shadow hover:shadow-md sm:pt-16">
                <v.icon className="h-8 w-8 text-white" strokeWidth={2.4} aria-hidden />
                <h3 className="mt-8 text-lg font-semibold tracking-tight text-white">{v.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-zinc-300">{v.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
