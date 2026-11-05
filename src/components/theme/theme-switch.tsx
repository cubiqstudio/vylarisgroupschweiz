"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useMessages } from "@/i18n/client";
import { themeMsgs } from "@/i18n/theme";
import { cn } from "@/lib/utils";

type Pref = "light" | "dark" | "system";
const KEY = "vge-theme";

function readPref(): Pref {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function apply(pref: Pref) {
  const dark = pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
}

/** Hell / Dunkel / System. `tone="onDark"` für den dunklen Footer, `compact` ohne Beschriftung (Profil-Menü, Admin). */
export function ThemeSwitch({ tone = "default", compact = false, className }: { tone?: "default" | "onDark"; compact?: boolean; className?: string }) {
  const m = useMessages(themeMsgs);
  const [pref, setPref] = useState<Pref | null>(null);

  useEffect(() => {
    setPref(readPref());
  }, []);

  // „System“ folgt Änderungen der Geräteeinstellung live.
  useEffect(() => {
    if (pref !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => apply("system");
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [pref]);

  function choose(next: Pref) {
    setPref(next);
    try {
      if (next === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {
      /* Speicher gesperrt: Wahl gilt nur für diese Sitzung */
    }
    apply(next);
  }

  const options: { value: Pref; label: string; Icon: typeof Sun }[] = [
    { value: "light", label: m.light, Icon: Sun },
    { value: "dark", label: m.dark, Icon: Moon },
    { value: "system", label: m.system, Icon: Monitor },
  ];
  const onDark = tone === "onDark";

  return (
    <div
      role="group"
      aria-label={m.label}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full p-0.5 ring-1 ring-inset",
        onDark ? "bg-[#1a1a1a] ring-[#333]" : "bg-surface ring-zinc-800",
        className,
      )}
    >
      {options.map(({ value, label, Icon }) => {
        const active = pref === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => choose(value)}
            aria-pressed={active}
            aria-label={compact ? label : undefined}
            title={label}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full text-xs font-medium transition-colors",
              compact ? "h-7 w-7 justify-center" : "h-8 px-3",
              active
                ? onDark
                  ? "bg-[#ffffff] text-[#101010]"
                  : "bg-zinc-100 text-surface"
                : onDark
                  ? "text-[#bdbdbd] hover:text-[#ffffff]"
                  : "text-zinc-400 hover:text-white",
            )}
          >
            <Icon className="size-3.5" aria-hidden />
            {!compact && <span>{label}</span>}
          </button>
        );
      })}
    </div>
  );
}
