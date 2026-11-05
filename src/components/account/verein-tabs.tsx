"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMessages } from "@/i18n/client";
import { verein } from "@/i18n/verein";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/account/verein", key: "overview" },
  { href: "/account/verein/mitgliedschaft", key: "membership" },
  { href: "/account/verein/beitraege", key: "fees" },
  { href: "/account/verein/anlaesse", key: "events" },
  { href: "/account/verein/versammlungen", key: "meetings" },
  { href: "/account/verein/dokumente", key: "documents" },
] as const;

/** Zweite Reiterebene im Mitgliederportal (Verein: Übersicht, Mitgliedschaft, Beiträge, Anlässe, Versammlungen, Dokumente). */
export function VereinTabs() {
  const pathname = usePathname();
  const m = useMessages(verein).portal;
  return (
    <nav aria-label={m.tabsLabel} className="-mx-1 mb-8 overflow-x-auto px-1 pb-1">
      <ul className="flex min-w-max gap-1.5">
        {TABS.map((t) => {
          const active = pathname === t.href;
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium ring-1 ring-inset transition-colors",
                  active ? "bg-zinc-900 text-white ring-zinc-700" : "bg-zinc-900/50 text-zinc-400 ring-zinc-800 hover:bg-zinc-900 hover:text-zinc-100",
                )}
              >
                {m.tabs[t.key]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
