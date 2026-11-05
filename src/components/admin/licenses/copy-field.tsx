"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Schreibgeschütztes Feld mit Kopieren-Schaltfläche (für Token, Signierschlüssel, Beispiele). */
export function CopyField({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      setState("failed");
    }
    setTimeout(() => setState("idle"), 2500);
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-zinc-300">{label}</span>
        <Button type="button" variant="secondary" size="sm" onClick={copy}>
          {state === "copied" ? <Check className="h-4 w-4 text-emerald-400" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
          {state === "copied" ? "Kopiert" : state === "failed" ? "Kopieren nicht möglich" : "Kopieren"}
          <span className="sr-only"> ({label})</span>
        </Button>
      </div>
      {multiline ? (
        <pre className="max-h-64 overflow-auto whitespace-pre rounded-lg border border-zinc-700 bg-zinc-950 p-3 font-mono text-xs leading-relaxed text-zinc-200">{value}</pre>
      ) : (
        <input
          readOnly
          value={value}
          aria-label={label}
          onFocus={(e) => e.currentTarget.select()}
          className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 font-mono text-xs text-zinc-100 focus:border-emerald-400 focus:outline-none"
        />
      )}
      <span className="sr-only" role="status">
        {state === "copied" ? `${label} kopiert.` : ""}
      </span>
    </div>
  );
}
