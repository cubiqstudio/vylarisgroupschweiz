"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMessages } from "@/i18n/client";
import { licenses } from "@/i18n/licenses";

/** Aktiver Schlüssel: groß in Monospace, mit Kopieren-Button. Der Schlüssel wird nirgends protokolliert. */
export function KeyDisplay({ value, bound }: { value: string; bound: boolean }) {
  const m = useMessages(licenses);
  const labelId = useId();
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function copy() {
    let ok = false;
    try {
      await navigator.clipboard.writeText(value);
      ok = true;
    } catch {
      ok = false;
    }
    setState(ok ? "copied" : "failed");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 3000);
  }

  return (
    <div>
      <p id={labelId} className="text-xs font-medium uppercase tracking-wider text-zinc-500">
        {m.key.label}
      </p>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
        <code
          aria-labelledby={labelId}
          className="block min-w-0 flex-1 select-all break-all rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-3 font-mono text-base font-semibold tracking-wider text-emerald-300 sm:text-lg"
        >
          {value}
        </code>
        <Button type="button" variant="secondary" onClick={copy} aria-label={m.key.copyAria} className="shrink-0">
          {state === "copied" ? <Check className="size-4 text-emerald-400" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          {state === "copied" ? m.key.copied : m.key.copy}
        </Button>
      </div>
      <p role="status" aria-live="polite" className={`mt-2 min-h-5 text-xs ${state === "failed" ? "text-rose-400" : "text-emerald-400"}`}>
        {state === "copied" ? m.key.copiedLive : state === "failed" ? m.key.copyFailed : ""}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-zinc-500">{m.key.secret}</p>
      <p className="mt-1 text-xs leading-relaxed text-zinc-500">{bound ? m.key.boundYes : m.key.boundNo}</p>
    </div>
  );
}
