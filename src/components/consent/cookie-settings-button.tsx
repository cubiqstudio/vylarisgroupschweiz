"use client";

import type { ReactNode } from "react";
import { useMessages } from "@/i18n/client";
import { consent } from "@/i18n/consent";
import { useConsent } from "./use-consent";

/** Öffnet den Cookie-Einstellungs-Dialog, z. B. als Link „Cookie-Einstellungen“ im Footer (innerhalb des ConsentProvider). */
export function CookieSettingsButton({ className, children }: { className?: string; children?: ReactNode }) {
  const { open } = useConsent();
  const m = useMessages(consent);
  return (
    <button type="button" onClick={open} aria-haspopup="dialog" className={className}>
      {children ?? m.settingsButton}
    </button>
  );
}
