import { Check, Code2, ShieldCheck, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Container, SectionHeading } from "@/components/ui/section";
import { about } from "@/i18n/about";
import { getMessages } from "@/i18n/server";

const visuals: { icon: LucideIcon; accent: "emerald" | "indigo" }[] = [
  { icon: ShieldCheck, accent: "emerald" },
  { icon: Code2, accent: "indigo" },
  { icon: ShieldCheck, accent: "emerald" },
];

const accentClass = {
  emerald: {
    icon: "bg-emerald-400/10 text-emerald-400 ring-emerald-400/20",
    check: "text-emerald-400",
    card: "hover:border-emerald-400/30",
  },
  indigo: {
    icon: "bg-indigo-400/10 text-indigo-300 ring-indigo-400/20",
    check: "text-indigo-300",
    card: "hover:border-indigo-400/30",
  },
} as const;

export async function ValuesDetail() {
  const m = (await getMessages(about)).values;
  return (
    <section className="py-20 sm:py-28" aria-labelledby="werte-heading">
      <Container>
        <SectionHeading
          eyebrow={m.eyebrow}
          title={<span id="werte-heading">{m.title}</span>}
          description={m.description}
        />
        <ul className="mt-12 grid gap-6 lg:grid-cols-3">
          {m.items.map((v, i) => {
            const { icon: Icon, accent } = visuals[i]!;
            const a = accentClass[accent];
            return (
              <li key={v.title} className="flex">
                <Card
                  className={`flex w-full flex-col p-7 transition-colors sm:p-8 ${a.card}`}
                >
                  <span
                    className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ring-1 ring-inset ${a.icon}`}
                  >
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <p className="mt-6 font-mono text-xs text-zinc-500">
                    0{i + 1}
                  </p>
                  <h3 className="mt-1 text-xl font-semibold tracking-tight text-white">
                    {v.title}
                  </h3>
                  <p className="mt-3 text-sm font-medium italic leading-relaxed text-zinc-300">
                    {v.claim}
                  </p>
                  <p className="mt-4 leading-relaxed text-zinc-400">{v.body}</p>
                  <ul className="mt-6 space-y-2.5 border-t border-zinc-800 pt-6 text-sm text-zinc-300">
                    {v.points.map((p) => (
                      <li key={p} className="flex gap-2.5">
                        <Check
                          className={`mt-0.5 h-4 w-4 shrink-0 ${a.check}`}
                          aria-hidden
                        />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}
