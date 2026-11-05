import type { Metadata } from "next";
import { Download, FileText, ScrollText } from "lucide-react";
import { ButtonLink, buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container, PageHeader } from "@/components/ui/section";
import { getMessages } from "@/i18n/server";
import { verein } from "@/i18n/verein";
import { vereinDokumente } from "@/i18n/verein-dokumente";
import { formatDateCh } from "@/lib/verein/dates";
import { listPublicStatutes } from "@/lib/verein/documents-data";
import { formatFileSize } from "@/lib/verein/documents-lib";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const m = (await getMessages(verein)).public.statutes;
  return { title: m.metaTitle, description: m.metaDescription, alternates: { canonical: "/verein/statuten" } };
}

/** Öffentliche Statuten: zeigt die als öffentlich markierten, nicht archivierten Dokumente der Kategorie «Statuten» zum Herunterladen. */
export default async function StatutesPage() {
  const head = (await getMessages(verein)).public.statutes;
  const m = (await getMessages(vereinDokumente)).statutes;
  const docs = await listPublicStatutes();
  const [current, ...others] = docs;

  return (
    <>
      <PageHeader eyebrow={head.eyebrow} title={head.heading} description={m.intro} />
      <Container className="py-12">
        <div className="mx-auto max-w-3xl space-y-8">
          {!current ? (
            <Card className="flex flex-col items-center px-6 py-14 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800/80 text-zinc-400 ring-1 ring-inset ring-zinc-700">
                <ScrollText className="h-5 w-5" aria-hidden />
              </span>
              <h2 className="mt-4 text-lg font-semibold text-white">{m.emptyTitle}</h2>
              <p className="mt-1.5 max-w-md text-sm text-zinc-400">{m.emptyText}</p>
              <ButtonLink href="/contact" variant="secondary" className="mt-5">
                {m.contact}
              </ButtonLink>
            </Card>
          ) : (
            <>
              <Card className="p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="flex items-center gap-2 text-xl font-semibold text-white">
                      <FileText className="h-5 w-5 shrink-0 text-emerald-400" aria-hidden />
                      <span className="min-w-0 [overflow-wrap:anywhere]">{current.title}</span>
                    </h2>
                    {current.description && <p className="mt-2 text-sm leading-relaxed text-zinc-400">{current.description}</p>}
                    <p className="mt-3 text-xs text-zinc-500">
                      {m.updated(formatDateCh(current.updatedAt))} · {m.version(current.currentVersion)}
                      {current.versions[0] ? ` · ${formatFileSize(current.versions[0].sizeBytes)}` : ""}
                    </p>
                  </div>
                  <a href={`/api/documents/${encodeURIComponent(current.id)}/download`} download className={buttonClass("primary", "md", "shrink-0")}>
                    <Download className="h-4 w-4" aria-hidden />
                    {m.download}
                  </a>
                </div>
              </Card>

              {others.length > 0 && (
                <section aria-labelledby="statutes-others">
                  <h2 id="statutes-others" className="mb-3 text-base font-semibold text-white">
                    {m.otherTitle}
                  </h2>
                  <Card className="divide-y divide-zinc-800">
                    {others.map((d) => (
                      <a
                        key={d.id}
                        href={`/api/documents/${encodeURIComponent(d.id)}/download`}
                        download
                        className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 hover:bg-zinc-900/50"
                      >
                        <span className="min-w-0 [overflow-wrap:anywhere] font-medium text-white">{d.title}</span>
                        <span className="text-sm text-zinc-500">{m.updated(formatDateCh(d.updatedAt))}</span>
                      </a>
                    ))}
                  </Card>
                </section>
              )}
            </>
          )}
          <p className="text-xs leading-relaxed text-zinc-500">{m.note}</p>
        </div>
      </Container>
    </>
  );
}
