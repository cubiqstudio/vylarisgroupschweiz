"use client";

import { cn } from "@/lib/utils";

/** Ein/Aus-Schalter (role="switch") mit sichtbarem Label und optionaler Beschreibung. */
export function Switch({
  id,
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  id: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={description ? `${id}-desc` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 disabled:cursor-not-allowed disabled:opacity-50",
          checked ? "bg-emerald-400" : "bg-zinc-700",
        )}
      >
        <span
          aria-hidden="true"
          className={cn("inline-block h-4 w-4 rounded-full bg-zinc-950 shadow transition-transform", checked ? "translate-x-6" : "translate-x-1")}
        />
      </button>
      <div className="min-w-0">
        <label id={`${id}-label`} htmlFor={id} className="block cursor-pointer text-sm font-medium text-zinc-100">
          {label}
        </label>
        {description && (
          <p id={`${id}-desc`} className="mt-0.5 text-sm text-zinc-400">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
