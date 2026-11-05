import Link from "next/link";
import { labelFor } from "@/i18n/labels";
import { services } from "@/i18n/services";
import { getLocale, getMessages } from "@/i18n/server";
import { cn } from "@/lib/utils";

export type CategoryOption = { name: string; count: number };

/** URL-getriebener Kategorie-Filter (serverseitig, ohne Client-JS). */
export async function CategoryFilter({
  categories,
  active,
  total,
}: {
  categories: CategoryOption[];
  active: string | null;
  total: number;
}) {
  const locale = await getLocale();
  const m = (await getMessages(services)).filter;
  const chip = (isActive: boolean) =>
    cn(
      "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 ring-inset transition-colors",
      isActive
        ? "bg-emerald-400 text-zinc-950 ring-emerald-400"
        : "bg-zinc-900/60 text-zinc-300 ring-zinc-700 hover:bg-zinc-800 hover:text-white",
    );
  const count = (isActive: boolean) =>
    cn(
      "rounded-full px-1.5 text-xs tabular-nums",
      isActive ? "bg-zinc-950/15 text-zinc-900" : "bg-zinc-800 text-zinc-400",
    );

  return (
    <nav aria-label={m.label}>
      <ul className="flex flex-wrap gap-2">
        <li>
          <Link
            href="/services"
            scroll={false}
            aria-current={active === null ? "page" : undefined}
            className={chip(active === null)}
          >
            {m.all}
            <span className={count(active === null)}>{total}</span>
          </Link>
        </li>
        {categories.map((c) => {
          const isActive = active === c.name;
          return (
            <li key={c.name}>
              <Link
                href={`/services?category=${encodeURIComponent(c.name)}`}
                scroll={false}
                aria-current={isActive ? "page" : undefined}
                className={chip(isActive)}
              >
                {labelFor("category", c.name, locale)}
                <span className={count(isActive)}>{c.count}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
