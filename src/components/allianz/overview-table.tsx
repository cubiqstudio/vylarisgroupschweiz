import { Container, SectionHeading } from "@/components/ui/section";
import { branches, europe, units } from "@/lib/alliance";
import { allianz } from "@/i18n/allianz";
import { getMessages } from "@/i18n/server";
import { site } from "@/lib/site";

export async function OverviewTable() {
  const all = await getMessages(allianz);
  const m = all.overview;
  const eu = europe;
  const rows = [
    {
      name: site.name,
      form: m.association,
      region: `${m.switzerland} · ${site.domain}`,
      role: m.associationRole,
      status: m.established,
    },
    {
      name: eu.name,
      form: m.company,
      region: `${m.eu} · ${eu.domain}`,
      role: m.euRole(eu.leader.name),
      status: m.established,
    },
    ...units.map((u) => {
      const t = all.units[u.name]!;
      return {
        name: u.name,
        form: t.form,
        region: u.domain ? `${t.region} · ${u.domain}` : t.region,
        role: t.role,
        status: u.status === "geplant" ? m.planned : m.established,
      };
    }),
    ...branches.map((b) => {
      const t = all.branches[b.name];
      const role = t?.role ?? "";
      return {
        name: b.name,
        form: m.branch,
        region: `${t?.region ?? b.region} · ${b.domain}`,
        role: b.lead ? m.withLead(role, b.lead) : role,
        status: b.status === "geplant" ? m.planned : m.established,
      };
    }),
  ];
  return (
    <section
      className="border-y border-zinc-900 bg-zinc-900/20 py-16 sm:py-24"
      aria-labelledby="aufteilung-heading"
    >
      <Container>
        <SectionHeading
          align="center"
          eyebrow={m.eyebrow}
          title={<span id="aufteilung-heading">{m.title}</span>}
          description={m.description}
        />
        <div className="mt-12 overflow-x-auto rounded-2xl border border-zinc-800 bg-surface">
          <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
            <caption className="sr-only">{m.caption}</caption>
            <thead>
              <tr className="border-b border-zinc-800 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                <th scope="col" className="px-5 py-4">
                  {m.columns.name}
                </th>
                <th scope="col" className="px-5 py-4">
                  {m.columns.form}
                </th>
                <th scope="col" className="px-5 py-4">
                  {m.columns.region}
                </th>
                <th scope="col" className="px-5 py-4">
                  {m.columns.role}
                </th>
                <th scope="col" className="px-5 py-4">
                  {m.columns.status}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80">
              {rows.map((r) => (
                <tr key={r.name}>
                  <th
                    scope="row"
                    className="px-5 py-4 font-semibold text-white"
                  >
                    {r.name}
                  </th>
                  <td className="px-5 py-4 text-zinc-300">{r.form}</td>
                  <td className="px-5 py-4 text-zinc-300">{r.region}</td>
                  <td className="px-5 py-4 leading-relaxed text-zinc-300">
                    {r.role}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-zinc-300">
                    {r.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Container>
    </section>
  );
}
