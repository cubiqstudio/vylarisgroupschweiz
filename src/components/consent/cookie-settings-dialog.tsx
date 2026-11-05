"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Info, Lock, X } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useMessages } from "@/i18n/client";
import { consent } from "@/i18n/consent";
import { getNecessaryCategory, getStorageNote, optionalCategories, type ConsentCategory } from "./consent-config";
import { ConsentMark } from "./consent-mark";
import { consentButtonPrimary, consentButtonSecondary, consentLink } from "./consent-styles";
import { useConsent } from "./use-consent";

const panel = "rounded-xl bg-zinc-900/50 p-4 ring-1 ring-inset ring-zinc-800 dark:bg-white/5 dark:ring-white/15";
const muted = "text-zinc-400 dark:text-zinc-300";
const th = "py-1.5 pr-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400";
const td = "py-2 pr-3 align-top text-sm";

function CookieTable({ rows, caption }: { rows: readonly { name: string; purpose: string; duration: string }[]; caption: string }) {
  const { dialog } = useMessages(consent);
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[26rem] border-collapse">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-zinc-800 dark:border-white/15">
            <th scope="col" className={th}>{dialog.colName}</th>
            <th scope="col" className={th}>{dialog.colPurpose}</th>
            <th scope="col" className={cn(th, "pr-0")}>{dialog.colDuration}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800 dark:divide-white/10">
          {rows.map((r) => (
            <tr key={r.name}>
              <th scope="row" className={cn(td, "text-left font-mono text-xs font-semibold text-white dark:text-zinc-100")}>{r.name}</th>
              <td className={cn(td, muted)}>{r.purpose}</td>
              <td className={cn(td, "pr-0", muted)}>{r.duration}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OptionalCategory({ category, checked, onChange }: { category: ConsentCategory; checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  const { dialog } = useMessages(consent);
  return (
    <section className={panel} aria-labelledby={`${id}-h`}>
      <div className="flex items-start justify-between gap-3">
        <h3 id={`${id}-h`} className="text-sm font-semibold text-white dark:text-zinc-100">{category.name}</h3>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-zinc-300 dark:text-zinc-200">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            className="size-4 rounded border-zinc-600 accent-emerald-400"
          />
          {dialog.allow}
        </label>
      </div>
      <p className={cn("mt-1.5 text-sm leading-relaxed", muted)}>{category.purpose}</p>
      {category.cookies.length > 0 && <CookieTable rows={category.cookies} caption={dialog.categoryCaption(category.name)} />}
    </section>
  );
}

function SettingsBody({ markLight, markDark, titleId, onClose }: { markLight: string | null; markDark: string | null; titleId: string; onClose: () => void }) {
  const { save, hasConsent } = useConsent();
  const m = useMessages(consent);
  const { dialog } = m;
  const necessaryCategory = getNecessaryCategory(m);
  // Wird nur eingehängt, solange der Dialog offen ist → Startwerte entsprechen immer der gespeicherten Auswahl.
  const [choice, setChoice] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(optionalCategories.map((c) => [c.id, hasConsent(c.id)])),
  );

  return (
    <>
      <div className="flex items-start gap-3.5 border-b border-zinc-800 px-5 py-4 dark:border-white/15">
        <ConsentMark light={markLight} dark={markDark} />
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-base font-semibold leading-tight tracking-tight text-white dark:text-zinc-100">
            {dialog.title}
          </h2>
          <p className={cn("mt-1 text-sm", muted)}>{dialog.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={dialog.closeLabel}
          className="-mr-1.5 -mt-1 rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-white dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-100"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          save(choice);
          onClose();
        }}
      >
        <div className="space-y-3 px-5 py-5">
          <section className={panel} aria-labelledby={`${titleId}-necessary`}>
            <div className="flex items-start justify-between gap-3">
              <h3 id={`${titleId}-necessary`} className="text-sm font-semibold text-white dark:text-zinc-100">{necessaryCategory.name}</h3>
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-950 px-2.5 py-0.5 text-xs font-semibold text-emerald-300 ring-1 ring-inset ring-emerald-800 dark:bg-white/10 dark:text-ondark-link dark:ring-white/20">
                <Lock className="size-3" aria-hidden="true" />
                {dialog.alwaysActive}
              </span>
            </div>
            <p className={cn("mt-1.5 text-sm leading-relaxed", muted)}>{necessaryCategory.purpose}</p>
            <CookieTable rows={necessaryCategory.cookies} caption={dialog.necessaryCaption} />
            <p className={cn("mt-3 text-xs leading-relaxed", muted)}>
              {dialog.cookieNote}
            </p>
          </section>

          {optionalCategories.map((c) => (
            <OptionalCategory key={c.id} category={c} checked={choice[c.id] ?? false} onChange={(v) => setChoice((prev) => ({ ...prev, [c.id]: v }))} />
          ))}

          {optionalCategories.length === 0 && (
            <p className={cn("flex items-start gap-2 text-sm", muted)}>
              <Info className="mt-0.5 size-4 shrink-0 text-emerald-400 dark:text-ondark-link" aria-hidden="true" />
              <span>{dialog.noOptional}</span>
            </p>
          )}

          <div className={panel}>
            <h3 className="text-sm font-semibold text-white dark:text-zinc-100">{dialog.storageTitle}</h3>
            <CookieTable rows={[getStorageNote(m)]} caption={dialog.storageCaption} />
          </div>

          <p className={cn("text-xs", muted)}>
            {dialog.detailsBefore}
            <Link href={m.privacyHref} onClick={onClose} className={consentLink}>
              {m.privacyLink}
            </Link>
            {dialog.detailsAfter}
          </p>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-zinc-800 px-5 py-4 min-[400px]:flex-row min-[400px]:justify-end dark:border-white/15">
          <button type="button" onClick={onClose} className={buttonClass("secondary", "md", consentButtonSecondary)}>
            {dialog.cancel}
          </button>
          <button type="submit" className={buttonClass("primary", "md", consentButtonPrimary)}>
            {dialog.save}
          </button>
        </div>
      </form>
    </>
  );
}

/**
 * Einstellungs-Dialog auf Basis von <dialog>.showModal() (Fokusfalle, inerter Hintergrund, Fokus-Rückgabe durch den
 * Browser). Escape und Klick auf den Hintergrund schließen ihn, ohne zu speichern.
 */
export function CookieSettingsDialog({ markLight, markDark }: { markLight: string | null; markDark: string | null }) {
  const { settingsOpen, close } = useConsent();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (settingsOpen) {
      if (!el.open) el.showModal();
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
    if (el.open) el.close();
  }, [settingsOpen]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClose={close}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-xl overflow-visible bg-transparent p-0 text-zinc-400 backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      {settingsOpen && (
        <div className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl bg-surface shadow-2xl shadow-navy/30 ring-1 ring-zinc-800 dark:bg-ink dark:ring-white/15">
          <div aria-hidden="true" className="h-1 bg-gradient-to-r from-emerald-400 via-indigo-400 to-emerald-400" />
          <SettingsBody markLight={markLight} markDark={markDark} titleId={titleId} onClose={close} />
        </div>
      )}
    </dialog>
  );
}
