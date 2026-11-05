import { Server, Wrench } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Container, SectionHeading } from "@/components/ui/section";
import { about } from "@/i18n/about";
import { getMessages, getSite } from "@/i18n/server";
import { site as group } from "@/lib/site";
import { SITES } from "@/lib/sites";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0]!.toUpperCase())
    .slice(0, 2)
    .join("");
}

/** vylaris.eu: Leitungsvorstellung. vylaris.de/.net: neutrale Ansprechpartner-Karte mit Hinweis auf den zentralen Betrieb. */
export async function Leadership() {
  const site = await getSite();
  const m = (await getMessages(about)).leadership;
  const isEu = site.key === "eu";
  const leader = site.leader;
  const eu = SITES.eu;

  return (
    <section
      className="border-t border-zinc-900 py-20 sm:py-28"
      aria-labelledby="leitung-heading"
    >
      <Container>
        <SectionHeading
          eyebrow={isEu ? m.eyebrow : m.contactEyebrow}
          title={
            <span id="leitung-heading">
              {isEu ? m.title(site.name) : m.contactTitle(site.name)}
            </span>
          }
          description={isEu ? m.description : m.contactDescription}
        />
        <Card className="relative mt-12 overflow-hidden p-7 sm:p-10">
          <div
            className="bg-glow pointer-events-none absolute inset-0 opacity-60"
            aria-hidden
          />
          <div className="relative flex flex-col gap-8 sm:flex-row sm:items-start">
            <div
              className="flex h-24 w-24 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-400/20 to-indigo-400/20 text-3xl font-semibold tracking-tight text-white ring-1 ring-inset ring-zinc-700"
              role="img"
              aria-label={m.initialsOf(leader.name)}
            >
              {initials(leader.name)}
            </div>
            <div className="min-w-0">
              <h3 className="text-2xl font-semibold tracking-tight text-white">
                {leader.name}
              </h3>
              {isEu ? (
                <>
                  <p className="mt-1 text-emerald-400">{group.leader.role}</p>
                  <p className="mt-1 text-sm text-zinc-500">{leader.company}</p>
                  <p className="mt-5 max-w-2xl leading-relaxed text-zinc-400">
                    {m.bio(leader.name, site.name)}
                  </p>
                  <ul className="mt-6 flex flex-wrap gap-3 text-sm text-zinc-300">
                    <li className="inline-flex items-center gap-2 rounded-full bg-zinc-800/70 px-3 py-1.5 ring-1 ring-inset ring-zinc-700">
                      <Server
                        className="h-4 w-4 text-emerald-400"
                        aria-hidden
                      />
                      {m.skills.hosting}
                    </li>
                    <li className="inline-flex items-center gap-2 rounded-full bg-zinc-800/70 px-3 py-1.5 ring-1 ring-inset ring-zinc-700">
                      <Wrench className="h-4 w-4 text-indigo-300" aria-hidden />
                      {m.skills.it}
                    </li>
                  </ul>
                </>
              ) : (
                <>
                  <p className="mt-1 text-emerald-400">
                    {site.key === "net"
                      ? m.roleResponsible(site.name)
                      : m.roleContact(site.name)}
                  </p>
                  {leader.company && (
                    <p className="mt-1 text-sm text-zinc-500">
                      {leader.company}
                    </p>
                  )}
                  <p className="mt-5 max-w-2xl leading-relaxed text-zinc-400">
                    {m.centralNote(eu.name, eu.domain)}
                  </p>
                </>
              )}
            </div>
          </div>
        </Card>
      </Container>
    </section>
  );
}
