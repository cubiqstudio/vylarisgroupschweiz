"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMessages } from "@/i18n/client";
import { account } from "@/i18n/account";
import { cn } from "@/lib/utils";

/** `prefix`: Reiter bleibt aktiv, solange der Pfad darunter liegt (z. B. /account/verein/beitraege). */
export type AccountTab = { href: string; label: string; prefix?: boolean };

export function AccountTabs({ tabs }: { tabs: AccountTab[] }) {
  const pathname = usePathname();
  const m = useMessages(account);
  return (
    <nav aria-label={m.area.tabsLabel} className="-mb-px flex gap-1 overflow-x-auto">
      {tabs.map((t) => {
        const active = pathname === t.href || (t.prefix === true && !!pathname?.startsWith(`${t.href}/`));
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "whitespace-nowrap border-b-2 px-3.5 py-3 text-sm font-medium transition-colors",
              active ? "border-emerald-400 text-white" : "border-transparent text-zinc-400 hover:text-white",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
