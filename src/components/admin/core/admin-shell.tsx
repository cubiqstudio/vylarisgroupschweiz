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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SITE } from "@/lib/sites";
import { LogoutButton } from "./logout-button";
import { ThemeSwitch } from "@/components/theme/theme-switch";
import { ToastProvider } from "./toast";
import { ROLE_LABEL } from "./styles";

const NAV = [
  { href: "/admin", label: "Übersicht", icon: LayoutDashboard },
  { href: "/admin/services", label: "Services", icon: Server },
  { href: "/admin/status", label: "Status", icon: Activity },
  { href: "/admin/blog", label: "Blog", icon: FileText },
  { href: "/admin/tickets", label: "Tickets", icon: Inbox, badge: "tickets" },
  { href: "/admin/newsletter", label: "Newsletter", icon: Mail },
  { href: "/admin/licenses", label: "Lizenzen", icon: KeySquare, badge: "licenses" },
  { href: "/admin/users", label: "Benutzer", icon: Users },
  { href: "/admin/settings", label: "Einstellungen", icon: Settings },
  { href: "/admin/account", label: "Mein Konto", icon: KeyRound },
] as const;

export function AdminShell({
  user,
  openTickets,
  pendingLicenses = 0,
  children,
}: {
  user: { name: string; email: string; role: string };
  openTickets: number;
  /** Wartende Lizenz-Anträge (Schlüssel und Webspace-Konten). */
  pendingLicenses?: number;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <ToastProvider>
      <div className="min-h-screen lg:flex">
        <a
          href="#admin-main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-emerald-400 focus:px-4 focus:py-2 focus:text-zinc-950"
        >
          Zum Inhalt springen
        </a>

        <aside className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur lg:h-screen lg:w-60 lg:shrink-0 lg:border-b-0 lg:border-r">
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
            className={cn("px-3 pb-4 lg:block lg:pb-0", open ? "block" : "hidden")}
          >
            <ul className="space-y-0.5">
              {NAV.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                const badgeCount = "badge" in item ? (item.badge === "tickets" ? openTickets : pendingLicenses) : 0;
                const badgeLabel = "badge" in item && item.badge === "licenses" ? "wartende Lizenz-Anträge" : "offene Tickets";
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
                      {badgeCount > 0 && (
                        <span
                          className="min-w-5 rounded-full bg-amber-400 px-1.5 text-center text-xs font-semibold leading-5 text-zinc-950"
                          aria-label={`${badgeCount} ${badgeLabel}`}
                        >
                          {badgeCount > 99 ? "99+" : badgeCount}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-zinc-800 px-4 py-3 sm:px-6 lg:px-8">
            <div className="min-w-0 text-sm">
              <p className="truncate font-medium text-white">{user.name}</p>
              <p className="truncate text-xs text-zinc-500">
                {ROLE_LABEL[user.role] ?? user.role} · {user.email}
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
