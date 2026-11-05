"use client";

import { useCallback, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { optionalCategories } from "./consent-config";
import { ConsentContext, type ConsentApi, type ConsentChoice } from "./consent-context";
import {
  SERVER_SNAPSHOT,
  clearConsent,
  getServerSnapshot,
  getSnapshot,
  parseConsent,
  subscribe,
  writeConsent,
} from "./consent-store";

/**
 * Stellt den Einwilligungs-Zustand bereit (siehe useConsent). Zustand liegt im localStorage, wird zwischen Tabs
 * synchronisiert und ist beim Server-Render bewusst "unbekannt" (ready=false), damit kein Banner-Flackern entsteht.
 */
export function ConsentProvider({ children }: { children: ReactNode }) {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const stored = useMemo(() => parseConsent(raw), [raw]);
  const ready = raw !== SERVER_SNAPSHOT;

  const accept = useCallback(() => writeConsent(optionalCategories.map((c) => c.id)), []);
  const save = useCallback((choice: ConsentChoice) => {
    writeConsent(Object.keys(choice).filter((id) => choice[id] === true));
  }, []);
  const reset = useCallback(() => clearConsent(), []);
  const open = useCallback(() => setSettingsOpen(true), []);
  const close = useCallback(() => setSettingsOpen(false), []);
  const hasConsent = useCallback(
    (id: string) => id === "necessary" || (stored.decided && stored.accepted.includes(id)),
    [stored],
  );

  const value = useMemo<ConsentApi>(
    () => ({ ready, decided: stored.decided, accept, save, reset, open, close, settingsOpen, hasConsent }),
    [ready, stored.decided, accept, save, reset, open, close, settingsOpen, hasConsent],
  );

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}
