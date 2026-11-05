import type { Metadata } from "next";
import Link from "next/link";
import { Download, FolderOpen, Search } from "lucide-react";
import { PILL } from "@/components/admin/core/styles";
import { Button, buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { getMessages } from "@/i18n/server";
import { verein } from "@/i18n/verein";
import { vereinDokumente } from "@/i18n/verein-dokumente";
import { cn } from "@/lib/utils";
import { DOCUMENT_CATEGORIES, DOCUMENT_CATEGORY_LABEL, TONE_CLASS } from "@/lib/verein/constants";
import { formatDateCh } from "@/lib/verein/dates";
import { listVisibleDocuments } from "@/lib/verein/documents-data";
import { formatFileSize, parseDocumentFilters } from "@/lib/verein/documents-lib";
import { requireMemberPage } from "@/lib/verein/guard";
import { firstParam, listHref } from "@/lib/verein/pagination";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const m = (await getMessages(verein)).portal;
  return { title: m.meta.documents, robots: { index: false, follow: false } };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Dokumente im Portal: Unterlagen mit Sichtbarkeit «Mitglieder» und «Öffentlich» für aktuelle Mitglieder (die Sichtbarkeit wird in der Abfrage erzwungen). */
export default async function Page({ searchParams }: Props) {
  const member = await requireMemberPage("/account/verein/dokumente");
  const m = (await getMessages(vereinDokumente)).portal;
  const sp = await searchParams;
  const filters = parseDocumentFilters((k) => firstParam(sp, k));
  const active = member.status === "AKTIV";
  const docs = active ? await listVisibleDocuments("MEMBER", { category: filters.category, q: filters.q }) : [];
  const filtered = Boolean(filters.q || filters.category);
  const href = (category: string) => listHref("/account/verein/dokumente", { q: filters.q, category });

  return (
    <section aria-labelledby="documents-heading" className="space-y-6">
      <div>
        <h2 id="documents-heading" className="text-xl font-semibold tracking-tight text-white">
          {m.heading}
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">{m.intro}</p>
      </div>

      {!active ? (
        <Card className="px-6 py-8 text-sm text-zinc-300">{m.notActive}</Card>
      ) : (
        <>
          <nav aria-label={m.categoriesLabel} className="-mx-1 overflow-x-auto px-1 pb-1">
            <ul className="flex min-w-max gap-1.5">
              {[{ value: "", label: m.allCategories }, ...DOCUMENT_CATEGORIES.map((c) => ({ value: c as string, label: DOCUMENT_CATEGORY_LABEL[c] }))].map((c) => {
                const on = filters.category === c.value;
                return (
                  <li key={c.value || "alle"}>
                    <Link
                      href={href(c.value)}
                      aria-current={on ? "true" : undefined}
                      className={cn(
                        "inline-flex h-8 items-center rounded-lg px-3 text-sm font-medium ring-1 ring-inset transition-colors",
                        on ? "bg-zinc-900 text-white ring-zinc-700" : "bg-zinc-900/50 text-zinc-400 ring-zinc-800 hover:bg-zinc-900 hover:text-zinc-100",
                      )}
                    >
                      {c.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <form method="get" action="/account/verein/dokumente" role="search" className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            {filters.category && <input type="hidden" name="category" value={filters.category} />}
            <div className="relative">
              <label htmlFor="doc-q" className="sr-only">
                {m.searchLabel}
              </label>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden />
              <Input id="doc-q" name="q" type="search" defaultValue={filters.q} maxLength={100} placeholder={m.searchPlaceholder} className="pl-9" />
            </div>
            <Button type="submit" variant="secondary">
              {m.searchButton}
            </Button>
            {filtered && (
              <Link href="/account/verein/dokumente" className={buttonClass("ghost", "md")}>
                {m.reset}
              </Link>
            )}
          </form>

          {docs.length === 0 ? (
            <Card className="flex flex-col items-center px-6 py-12 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800/80 text-zinc-400 ring-1 ring-inset ring-zinc-700">
                <FolderOpen className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="mt-4 text-lg font-semibold text-white">{filtered ? m.emptyFilteredTitle : m.emptyTitle}</h3>
              <p className="mt-1.5 max-w-sm text-sm text-zinc-400">{filtered ? m.emptyFilteredText : m.emptyText}</p>
            </Card>
          ) : (
            <Card className="divide-y divide-zinc-800">
              <ul>
                {docs.map((d) => (
                  <li key={d.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium text-white [overflow-wrap:anywhere]">{d.title}</p>
                      {d.description && <p className="mt-0.5 text-sm text-zinc-400 [overflow-wrap:anywhere]">{d.description}</p>}
                      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
                        <span className={cn(PILL, TONE_CLASS.zinc)}>{DOCUMENT_CATEGORY_LABEL[d.category as keyof typeof DOCUMENT_CATEGORY_LABEL] ?? d.category}</span>
                        {d.visibility === "OEFFENTLICH" && <span className={cn(PILL, TONE_CLASS.green)}>{m.publicBadge}</span>}
                        <span>{m.version(d.currentVersion)}</span>
                        <span>{m.updated(formatDateCh(d.updatedAt))}</span>
                        {d.versions[0] && <span>{formatFileSize(d.versions[0].sizeBytes)}</span>}
                      </p>
                    </div>
                    <a href={`/api/documents/${encodeURIComponent(d.id)}/download`} download className={buttonClass("secondary", "sm", "shrink-0")}>
                      <Download className="h-4 w-4" aria-hidden />
                      {m.download}
                      <span className="sr-only">: {d.title}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </section>
  );
}
