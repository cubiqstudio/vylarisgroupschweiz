import type { ReactNode } from "react";
import { List } from "lucide-react";
import { Container, PageHeader } from "@/components/ui/section";
import { legalUi } from "@/i18n/legal";
import { getMessages } from "@/i18n/server";

export type TocItem = { id: string; title: string };

function TocList({ items }: { items: TocItem[] }) {
  return (
    <ol className="space-y-1 text-sm">
      {items.map((item, i) => (
        <li key={item.id}>
          <a
            href={`#${item.id}`}
            className="group flex gap-3 rounded-md px-2 py-1.5 text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-white"
          >
            <span className="w-5 shrink-0 text-right font-mono text-xs leading-5 text-zinc-500 group-hover:text-emerald-400">
              {i + 1}.
            </span>
            <span>{item.title}</span>
          </a>
        </li>
      ))}
    </ol>
  );
}

/** Gemeinsames Layout der Rechtsseiten: Kopfbereich, Inhaltsverzeichnis, schmale Lesespalte (.prose-vge). */
export async function LegalPage({
  eyebrow,
  title,
  description,
  toc,
  notice,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  toc: TocItem[];
  /** Optionaler Hinweis oberhalb des Textes (z. B. Stand-Datum). */
  notice?: ReactNode;
  children: ReactNode;
}) {
  const m = (await getMessages(legalUi)).toc;
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <Container className="py-12 sm:py-16">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-14">
          <aside
            className="lg:sticky lg:top-24 lg:self-start"
            aria-label={m.label}
          >
            {/* Mobil: einklappbar */}
            <details className="rounded-xl border border-zinc-800 bg-zinc-900/50 lg:hidden">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-zinc-200 [&::-webkit-details-marker]:hidden">
                <List className="h-4 w-4 text-emerald-400" aria-hidden />
                {m.label}
              </summary>
              <nav
                aria-label={m.labelMobile}
                className="border-t border-zinc-800 p-2"
              >
                <TocList items={toc} />
              </nav>
            </details>
            {/* Desktop: dauerhaft sichtbar */}
            <nav aria-label={m.label} className="hidden lg:block">
              <p className="mb-3 px-2 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                {m.heading}
              </p>
              <TocList items={toc} />
            </nav>
          </aside>

          <article className="min-w-0 max-w-3xl">
            {notice && <div className="mb-10">{notice}</div>}
            <div className="prose-vge [&>section:first-child>h2]:!mt-0">
              {children}
            </div>
          </article>
        </div>
      </Container>
    </>
  );
}

/** Abschnitt einer Rechtsseite mit Anker. Die Nummerierung entspricht der Reihenfolge im Inhaltsverzeichnis. */
export function LegalSection({
  id,
  number,
  title,
  children,
}: {
  id: string;
  number: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="scroll-mt-24 [&>*+*]:mt-4"
    >
      <h2 id={`${id}-heading`} className="!mt-10">
        <span
          className="mr-2 font-mono text-base font-medium text-emerald-400/80"
          aria-hidden
        >
          {number}.
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}
