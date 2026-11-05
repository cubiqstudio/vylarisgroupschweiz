"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMessages } from "@/i18n/client";
import { shell } from "@/i18n/shell";
import { isActivePath, type NavItem } from "@/components/site/nav-links";

export type NavAction = NavItem & { primary?: boolean };

export function MobileNav({ items, actions, signedIn = false }: { items: NavItem[]; actions: NavAction[]; signedIn?: boolean }) {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const m = useMessages(shell);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="xl:hidden">
      <button
        ref={toggleRef}
        type="button"
        aria-label={open ? m.header.menuClose : m.header.menuOpen}
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-zinc-300 hover:bg-zinc-900"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>
      {open && (
        <nav
          id="mobile-nav-panel"
          aria-label={m.header.mobileNav}
          className="absolute inset-x-0 top-full max-h-[calc(100dvh-5rem)] overflow-y-auto border-b border-zinc-800 bg-surface p-4 shadow-xl shadow-slate-900/10"
        >
          <ul className="space-y-1">
            {items.map((i) => {
              const active = isActivePath(pathname, i.href);
              return (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "block rounded-lg px-3 py-3 text-base hover:bg-zinc-900",
                      active ? "bg-zinc-900 font-semibold text-emerald-400" : "text-zinc-200",
                    )}
                  >
                    {i.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          {actions.length > 0 && (
            <ul className="mt-3 grid gap-2 border-t border-zinc-800 pt-4 sm:grid-cols-2">
              {actions.map((a) => (
                <li key={a.href}>
                  <Link
                    href={a.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex h-11 items-center justify-center rounded-lg px-4 text-sm font-medium transition-colors",
                      a.primary
                        ? "bg-emerald-400 text-surface hover:bg-emerald-300"
                        : "bg-surface text-zinc-100 ring-1 ring-inset ring-zinc-600 hover:bg-zinc-900",
                    )}
                  >
                    {a.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {signedIn && (
            <p className="mt-2 text-center text-xs text-zinc-500">{m.header.signOutHint}</p>
          )}
        </nav>
      )}
    </div>
  );
}
