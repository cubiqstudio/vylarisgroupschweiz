import { Container } from "@/components/ui/section";
import { SITES } from "@/lib/sites";
import { getMessages, getSite } from "@/i18n/server";
import { home } from "@/i18n/home";

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const AVATAR = "flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-indigo-400 text-sm font-semibold text-surface";

/**
 * vylaris.eu: Statement der Leitung (Lucas Wilms). Alle anderen Seiten: neutrale Ansprechpartner-Karte mit Name, Rolle
 * und Hinweis auf den zentralen technischen Betrieb durch VylarisGroupEurope – ohne Zitat.
 */
export async function LeadershipQuote() {
  const site = await getSite();
  const m = (await getMessages(home)).leadership;

  if (site.key !== "eu") {
    const operator = SITES.eu;
    return (
      <section className="py-20 sm:py-28" aria-labelledby="statement-heading">
        <Container>
          <div className="rounded-3xl border border-zinc-800 bg-surface px-6 py-12 shadow-sm shadow-slate-900/5 sm:px-14 sm:py-16">
            <h2 id="statement-heading" className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">
              {m.contactEyebrow}
            </h2>
            <div className="mx-auto mt-8 flex max-w-3xl flex-col items-center gap-6 text-center">
              <span className={AVATAR} aria-hidden>
                {initials(site.leader.name)}
              </span>
              <p>
                <span className="block text-2xl font-semibold tracking-tight text-white sm:text-3xl">{site.leader.name}</span>
                <span className="mt-1 block text-sm text-zinc-400">{m.contactRole(site.name)}</span>
              </p>
              <p className="max-w-xl text-sm leading-relaxed text-zinc-400">
                {m.operationNote}{" "}
                <a href={`https://${operator.domain}`} className="text-emerald-400 underline underline-offset-4 hover:text-emerald-300">
                  {operator.name} ({operator.domain})
                </a>
                .
              </p>
            </div>
          </div>
        </Container>
      </section>
    );
  }

  return (
    <section className="py-20 sm:py-28" aria-labelledby="statement-heading">
      <Container>
        <div className="rounded-3xl border border-zinc-800 bg-surface px-6 py-12 shadow-sm shadow-slate-900/5 sm:px-14 sm:py-16">
          <h2 id="statement-heading" className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">
            {m.eyebrow}
          </h2>
          <figure className="mx-auto mt-8 max-w-3xl">
            <svg viewBox="0 0 48 36" className="mx-auto h-9 w-12 text-emerald-400/40" fill="currentColor" aria-hidden>
              <path d="M0 36V21.6C0 9.2 6.4 2.1 18 0l2 5.4C13.6 7 10.4 10.6 10 15.6h8V36H0Zm27.6 0V21.6C27.6 9.2 34 2.1 45.6 0l2 5.4c-6.4 1.6-9.6 5.2-10 10.2h8V36H27.6Z" />
            </svg>
            <blockquote className="mt-6 text-balance text-center text-2xl font-medium leading-snug tracking-tight text-white sm:text-3xl">
              <p>{m.quote}</p>
            </blockquote>
            <figcaption className="mt-10 flex items-center justify-center gap-4">
              <span className={AVATAR} aria-hidden>
                {initials(site.leader.name)}
              </span>
              <span className="text-left">
                <span className="block font-semibold text-white">{site.leader.name}</span>
                <span className="block text-sm text-zinc-400">
                  {m.role(site.name)} | {site.leader.company}
                </span>
              </span>
            </figcaption>
          </figure>
        </div>
      </Container>
    </section>
  );
}
