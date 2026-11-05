"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin/ledger", label: "Buchungen", match: (p: string) => p === "/admin/ledger" || p === "/admin/ledger/new" || /^\/admin\/ledger\/(?!accounts|budget|reports|years)[^/]+$/.test(p) },
  { href: "/admin/ledger/accounts", label: "Konten", match: (p: string) => p.startsWith("/admin/ledger/accounts") },
  { href: "/admin/ledger/budget", label: "Budget", match: (p: string) => p.startsWith("/admin/ledger/budget") },
  { href: "/admin/ledger/reports", label: "Auswertungen", match: (p: string) => p.startsWith("/admin/ledger/reports") },
  { href: "/admin/ledger/years", label: "Geschäftsjahre", match: (p: string) => p.startsWith("/admin/ledger/years") },
] as const;

/** Reiter innerhalb der Kassa. */
export function LedgerNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Bereiche der Kassa" className="-mx-1 mb-6 overflow-x-auto px-1 pb-1 print:hidden">
      <ul className="flex min-w-max gap-1.5">
        {ITEMS.map((i) => {
          const active = i.match(pathname);
          return (
            <li key={i.href}>
              <Link
                href={i.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium ring-1 ring-inset transition-colors",
                  active ? "bg-zinc-900 text-white ring-zinc-700" : "bg-zinc-900/50 text-zinc-400 ring-zinc-800 hover:bg-zinc-900 hover:text-zinc-100",
                )}
              >
                {i.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
