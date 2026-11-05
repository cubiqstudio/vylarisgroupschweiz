"use client";

import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";

/** Abschnitt einer Einstellungsseite (Karte mit Überschrift und Erklärung). */
export function SettingsSection({ id, title, description, children }: { id: string; title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-title`} className="scroll-mt-6">
      <Card className="p-5 sm:p-6">
        <h2 id={`${id}-title`} className="text-base font-semibold text-white">
          {title}
        </h2>
        {description && <p className="mt-1 max-w-2xl text-sm text-zinc-400">{description}</p>}
        <div className="mt-5">{children}</div>
      </Card>
    </section>
  );
}

/** Kennzeichnung einer Voreinstellung, die der Verein gemäss Statuten prüfen und anpassen soll. */
export function StatutesBadge({ text = "Voreinstellung: gemäss Statuten anpassen" }: { text?: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-300 ring-1 ring-inset ring-amber-500/30">{text}</span>
  );
}

/** Ganze Zahl (z. B. Tage) als Textfeld; leer = nicht festgelegt. */
export function IntField({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  disabled,
  unit,
  placeholder = "nicht festgelegt",
  inputMode = "numeric",
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  error?: string;
  hint?: string;
  disabled?: boolean;
  unit?: string;
  placeholder?: string;
  inputMode?: "numeric" | "decimal";
  className?: string;
}) {
  return (
    <Field label={unit ? `${label} (${unit})` : label} htmlFor={id} error={error} hint={hint} className={className}>
      <Input
        id={id}
        inputMode={inputMode}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        className="max-w-48"
      />
    </Field>
  );
}

/** Wandelt ein Zahlenfeld in eine ganze Zahl (leer = null). Gibt bei ungültiger Eingabe eine Meldung zurück. */
export function parseIntField(raw: string, label: string): { value: number | null; error?: string } {
  const s = raw.trim();
  if (s === "") return { value: null };
  if (!/^\d{1,6}$/.test(s)) return { value: null, error: `${label}: Bitte eine ganze Zahl ohne Vorzeichen angeben.` };
  return { value: Number(s) };
}
