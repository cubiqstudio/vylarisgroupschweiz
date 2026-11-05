import { Card } from "@/components/ui/card";
import { Container, SectionHeading } from "@/components/ui/section";
import { about } from "@/i18n/about";
import { getMessages } from "@/i18n/server";
import { site } from "@/lib/site";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0]!.toUpperCase())
    .slice(0, 2)
    .join("");
}

/** Vorstand des Vereins: Name, Funktion und Berufsstand aus dem Stammprofil (src/lib/sites.ts). */
export async function Leadership() {
  const m = (await getMessages(about)).board;

  return (
    <section
      className="border-t border-zinc-900 py-20 sm:py-28"
      aria-labelledby="vorstand-heading"
    >
      <Container>
        <SectionHeading
          eyebrow={m.eyebrow}
          title={<span id="vorstand-heading">{m.title}</span>}
          description={m.description}
        />
        <ul className="mt-12 grid gap-6 md:grid-cols-3">
          {site.board.map((person) => (
            <li key={person.name} className="flex">
              <Card className="relative w-full overflow-hidden p-7 sm:p-8">
                <div
                  className="bg-glow pointer-events-none absolute inset-0 opacity-60"
                  aria-hidden
                />
                <div className="relative">
                  <div
                    className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-400/20 to-indigo-400/20 text-2xl font-semibold tracking-tight text-white ring-1 ring-inset ring-zinc-700"
                    role="img"
                    aria-label={m.initialsOf(person.name)}
                  >
                    {initials(person.name)}
                  </div>
                  <h3 className="mt-6 text-xl font-semibold tracking-tight text-white">
                    {person.name}
                  </h3>
                  <p className="mt-1 text-emerald-400">{person.role}</p>
                  <p className="mt-1 text-sm text-zinc-500">{person.occupation}</p>
                </div>
              </Card>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-sm text-zinc-500">
          {m.members(site.members, site.board.length)} {m.training}
        </p>
      </Container>
    </section>
  );
}
