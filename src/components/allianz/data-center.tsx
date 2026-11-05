import { Activity, Boxes, Cable, Database, ExternalLink, HardDrive, ServerCog, ShieldCheck, type LucideIcon } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container, SectionHeading } from "@/components/ui/section";
import { dataCenter } from "@/lib/alliance";
import { allianz } from "@/i18n/allianz";
import { getMessages } from "@/i18n/server";

const STATE_STYLE: Record<string, string> = {
  ok: "bg-emerald-400/10 text-emerald-400 ring-emerald-400/30",
  building: "bg-sky-400/10 text-sky-300 ring-sky-400/30",
  maintenance: "bg-amber-400/10 text-amber-300 ring-amber-400/30",
  planned: "bg-zinc-500/10 text-zinc-400 ring-zinc-500/30",
};

const STAT_ICONS: LucideIcon[] = [ServerCog, HardDrive, Database, Cable];

/** Rechenzentrum von VylarisData: Kerneigenschaften, Bausteine mit Stand, Grundsätze und das Ökosystem (Bausteine: src/lib/alliance.ts). */
export async function DataCenter() {
  const all = await getMessages(allianz);
  const m = all.dataCenter;
  const e = all.ecosystem;
  return (
    <>
      <section id="rechenzentrum" className="scroll-mt-20 py-16 sm:py-24" aria-labelledby="rz-heading">
        <Container>
          <SectionHeading
            align="center"
            eyebrow={m.eyebrow}
            title={<span id="rz-heading">{m.title}</span>}
            description={m.description}
          />

          <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {m.stats.map((s, i) => {
              const Icon = STAT_ICONS[i]!;
              return (
                <li key={s.label}>
                  <Card className="h-full p-6">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-400 ring-1 ring-inset ring-emerald-400/20">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <p className="mt-4 text-2xl font-semibold tracking-tight text-white">{s.value}</p>
                    <p className="text-sm font-medium text-zinc-300">{s.label}</p>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-400">{s.text}</p>
                  </Card>
                </li>
              );
            })}
          </ul>

          <div className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <Card className="p-6 sm:p-8">
              <h3 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-white">
                <Activity className="h-5 w-5 text-emerald-400" aria-hidden />
                {m.componentsTitle}
              </h3>
              <ul className="mt-5 divide-y divide-zinc-800">
                {dataCenter.components.map((c) => {
                  const t = m.components[c.id]!;
                  return (
                    <li key={c.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5 py-3.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white">{t.name}</p>
                        <p className="mt-0.5 text-sm leading-relaxed text-zinc-400">{t.text}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${STATE_STYLE[c.state]}`}>
                        {m.states[c.state]}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-4 text-xs text-zinc-500">{m.componentsNote}</p>
            </Card>

            <div className="space-y-6">
              <Card className="p-6 sm:p-8">
                <h3 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-white">
                  <ShieldCheck className="h-5 w-5 text-emerald-400" aria-hidden />
                  {m.principlesTitle}
                </h3>
                <ul className="mt-5 space-y-4">
                  {m.principles.map((p) => (
                    <li key={p.title}>
                      <p className="text-sm font-semibold text-white">{p.title}</p>
                      <p className="mt-0.5 text-sm leading-relaxed text-zinc-400">{p.text}</p>
                    </li>
                  ))}
                </ul>
              </Card>
              <div className="flex flex-wrap gap-3">
                <ButtonLink href={dataCenter.url} external>
                  {m.visit}
                  <ExternalLink className="h-4 w-4" aria-hidden />
                  <span className="sr-only">{m.newTab}</span>
                </ButtonLink>
                <ButtonLink href={dataCenter.statusUrl} external variant="secondary">
                  {m.status}
                  <ExternalLink className="h-4 w-4" aria-hidden />
                  <span className="sr-only">{m.newTab}</span>
                </ButtonLink>
              </div>
              <p className="text-xs leading-relaxed text-zinc-500">{m.contactNote}</p>
            </div>
          </div>
        </Container>
      </section>

      <section className="border-y border-zinc-900 bg-zinc-900/20 py-16 sm:py-24" aria-labelledby="oekosystem-heading">
        <Container>
          <SectionHeading
            align="center"
            eyebrow={e.eyebrow}
            title={<span id="oekosystem-heading">{e.title}</span>}
            description={e.description}
          />
          <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
            {[...e.items, e.security, e.space].map((it, i) => {
              const upcoming = i >= e.items.length;
              return (
                <li key={it.name}>
                  <Card className={`h-full p-5 ${upcoming ? "border-dashed" : ""}`}>
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400">
                      <Boxes className="h-3.5 w-3.5" aria-hidden />
                      {it.state}
                    </span>
                    <h3 className="mt-3 text-base font-semibold text-white">{it.name}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{it.text}</p>
                  </Card>
                </li>
              );
            })}
          </ul>
        </Container>
      </section>
    </>
  );
}
