"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { api } from "@/lib/api-client";
import { Input } from "@/components/ui/form";

export type PickedMember = { id: string; memberNumber: number; name: string; city: string };

/**
 * Auswahlfeld für ein aktives Mitglied: tippen, Treffer in der Liste anklicken (Pfeiltasten, Enter, Escape funktionieren).
 * Sucht über /api/admin/members/search.
 */
export function MemberPicker({
  label,
  value,
  onChange,
  error,
  disabled,
}: {
  label: string;
  value: PickedMember | null;
  onChange: (m: PickedMember | null) => void;
  error?: string;
  disabled?: boolean;
}) {
  const uid = useId();
  const [q, setQ] = useState("");
  const [items, setItems] = useState<PickedMember[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (value || q.trim().length === 0) return;
    const ctrl = new AbortController();
    timer.current = setTimeout(async () => {
      try {
        const res = await api<{ items: PickedMember[] }>(`/api/admin/members/search?q=${encodeURIComponent(q.trim())}`, { signal: ctrl.signal });
        setItems(res.items);
        setActive(0);
        setFailed(false);
      } catch {
        if (!ctrl.signal.aborted) setFailed(true);
      }
    }, 200);
    return () => {
      ctrl.abort();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q, value]);

  const pick = (m: PickedMember) => {
    onChange(m);
    setOpen(false);
    setQ("");
  };

  if (value) {
    return (
      <div className="space-y-1.5">
        <span className="block text-sm font-medium text-zinc-300">{label}</span>
        <div className="flex h-10 items-center justify-between gap-2 rounded-lg border border-zinc-600 bg-surface px-3 text-sm text-zinc-100">
          <span className="min-w-0 truncate">
            {value.name} <span className="text-zinc-500">(Nr. {value.memberNumber}{value.city ? `, ${value.city}` : ""})</span>
          </span>
          {!disabled && (
            <button type="button" onClick={() => onChange(null)} className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white" aria-label="Auswahl entfernen">
              <X className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>
        {error && <p role="alert" className="text-xs text-rose-400">{error}</p>}
      </div>
    );
  }

  const listId = `${uid}-list`;
  return (
    <div className="relative space-y-1.5">
      <label htmlFor={`${uid}-q`} className="block text-sm font-medium text-zinc-300">
        {label}
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden />
        <Input
          id={`${uid}-q`}
          role="combobox"
          aria-expanded={open && items.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-invalid={error ? true : undefined}
          autoComplete="off"
          value={q}
          disabled={disabled}
          maxLength={100}
          placeholder="Name oder Nummer eingeben"
          className="pl-9"
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            if (e.target.value.trim() === "") setItems([]);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, items.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter" && open && items[active]) {
              e.preventDefault();
              pick(items[active]);
            } else if (e.key === "Escape") setOpen(false);
          }}
        />
      </div>
      {open && q.trim() !== "" && (
        <ul id={listId} role="listbox" aria-label="Treffer" className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-zinc-700 bg-zinc-900 py-1 shadow-xl">
          {failed && <li className="px-3 py-2 text-sm text-rose-300">Die Suche ist fehlgeschlagen.</li>}
          {!failed && items.length === 0 && <li className="px-3 py-2 text-sm text-zinc-500">Kein aktives Mitglied gefunden.</li>}
          {items.map((m, i) => (
            <li key={m.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(m)}
                className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm ${i === active ? "bg-zinc-800 text-white" : "text-zinc-200 hover:bg-zinc-800"}`}
              >
                <span className="truncate">{m.name}</span>
                <span className="shrink-0 text-xs text-zinc-500">Nr. {m.memberNumber}{m.city ? `, ${m.city}` : ""}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p role="alert" className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}
