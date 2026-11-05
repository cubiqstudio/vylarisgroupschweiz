import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Heart,
  Inbox,
  ServerCrash,
  ShieldCheck,
} from "lucide-react";
import { db } from "@/lib/db";
import { SERVICE_CATEGORIES } from "@/lib/constants";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container, PageHeader } from "@/components/ui/section";
import { labelFor } from "@/i18n/labels";
import { services as messages } from "@/i18n/services";
import { getLocale, getMessages, getSite } from "@/i18n/server";
import {
  CategoryFilter,
  type CategoryOption,
} from "@/components/services/category-filter";
import {
  ServiceCard,
  type ServiceCardData,
} from "@/components/services/service-card";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSite();
  const m = await getMessages(messages);
  return {
    title: m.meta.title,
    description: m.meta.description(site.name),
    alternates: { canonical: "/services" },
  };
}

type Loaded = {
  services: ServiceCardData[];
  categories: CategoryOption[];
  total: number;
};

function categoryRank(name: string): number {
  const i = (SERVICE_CATEGORIES as readonly string[]).indexOf(name);
  return i === -1 ? SERVICE_CATEGORIES.length : i;
}

async function load(category: string | null): Promise<Loaded | null> {
  try {
    const [groups, services] = await Promise.all([
      db.saasService.groupBy({ by: ["category"], _count: { _all: true } }),
      db.saasService.findMany({
        where: category ? { category } : undefined,
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          slug: true,
          nameEn: true,
          tagline: true,
          taglineEn: true,
          description: true,
          descriptionEn: true,
          category: true,
          url: true,
          repoUrl: true,
          status: true,
          uptime: true,
          comingSoon: true,
        },
      }),
    ]);
    const categories = groups
      .map((g) => ({ name: g.category, count: g._count._all }))
      .sort(
        (a, b) =>
          categoryRank(a.name) - categoryRank(b.name) ||
          a.name.localeCompare(b.name, "de"),
      );
    return {
      services,
      categories,
      total: categories.reduce((n, c) => n + c.count, 0),
    };
  } catch (err) {
    console.error("[services] Laden fehlgeschlagen", err);
    return null;
  }
}

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string | string[] }>;
}) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.category) ? sp.category[0] : sp.category;
  const category = raw?.trim() ? raw.trim() : null;
  const data = await load(category);
  const m = await getMessages(messages);
  const locale = await getLocale();
  const categoryLabel = category
    ? labelFor("category", category, locale)
    : null;

  return (
    <>
      <PageHeader
        eyebrow={m.hero.eyebrow}
        title={
          <>
            {m.hero.titlePre}{" "}
            <span className="text-gradient">{m.hero.titleAccent}</span>{" "}
            {m.hero.titlePost}
          </>
        }
        description={m.hero.description}
      >
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-zinc-300">
          <span className="inline-flex items-center gap-2">
            <Heart className="h-4 w-4 text-emerald-400" aria-hidden />{" "}
            {m.hero.free}
          </span>
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" aria-hidden />{" "}
            {m.hero.openSource}
          </span>
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-indigo-400" aria-hidden />{" "}
            {m.hero.noTracking}
          </span>
        </div>
      </PageHeader>

      <Container className="py-12 sm:py-16">
        {data === null ? (
          <Card className="mx-auto max-w-xl p-8 text-center" role="alert">
            <ServerCrash
              className="mx-auto h-8 w-8 text-rose-400"
              aria-hidden
            />
            <h2 className="mt-4 text-lg font-semibold text-white">
              {m.failed.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              {m.failed.text}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/services" className={buttonClass("primary")}>
                {m.failed.retry}
              </Link>
              <Link href="/status" className={buttonClass("secondary")}>
                {m.failed.status}
              </Link>
            </div>
          </Card>
        ) : data.total === 0 ? (
          <Card className="mx-auto max-w-xl p-8 text-center">
            <Inbox className="mx-auto h-8 w-8 text-zinc-500" aria-hidden />
            <h2 className="mt-4 text-lg font-semibold text-white">
              {m.empty.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              {m.empty.text}
            </p>
            <div className="mt-6">
              <Link href="/contact" className={buttonClass("secondary")}>
                {m.empty.contact}
              </Link>
            </div>
          </Card>
        ) : (
          <>
            <CategoryFilter
              categories={data.categories}
              active={category}
              total={data.total}
            />

            <p className="mt-6 text-sm text-zinc-500" aria-live="polite">
              {categoryLabel
                ? m.list.countIn(data.services.length, categoryLabel)
                : m.list.countAll(data.total)}
            </p>

            {data.services.length === 0 ? (
              <Card className="mt-6 p-8 text-center">
                <Inbox className="mx-auto h-8 w-8 text-zinc-500" aria-hidden />
                <h2 className="mt-4 text-lg font-semibold text-white">
                  {m.list.noneTitle}
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-400">
                  {m.list.noneText(category ?? "")}
                </p>
                <div className="mt-6">
                  <Link href="/services" className={buttonClass("primary")}>
                    {m.list.reset}
                  </Link>
                </div>
              </Card>
            ) : (
              <section aria-labelledby="service-list-title">
                <h2 id="service-list-title" className="sr-only">
                  {categoryLabel
                    ? m.list.headingIn(categoryLabel)
                    : m.list.headingAll}
                </h2>
                <ul className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {data.services.map((s) => (
                    <li key={s.id} className="flex min-w-0">
                      <ServiceCard service={s} />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        <aside
          aria-label={m.promise.label}
          className="mt-14 flex flex-col gap-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.05] p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8"
        >
          <div>
            <p className="text-lg font-semibold tracking-tight text-white">
              {m.promise.title}
            </p>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-zinc-400">
              {m.promise.text}
            </p>
          </div>
          <Link
            href="/status"
            className={buttonClass("secondary", "md", "shrink-0")}
          >
            {m.promise.status}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </aside>
      </Container>
    </>
  );
}
