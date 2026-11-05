"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Avatar } from "@/components/account/avatar";
import { profileLinks, type ProfileInfo } from "@/lib/profile-links";
import { ThemeSwitch } from "@/components/theme/theme-switch";
import { themeMsgs } from "@/i18n/theme";
import { cn } from "@/lib/utils";
import { useMessages } from "@/i18n/client";
import { shell } from "@/i18n/shell";

const ICONS = {
  overview: LayoutDashboard,
  settings: Settings,
  team: Users,
  admin: ShieldCheck,
} as const;

async function logout() {
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
    });
  } finally {
    window.location.assign("/");
  }
}

/** Profil oben rechts: Bild/Initialen, Name und ein Menü mit den Bereichen des Kontos. */
export function ProfileMenu({ profile }: { profile: ProfileInfo }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const m = useMessages(shell);
  const theme = useMessages(themeMsgs);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const role =
    profile.kind === "admin"
      ? m.profile.roleAdmin
      : profile.isTeam
        ? m.profile.roleTeam
        : m.profile.roleUser;

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 items-center gap-2 rounded-full border border-zinc-800 bg-surface py-1 pl-1 pr-2.5 text-left hover:bg-zinc-900 sm:pr-3"
      >
        <Avatar
          name={profile.name}
          userId={profile.id}
          hasImage={profile.hasAvatar}
          size={32}
        />
        <span className="hidden max-w-[9rem] truncate text-[13px] font-medium text-zinc-100 sm:block">
          {profile.name}
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-zinc-500 transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
        <span className="sr-only">{m.profile.accountMenu}</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-zinc-800 bg-surface shadow-xl shadow-slate-900/10"
        >
          <div className="flex items-center gap-3 border-b border-zinc-800 p-4">
            <Avatar
              name={profile.name}
              userId={profile.id}
              hasImage={profile.hasAvatar}
              size={40}
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">
                {profile.name}
              </p>
              <p className="truncate text-xs text-zinc-500">{profile.email}</p>
              <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-emerald-400">
                {role}
              </p>
            </div>
          </div>
          <ul className="p-1.5">
            {profileLinks(profile).map((l) => {
              const Icon = ICONS[l.icon];
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    role="menuitem"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
                  >
                    <Icon className="h-4 w-4 text-zinc-500" aria-hidden />
                    {m.profile[l.icon]}
                  </Link>
                </li>
              );
            })}
            <li>
              <button
                type="button"
                role="menuitem"
                onClick={() => void logout()}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-900"
              >
                <LogOut className="h-4 w-4 text-zinc-500" aria-hidden />
                {m.profile.signOut}
              </button>
            </li>
          </ul>
          <div className="flex items-center justify-between gap-2 border-t border-zinc-800 px-4 py-3">
            <span className="text-xs text-zinc-500">{theme.label}</span>
            <ThemeSwitch compact />
          </div>
        </div>
      )}
    </div>
  );
}
