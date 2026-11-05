import Link from "next/link";
import { ArrowRight, Building2, ExternalLink, Users } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container, SectionHeading } from "@/components/ui/section";
import { site } from "@/lib/site";
import { getMessages } from "@/i18n/server";
import { home } from "@/i18n/home";

function Connector({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-2 lg:px-2 lg:py-0" aria-hidden>
      {/* Mobile: vertikal */}
      <div className="flex flex-col items-center lg:hidden">
        <span className="h-8 w-px bg-gradient-to-b from-emerald-400/60 to-indigo-400/60" />
        <HandBadge label={label} />
        <span className="h-8 w-px bg-gradient-to-b from-indigo-400/60 to-emerald-400/60" />
      </div>
      {/* Desktop: horizontal */}
      <div className="hidden items-center lg:flex">
        <span className="h-px w-8 bg-gradient-to-r from-emerald-400/60 to-indigo-400/60" />
        <HandBadge label={label} />
        <span className="h-px w-8 bg-gradient-to-r from-indigo-400/60 to-emerald-400/60" />
      </div>
    </div>
  );
}

function HandBadge({ label }: { label: string }) {
  return (
    <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-surface shadow-lg shadow-emerald-500/10">
      <svg viewBox="0 0 48 48" className="h-8 w-8" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 28c4-1 7-4 10-7 3-3 6-3 9 0l6 6" stroke="#2a66d9" />
        <path d="M42 20c-4 1-7 4-10 7-3 3-6 3-9 0l-6-6" stroke="#4256e0" />
        <path d="M14 36l4 4M20 38l3 3M26 36l3 3" stroke="#8a94a6" opacity="0.8" />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}

export async function Alliance() {
  const m = (await getMessages(home)).alliance;
  return (
    <section id="allianz" className="relative border-y border-zinc-800 bg-zinc-900/40 py-20 sm:py-28" aria-labelledby="allianz-heading">
      <Container>
        <SectionHeading
          align="center"
          eyebrow={m.eyebrow}
          title={<span id="allianz-heading">{m.title}</span>}
          description={m.description}
        />

        <div className="mt-14 grid items-stretch gap-0 lg:grid-cols-[1fr_auto_1fr]">
          <Card className="border-emerald-400/30 p-7 sm:p-8">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-400 ring-1 ring-inset ring-emerald-400/20">
                <Building2 className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h3 className="text-lg font-semibold tracking-tight text-white">{site.name}</h3>
                <p className="text-sm text-zinc-500">{m.euRole}</p>
              </div>
            </div>
            <dl className="mt-6 space-y-4 text-sm">
              <div>
                <dt className="font-medium text-zinc-200">{m.leadership}</dt>
                <dd className="mt-1 text-zinc-400">{m.leaderText(site.leader.name, site.leader.company)}</dd>
              </div>
              <div>
                <dt className="font-medium text-zinc-200">{m.task}</dt>
                <dd className="mt-1 leading-relaxed text-zinc-400">
                  {m.taskText}
                </dd>
              </div>
            </dl>
          </Card>

          <Connector label={m.handBadge} />

          <Card className="border-indigo-400/30 p-7 sm:p-8">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-400/10 text-indigo-300 ring-1 ring-inset ring-indigo-400/20">
                <Users className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h3 className="text-lg font-semibold tracking-tight text-white">{m.partnerName}</h3>
                <p className="text-sm text-zinc-500">{m.partnerRole(site.partner.domain)}</p>
              </div>
            </div>
            <dl className="mt-6 space-y-4 text-sm">
              <div>
                <dt className="font-medium text-zinc-200">{m.association}</dt>
                <dd className="mt-1 text-zinc-400">
                  {m.associationText(site.partner.members, site.partner.board)}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-zinc-200">{m.origin}</dt>
                <dd className="mt-1 leading-relaxed text-zinc-400">
                  {m.originText}
                </dd>
              </div>
            </dl>
          </Card>
        </div>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <ButtonLink href={site.partner.url} external variant="secondary">
            {m.visit(site.partner.domain)}
            <ExternalLink className="h-4 w-4" aria-hidden />
            <span className="sr-only">{m.newTab}</span>
          </ButtonLink>
          <Link
            href="/allianz"
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-emerald-400 transition-colors hover:text-emerald-300"
          >
            {m.more}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </Container>
    </section>
  );
}
