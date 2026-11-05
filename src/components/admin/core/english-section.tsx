"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, Languages } from "lucide-react";

/**
 * Ausklappbarer Abschnitt für die englische Fassung eines Inhalts (vylaris.net).
 * Klappt von selbst auf, wenn bereits englische Texte vorhanden sind oder ein Feld darin einen Fehler meldet.
 */
export function EnglishSection({
  hint,
  filled = false,
  hasError = false,
  children,
}: {
  /** Erklärung, was ein leerer englischer Inhalt bewirkt */
  hint: string;
  /** Es existieren bereits englische Inhalte */
  filled?: boolean;
  /** Ein Feld im Abschnitt hat einen Validierungsfehler */
  hasError?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(filled);

  return (
    <details
      open={open || hasError}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className="group rounded-lg border border-zinc-800 bg-zinc-900/30"
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-zinc-300 hover:text-white [&::-webkit-details-marker]:hidden">
        <Languages className="h-4 w-4 text-zinc-500" aria-hidden="true" />
        Englische Fassung (vylaris.net)
        {filled && <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-300">vorhanden</span>}
        <ChevronDown className="ml-auto h-4 w-4 text-zinc-500 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="space-y-4 border-t border-zinc-800 px-4 py-4">
        <p className="text-xs text-zinc-400">{hint}</p>
        {children}
      </div>
    </details>
  );
}
