import { Building2, ExternalLink, Users } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container, SectionHeading } from "@/components/ui/section";
import { allianz } from "@/i18n/allianz";
import { getMessages } from "@/i18n/server";
import { europe as eu } from "@/lib/alliance";
import { site } from "@/lib/site";

export async function AllianceRoles() {
  const m = (await getMessages(allianz)).roles;
  const partnerName = site.name;
  const rows = m.rows({
    members: site.members,
    board: site.board.length,
    leader: eu.leader.name,
    company: eu.leader.company,
    domain: site.domain,
    euDomain: eu.domain,
  });
  return (
    <section
      id="allianz"
      className="scroll-mt-20 border-y border-zinc-900 bg-zinc-900/20 py-20 sm:py-28"
      aria-labelledby="allianz-heading"
    >
      <Container>
        <SectionHeading
          align="center"
          eyebrow={m.eyebrow}
          title={<span id="allianz-heading">{m.title}</span>}
          description={m.description}
        />

        {/* Ab md: echte Tabelle */}
        <div className="mt-14 hidden overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50 md:block">
          <table className="w-full table-fixed border-collapse text-left text-sm">
            <caption className="sr-only">
              {m.caption(partnerName, eu.name)}
            </caption>
            <colgroup>
              <col className="w-[18%]" />
              <col className="w-[41%]" />
              <col className="w-[41%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-zinc-800">
                <th scope="col" className="px-5 py-5">
                  <span className="sr-only">{m.aspect}</span>
                </th>
                <th scope="col" className="px-5 py-5 align-top">
                  <span className="flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-400/10 text-indigo-300 ring-1 ring-inset ring-indigo-400/20">
                      <Users className="h-4 w-4" aria-hidden />
                    </span>
                    <span>
                      <span className="block text-base font-semibold tracking-tight text-white">
                        {partnerName}
                      </span>
                      <span className="block text-xs font-normal text-zinc-500">
                        {m.association}
                      </span>
                    </span>
                  </span>
                </th>
                <th scope="col" className="px-5 py-5 align-top">
                  <span className="flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-400 ring-1 ring-inset ring-emerald-400/20">
                      <Building2 className="h-4 w-4" aria-hidden />
                    </span>
                    <span>
                      <span className="block text-base font-semibold tracking-tight text-white">
                        {eu.name}
                      </span>
                      <span className="block text-xs font-normal text-zinc-500">
                        {m.company}
                      </span>
                    </span>
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80">
              {rows.map((r) => (
                <tr key={r.label}>
                  <th
                    scope="row"
                    className="px-5 py-4 align-top text-xs font-semibold uppercase tracking-wider text-zinc-500"
                  >
                    {r.label}
                  </th>
                  <td className="px-5 py-4 align-top leading-relaxed text-zinc-300">
                    {r.verein}
                  </td>
                  <td className="px-5 py-4 align-top leading-relaxed text-zinc-300">
                    {r.firma}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobil: zwei Karten */}
        <div className="mt-12 grid gap-5 md:hidden">
          <Card className="border-indigo-400/20 p-6">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-400/10 text-indigo-300 ring-1 ring-inset ring-indigo-400/20">
                <Users className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h3 className="text-lg font-semibold tracking-tight text-white">
                  {partnerName}
                </h3>
                <p className="text-sm text-zinc-500">{m.association}</p>
              </div>
            </div>
            <dl className="mt-5 space-y-4 text-sm">
              {rows.map((r) => (
                <div key={r.label}>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    {r.label}
                  </dt>
                  <dd className="mt-1 leading-relaxed text-zinc-300">
                    {r.verein}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card className="border-emerald-400/20 p-6">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-400 ring-1 ring-inset ring-emerald-400/20">
                <Building2 className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h3 className="text-lg font-semibold tracking-tight text-white">
                  {eu.name}
                </h3>
                <p className="text-sm text-zinc-500">{m.company}</p>
              </div>
            </div>
            <dl className="mt-5 space-y-4 text-sm">
              {rows.map((r) => (
                <div key={r.label}>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    {r.label}
                  </dt>
                  <dd className="mt-1 leading-relaxed text-zinc-300">
                    {r.firma}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>

        <p className="mx-auto mt-10 max-w-2xl text-center leading-relaxed text-zinc-400">
          {m.outro(eu.name)}
        </p>

        <div className="mt-8 flex justify-center">
          <ButtonLink href={eu.url} external variant="secondary">
            {m.visit(eu.domain)}
            <ExternalLink className="h-4 w-4" aria-hidden />
            <span className="sr-only">{m.newTab}</span>
          </ButtonLink>
        </div>
      </Container>
    </section>
  );
}
