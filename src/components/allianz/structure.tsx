import {
  Building2,
  Database,
  ExternalLink,
  Globe,
  Handshake,
  MapPin,
  Plus,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Container, SectionHeading } from "@/components/ui/section";
import { branches, dataCenter, europe, units } from "@/lib/alliance";
import { allianz } from "@/i18n/allianz";
import { getMessages } from "@/i18n/server";
import { site } from "@/lib/site";

const LINE = "bg-zinc-700";

function HeadIcon({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "eu" | "ch";
}) {
  return (
    <span
      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${
        tone === "eu"
          ? "bg-emerald-400/10 text-emerald-400 ring-emerald-400/20"
          : "bg-indigo-400/10 text-indigo-300 ring-indigo-400/20"
      }`}
    >
      {children}
    </span>
  );
}

function Fact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-sm font-semibold text-white">{label}</dt>
      <dd className="mt-1 text-sm leading-relaxed text-zinc-400">{children}</dd>
    </div>
  );
}

/** Oben: der Schweizer Ursprungsverein (diese Website) und VylarisGroupEurope als eigenständiger Partner; darunter wachsen die Niederlassungen aus VylarisGroupEurope heraus. */
export async function AllianceStructure() {
  const all = await getMessages(allianz);
  const m = all.structure;
  const eu = europe;
  const planned = branches.filter((b) => b.status === "geplant");
  return (
    <section className="py-16 sm:py-24" aria-labelledby="struktur-heading">
      <Container>
        <SectionHeading
          align="center"
          eyebrow={m.eyebrow}
          title={<span id="struktur-heading">{m.title}</span>}
          description={m.description(eu.name)}
        />

        <div className="mt-14">
          {/* Ebene 1: Verein (diese Website) + Europa */}
          <div className="grid gap-6 md:grid-cols-[1fr_8rem_1fr] md:gap-0">
            <div className="relative">
              <div className="h-full rounded-2xl border border-zinc-800 bg-surface p-6 shadow-sm shadow-slate-900/5 sm:p-8">
                <div className="flex items-center gap-3">
                  <HeadIcon tone="ch">
                    <Users className="h-5 w-5" aria-hidden />
                  </HeadIcon>
                  <div>
                    <h3 className="text-lg font-semibold tracking-tight text-white">
                      {site.name}
                    </h3>
                    <p className="text-sm text-zinc-500">
                      {m.association} · {site.domain}
                    </p>
                  </div>
                </div>
                <dl className="mt-6 space-y-4">
                  <Fact label={m.associationFact}>
                    {m.members(site.members, site.board.length)}
                  </Fact>
                  <Fact label={m.lead}>
                    {m.associationLead(site.leader.name, site.leader.role)}
                  </Fact>
                  <Fact label={m.origin}>{m.originText}</Fact>
                  <Fact label={m.contribution}>{m.contributionText}</Fact>
                </dl>
              </div>
            </div>

            <div
              className="relative hidden items-center justify-center md:flex"
              aria-hidden
            >
              <span className={`absolute inset-x-0 top-1/2 h-px ${LINE}`} />
              {/* Rückgrat: vom Handschlag nach unten zu VylarisData und VylarisSecurity */}
              <span
                className={`absolute left-1/2 top-1/2 w-px ${LINE}`}
                style={{ height: "calc(50% + 1.75rem)" }}
              />
              <span className="relative inline-flex h-14 w-14 items-center justify-center rounded-full border border-zinc-800 bg-surface text-emerald-400 shadow-sm">
                <Handshake className="h-6 w-6" />
              </span>
            </div>

            <div className="relative">
              <div className="h-full rounded-2xl border border-zinc-800 bg-surface p-6 shadow-sm shadow-slate-900/5 sm:p-8">
                <div className="flex items-center gap-3">
                  <HeadIcon tone="eu">
                    <Building2 className="h-5 w-5" aria-hidden />
                  </HeadIcon>
                  <div>
                    <h3 className="text-lg font-semibold tracking-tight text-white">
                      {eu.name}
                    </h3>
                    <p className="text-sm text-zinc-500">
                      {m.euSubtitle} · {eu.domain}
                    </p>
                  </div>
                </div>
                <dl className="mt-6 space-y-4">
                  <Fact label={m.lead}>
                    {m.euLead(eu.leader.name, eu.leader.company)}
                  </Fact>
                  <Fact label={m.task}>{m.euTask}</Fact>
                  <Fact label={m.branchesLabel}>{m.euBranches(eu.name)}</Fact>
                </dl>
              </div>
            </div>
          </div>

          {/* Ebene 2: gemeinsame Einheiten (VylarisData, VylarisSecurity) – hängen an Europa und der Allianz */}
          <div className="relative md:pt-14">
            <span
              aria-hidden
              className={`mx-auto mb-5 mt-5 block h-8 w-px md:hidden ${LINE}`}
            />
            <div className="relative mx-auto max-w-4xl">
              <span
                aria-hidden
                className={`absolute top-[-1.75rem] hidden h-px md:block ${LINE}`}
                style={{ left: "calc((100% - 1.25rem) / 4)", right: "calc((100% - 1.25rem) / 4)" }}
              />
              {/* Rückgrat läuft durch die Lücke zwischen den Karten weiter nach unten */}
              <span
                aria-hidden
                className={`absolute left-1/2 top-[-1.75rem] hidden w-px md:block ${LINE}`}
                style={{ bottom: "-1.75rem" }}
              />
              <p className="mb-5 text-center text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 md:absolute md:left-1/2 md:top-[-1.75rem] md:z-10 md:mb-0 md:-translate-x-1/2 md:-translate-y-1/2 md:whitespace-nowrap md:rounded-full md:border md:border-zinc-800 md:bg-zinc-950 md:px-4 md:py-1.5">
                {m.unitsOf}
              </p>
              <ul className="grid gap-5 md:grid-cols-2">
                {units.map((u) => {
                  const t = all.units[u.name]!;
                  const Icon = u.name === "VylarisData" ? Database : ShieldCheck;
                  return (
                    <li
                      key={u.name}
                      className="relative md:before:absolute md:before:-top-7 md:before:left-1/2 md:before:h-7 md:before:w-px md:before:bg-zinc-700"
                    >
                      <div
                        className={`h-full rounded-2xl border bg-surface p-6 shadow-sm shadow-slate-900/5 ${u.status === "geplant" ? "border-dashed border-emerald-400/40" : "border-zinc-800"}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-400/10 text-indigo-300 ring-1 ring-inset ring-indigo-400/20">
                            <Icon className="h-5 w-5" aria-hidden />
                          </span>
                          <span
                            className={
                              u.status === "geplant"
                                ? "rounded-full bg-amber-400/10 px-2.5 py-1 text-xs font-medium text-amber-300 ring-1 ring-inset ring-amber-400/30"
                                : "rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-400 ring-1 ring-inset ring-emerald-400/30"
                            }
                          >
                            {u.status === "geplant" ? m.statusPlanned : m.statusActive}
                          </span>
                        </div>
                        <h3 className="mt-4 text-lg font-semibold tracking-tight text-white">{u.name}</h3>
                        <p className="text-sm text-zinc-500">
                          {t.subtitle}
                          {u.name === "VylarisData" && <> · {m.brandOf("CircleUpWilms")}</>}
                        </p>
                        <p className="mt-3 text-sm leading-relaxed text-zinc-400">{t.text}</p>
                        {u.name === "VylarisData" && (
                          <ul className="mt-4 flex flex-wrap gap-2 text-xs font-medium text-zinc-300">
                            <li className="rounded-full bg-zinc-900/60 px-2.5 py-1 ring-1 ring-inset ring-zinc-800">{m.servers(dataCenter.servers)}</li>
                            <li className="rounded-full bg-zinc-900/60 px-2.5 py-1 ring-1 ring-inset ring-zinc-800">{m.ssd(dataCenter.ssdTb)}</li>
                            <li className="rounded-full bg-zinc-900/60 px-2.5 py-1 ring-1 ring-inset ring-zinc-800">{m.goal}</li>
                          </ul>
                        )}
                        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
                          {u.domain ? (
                            <a
                              href={`https://${u.domain}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 font-medium text-emerald-400 underline-offset-4 transition-colors hover:text-emerald-300 hover:underline"
                            >
                              <Globe className="h-3.5 w-3.5" aria-hidden />
                              {u.domain}
                              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                              <span className="sr-only">{m.newTab}</span>
                            </a>
                          ) : null}
                          {u.name === "VylarisData" && (
                            <a href="#rechenzentrum" className="font-medium text-zinc-300 underline-offset-4 hover:text-white hover:underline">
                              {m.unitMore}
                            </a>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          {/* Ebene 2: Niederlassungen (Schneeball) */}
          <div className="relative md:pt-14">
            <span
              aria-hidden
              className={`mx-auto mb-5 mt-5 block h-8 w-px md:hidden ${LINE}`}
            />
            <span
              aria-hidden
              className={`absolute top-7 hidden h-px md:block ${LINE}`}
              style={{
                left: "calc((100% - 2.5rem) / 6)",
                right: "calc((100% - 2.5rem) / 6)",
              }}
            />
            <p className="mb-5 text-center text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 md:absolute md:left-1/2 md:top-7 md:z-10 md:mb-0 md:-translate-x-1/2 md:-translate-y-1/2 md:whitespace-nowrap md:rounded-full md:border md:border-zinc-800 md:bg-zinc-950 md:px-4 md:py-1.5">
              {m.branchesOf(eu.name)}
            </p>
            <ul className="grid gap-5 md:grid-cols-3">
              {branches.map((b) => {
                const t = all.branches[b.name];
                return (
                  <li
                    key={b.name}
                    className="relative md:before:absolute md:before:-top-7 md:before:left-1/2 md:before:h-7 md:before:w-px md:before:bg-zinc-700"
                  >
                    <div
                      className={`h-full rounded-2xl border bg-surface p-6 shadow-sm shadow-slate-900/5 ${b.status === "geplant" ? "border-dashed border-emerald-400/40" : "border-zinc-800"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-400 ring-1 ring-inset ring-emerald-400/20">
                          <MapPin className="h-5 w-5" aria-hidden />
                        </span>
                        <span
                          className={
                            b.status === "geplant"
                              ? "rounded-full bg-amber-400/10 px-2.5 py-1 text-xs font-medium text-amber-300 ring-1 ring-inset ring-amber-400/30"
                              : "rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-400 ring-1 ring-inset ring-emerald-400/30"
                          }
                        >
                          {b.status === "geplant"
                            ? m.statusPlanned
                            : m.statusActive}
                        </span>
                      </div>
                      <h3 className="mt-4 text-lg font-semibold tracking-tight text-white">
                        {b.name}
                      </h3>
                      <p className="text-sm text-zinc-500">
                        {t?.region ?? b.region}
                      </p>
                      {b.lead && (
                        <p className="mt-4 flex items-center gap-2 text-sm text-zinc-300">
                          <UserRound
                            className="h-4 w-4 text-zinc-500"
                            aria-hidden
                          />
                          <span>
                            <span className="text-zinc-500">{m.leadLabel}</span>{" "}
                            <span className="font-medium text-white">
                              {b.lead}
                            </span>
                          </span>
                        </p>
                      )}
                      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                        {t?.text}
                      </p>
                      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
                        {b.status === "aktiv" ? (
                          <a
                            href={`https://${b.domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 font-medium text-emerald-400 underline-offset-4 transition-colors hover:text-emerald-300 hover:underline"
                          >
                            <Globe className="h-3.5 w-3.5" aria-hidden />
                            {b.domain}
                            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                            <span className="sr-only">{m.newTab}</span>
                          </a>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 font-medium text-zinc-400">
                            <Globe className="h-3.5 w-3.5" aria-hidden />
                            {b.domain}
                            <span className="font-normal text-zinc-500">
                              {m.notOnline}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="mx-auto mt-6 max-w-2xl text-center text-sm leading-relaxed text-zinc-500">
              {m.centralNote(eu.name, eu.domain, site.domain)}
              {planned.map((b) => (
                <span key={b.domain}> {m.plannedNote(b.domain)}</span>
              ))}
            </p>
            <div className="mt-6 flex flex-col items-center">
              <span
                aria-hidden
                className="h-6 w-px border-l border-dashed border-zinc-600"
              />
              <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-zinc-600 px-3.5 py-1.5 text-xs font-medium text-zinc-400">
                <Plus className="h-3.5 w-3.5" aria-hidden /> {m.more}
              </span>
            </div>
          </div>

          <div className="mt-12 flex justify-center">
            <ButtonLink href={eu.url} external variant="secondary">
              {m.visit(eu.domain)}
              <ExternalLink className="h-4 w-4" aria-hidden />
              <span className="sr-only">{m.newTab}</span>
            </ButtonLink>
          </div>
        </div>
      </Container>
    </section>
  );
}
