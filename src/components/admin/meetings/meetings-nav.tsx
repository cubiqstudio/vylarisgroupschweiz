"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin/meetings", label: "Sitzungen", match: (p: string) => p === "/admin/meetings" || (/^\/admin\/meetings\/[^/]+/.test(p) && !p.startsWith("/admin/meetings/resolutions")) },
  { href: "/admin/meetings/resolutions", label: "Beschlussregister", match: (p: string) => p.startsWith("/admin/meetings/resolutions") },
] as const;

/** Reiter innerhalb des Bereichs Versammlungen. */
export function MeetingsNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Bereiche der Versammlungen" className="-mx-1 mb-6 overflow-x-auto px-1 pb-1">
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
