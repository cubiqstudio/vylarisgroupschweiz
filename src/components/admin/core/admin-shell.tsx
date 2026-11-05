"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ExternalLink,
  FileText,
  Inbox,
  LayoutDashboard,
  Menu,
  Server,
  Settings,
  Activity,
  X,
  ShieldCheck,
  Users,
  KeyRound,
  KeySquare,
  Mail,
  Receipt,
  Wallet,
  Gavel,
  CalendarDays,
  FolderOpen,
  ListChecks,
  ScrollText,
  UserCog,
  Building2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SITE } from "@/lib/sites";
import { LogoutButton } from "./logout-button";
import { ThemeSwitch } from "@/components/theme/theme-switch";
import { ToastProvider } from "./toast";
import { rolesLabel } from "./styles";
import { filterNav, type AdminNavGroup, type AdminNavLink } from "@/lib/verein/permissions";

type BadgeKey = "tickets" | "licenses" | "applications";
type NavItem = AdminNavLink & { icon: LucideIcon; badge?: BadgeKey };

/** Seitenleiste in Gruppen. Einträge, für die die Rolle kein Leserecht hat, werden ausgeblendet (filterNav). */
const NAV: AdminNavGroup<NavItem>[] = [
  {
    title: "Verein",
    items: [
      { href: "/admin", label: "Übersicht", icon: LayoutDashboard, module: "dashboard" },
      { href: "/admin/members", label: "Mitglieder", icon: Users, module: "members", badge: "applications" },
      { href: "/admin/fees", label: "Beiträge", icon: Receipt, module: "fees" },
      { href: "/admin/ledger", label: "Kassa", icon: Wallet, module: "ledger" },
      { href: "/admin/meetings", label: "Versammlungen", icon: Gavel, module: "meetings" },
      { href: "/admin/events", label: "Anlässe", icon: CalendarDays, module: "events" },
      { href: "/admin/documents", label: "Dokumente", icon: FolderOpen, module: "documents" },
      { href: "/admin/tasks", label: "Aufgaben", icon: ListChecks, module: "tasks" },
    ],
  },
  {
    title: "Website",
    items: [
      { href: "/admin/services", label: "Services", icon: Server, module: "website" },
      { href: "/admin/status", label: "Status", icon: Activity, module: "website" },
      { href: "/admin/blog", label: "Blog", icon: FileText, module: "website" },
      { href: "/admin/tickets", label: "Tickets", icon: Inbox, module: "website", badge: "tickets" },
      { href: "/admin/newsletter", label: "Newsletter", icon: Mail, module: "newsletter" },
      { href: "/admin/licenses", label: "Lizenzen", icon: KeySquare, module: "website", badge: "licenses" },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/admin/users", label: "Benutzer", icon: Users, module: "website" },
      { href: "/admin/verein", label: "Vereinseinstellungen", icon: Building2, module: "verein_settings" },
      { href: "/admin/verein/protokoll", label: "Änderungsprotokoll", icon: ScrollText, module: "audit" },
      { href: "/admin/verein/zugaenge", label: "Zugänge und Rollen", icon: UserCog, module: "system" },
      { href: "/admin/settings", label: "Einstellungen", icon: Settings, module: "system" },
      { href: "/admin/account", label: "Mein Konto", icon: KeyRound, module: "self" },
    ],
  },
];

const BADGE_LABEL: Record<BadgeKey, string> = {
  tickets: "offene Tickets",
  licenses: "wartende Lizenz-Anträge",
  applications: "offene Mitgliedsanträge",
};

export function AdminShell({
  user,
  badges,
  children,
}: {
  user: { name: string; email: string; roles: readonly string[] };
  /** Zähler für die Hinweise in der Navigation: offene Tickets, wartende Lizenz-Anträge, offene Mitgliedsanträge. */
  badges: Partial<Record<BadgeKey, number>>;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const groups = filterNav(NAV, user.roles);
  // Aktiv ist der Eintrag mit dem längsten passenden Pfad (so bleibt «Vereinseinstellungen» auf /admin/verein/protokoll inaktiv).
  const allHrefs = groups.flatMap((g) => g.items.map((i) => i.href));
  const activeHref = allHrefs
    .filter((href) => (href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`)))
    .sort((a, b) => b.length - a.length)[0];
  const isActive = (href: string) => href === activeHref;

  return (
    <ToastProvider>
      <div className="min-h-screen lg:flex">
        <a
          href="#admin-main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-emerald-400 focus:px-4 focus:py-2 focus:text-zinc-950"
        >
          Zum Inhalt springen
        </a>

        <aside className="print:hidden sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur lg:flex lg:h-screen lg:w-60 lg:shrink-0 lg:flex-col lg:border-b-0 lg:border-r">
          <div className="flex h-14 items-center justify-between px-4 lg:h-16">
            <Link href="/admin" className="flex items-center gap-2.5 font-semibold tracking-tight text-white" onClick={() => setOpen(false)}>
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-400/10 text-emerald-400 ring-1 ring-inset ring-emerald-400/30">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="truncate">{SITE.name}</span>
                <span className="text-xs font-normal text-zinc-500">Verwaltung</span>
              </span>
            </Link>
            <button
              type="button"
              className="rounded-lg p-2 text-zinc-300 hover:bg-zinc-900 hover:text-white lg:hidden"
              aria-expanded={open}
              aria-controls="admin-nav"
              aria-label={open ? "Navigation schliessen" : "Navigation öffnen"}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
            </button>
          </div>

          <nav
            id="admin-nav"
            aria-label="Admin-Navigation"
            className={cn("px-3 pb-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pb-6", open ? "block max-h-[calc(100dvh-3.5rem)] overflow-y-auto" : "hidden lg:block")}
          >
            {groups.map((group) => (
              <div key={group.title} className="mt-4 first:mt-0">
                <p id={`nav-group-${group.title}`} className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  {group.title}
                </p>
                <ul className="space-y-0.5" aria-labelledby={`nav-group-${group.title}`}>
                  {group.items.map((item) => {
                    const active = isActive(item.href);
                    const Icon = item.icon;
                    const badgeCount = item.badge ? (badges[item.badge] ?? 0) : 0;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          onClick={() => setOpen(false)}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                            active ? "bg-zinc-900 text-white ring-1 ring-inset ring-zinc-800" : "text-zinc-400 hover:bg-zinc-900/70 hover:text-zinc-100",
                          )}
                        >
                          <Icon className={cn("h-4 w-4", active ? "text-emerald-400" : "text-zinc-500")} aria-hidden="true" />
                          <span className="flex-1">{item.label}</span>
                          {item.badge && badgeCount > 0 && (
                            <span
                              className="min-w-5 rounded-full bg-amber-400 px-1.5 text-center text-xs font-semibold leading-5 text-zinc-950"
                              aria-label={`${badgeCount} ${BADGE_LABEL[item.badge]}`}
                            >
                              {badgeCount > 99 ? "99+" : badgeCount}
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="print:hidden flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-zinc-800 px-4 py-3 sm:px-6 lg:px-8">
            <div className="min-w-0 text-sm">
              <p className="truncate font-medium text-white">{user.name}</p>
              <p className="truncate text-xs text-zinc-500">
                {rolesLabel(user.roles)} · {user.email}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Link
                href="/"
                target="_blank"
                rel="noopener"
                className="inline-flex h-8 items-center gap-2 rounded-lg px-3 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-900 hover:text-white"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                Zur Website
                <span className="sr-only">(öffnet in neuem Tab)</span>
              </Link>
              <ThemeSwitch compact />
              <LogoutButton />
            </div>
          </header>
          <main id="admin-main" className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <div className="mx-auto w-full max-w-6xl">{children}</div>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
