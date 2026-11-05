import { Rocket, ShieldCheck, Smile, Users, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Container, SectionHeading } from "@/components/ui/section";
import { about } from "@/i18n/about";
import { getMessages } from "@/i18n/server";

const visuals: { icon: LucideIcon; accent: "emerald" | "indigo" }[] = [
  { icon: Users, accent: "emerald" },
  { icon: Smile, accent: "indigo" },
  { icon: ShieldCheck, accent: "emerald" },
  { icon: Rocket, accent: "indigo" },
];

const accentClass = {
  emerald: {
    icon: "bg-emerald-400/10 text-emerald-400 ring-emerald-400/20",
    card: "hover:border-emerald-400/30",
  },
  indigo: {
    icon: "bg-indigo-400/10 text-indigo-300 ring-indigo-400/20",
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
        <ul className="mt-12 grid gap-6 md:grid-cols-2">
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
                  <p className="mt-4 leading-relaxed text-zinc-400">{v.text}</p>
                </Card>
              </li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}
