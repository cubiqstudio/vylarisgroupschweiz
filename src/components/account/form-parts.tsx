import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** aria-Attribute für ein Feld mit Fehler-/Hinweistext (IDs: `${id}-error`, `${id}-hint`). */
export function fieldA11y(id: string, error?: string, hint?: boolean) {
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ");
  return { "aria-invalid": error ? true : undefined, "aria-describedby": describedBy || undefined } as const;
}

export function FieldBox({
  id,
  label,
  error,
  hint,
  aside,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  /** Zusätzlicher Inhalt rechts neben dem Label (z. B. "Passwort vergessen?"). */
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="block text-sm font-medium text-zinc-300">
          {label}
        </label>
        {aside}
      </div>
      {children}
      {hint && (
        <div id={`${id}-hint`} className="text-xs leading-relaxed text-zinc-500">
          {hint}
        </div>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-rose-400">
          {error}
        </p>
      )}
    </div>
  );
}

export function FormAlert({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      role="alert"
      className={cn("flex items-start gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200", className)}
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 space-y-3">{children}</div>
    </div>
  );
}

export function FormSuccess({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      role="status"
      className={cn("flex items-start gap-3 rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-200", className)}
    >
      <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export const textLink = "text-emerald-400 underline underline-offset-4 hover:text-emerald-300";
