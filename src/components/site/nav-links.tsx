"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useMessages } from "@/i18n/client";
import { shell } from "@/i18n/shell";

export type NavItem = { href: string; label: string };

export function isActivePath(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Desktop-Navigation: kleine Schrift, aktiver Punkt mit 2 px blauer Unterstreichung. */
export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const m = useMessages(shell);
  return (
    <nav aria-label={m.header.mainNav} className="hidden xl:block">
      <ul className="flex items-center gap-1">
        {items.map((n) => {
          const active = isActivePath(pathname, n.href);
          return (
            <li key={n.href}>
              <Link
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative block whitespace-nowrap px-2.5 py-2 text-[13px] font-medium transition-colors",
                  "after:absolute after:inset-x-2.5 after:-bottom-px after:h-0.5 after:rounded-full after:transition-colors",
                  active
                    ? "text-white after:bg-link"
                    : "text-zinc-400 after:bg-transparent hover:text-white hover:after:bg-zinc-700",
                )}
              >
                {n.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
