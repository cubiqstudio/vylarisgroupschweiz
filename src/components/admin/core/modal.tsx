"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { useLocale } from "@/i18n/client";
import { cn } from "@/lib/utils";

/**
 * Modaler Dialog auf Basis von <dialog>.showModal(): der Browser stellt Fokusfalle,
 * Inertness des Hintergrunds und Fokus-Rückgabe bereit. Escape und Klick auf den
 * Hintergrund schließen (sofern `dismissible`). Kinder werden nur gerendert, solange offen.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = "md",
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
  dismissible?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();
  const closeLabel = useLocale() === "en" ? "Close dialog" : "Dialog schließen";

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open) {
      if (!el.open) {
        el.showModal();
        // React-`autoFocus` greift hier nicht (der Dialog ist beim Mounten noch geschlossen):
        // gewünschtes Element selbst fokussieren, sonst landet der Fokus auf dem Schließen-Button.
        const target = el.querySelector<HTMLElement>("[data-autofocus], input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled])");
        target?.focus();
      }
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
    if (el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        e.preventDefault();
        if (dismissible) onClose();
      }}
      onMouseDown={(e) => {
        if (dismissible && e.target === e.currentTarget) onClose();
      }}
      className={cn(
        "m-auto w-[calc(100%-2rem)] overflow-visible bg-transparent p-0 text-zinc-200 backdrop:bg-black/70 backdrop:backdrop-blur-sm",
        size === "sm" && "max-w-md",
        size === "md" && "max-w-xl",
        size === "lg" && "max-w-3xl",
      )}
    >
      {open && (
        <div className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl shadow-black/60">
          <div className="flex items-start justify-between gap-4 border-b border-zinc-800 px-5 py-4">
            <div className="min-w-0">
              <h2 id={titleId} className="text-base font-semibold tracking-tight text-white">
                {title}
              </h2>
              {description && (
                <p id={descId} className="mt-1 text-sm text-zinc-400">
                  {description}
                </p>
              )}
            </div>
            {dismissible && (
              <button
                type="button"
                onClick={onClose}
                aria-label={closeLabel}
                className="-mr-1.5 -mt-1 rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            )}
          </div>
          <div className="px-5 py-5">{children}</div>
        </div>
      )}
    </dialog>
  );
}
