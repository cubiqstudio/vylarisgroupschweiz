import { CONSENT_VERSION, STORAGE_KEY, optionalCategories } from "./consent-config";

/**
 * Kleiner externer Speicher für die Einwilligung (für useSyncExternalStore).
 * Quelle der Wahrheit ist localStorage; Tab-Sync über das "storage"-Ereignis, Sync innerhalb des Tabs über Listener.
 * Ist localStorage nicht nutzbar (blockiert, privater Modus, Kontingent), wird NICHTS gespeichert: die Auswahl gilt
 * dann nur im Arbeitsspeicher dieser Seite, damit der Hinweis nach "Verstanden" nicht ständig wieder aufspringt.
 */

/** Marker für das Server-Rendering / die Hydration: Zustand noch unbekannt. */
export const SERVER_SNAPSHOT = "__ssr__";

export interface StoredConsent {
  decided: boolean;
  /** Zugestimmte optionale Kategorie-IDs ("necessary" ist implizit immer aktiv). */
  accepted: readonly string[];
  /** Zeitpunkt der Entscheidung (ISO) */
  decidedAt: string | null;
}

export const UNDECIDED: StoredConsent = { decided: false, accepted: [], decidedAt: null };

let memoryOnly = false;
let memoryValue: string | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export function getSnapshot(): string | null {
  if (memoryOnly) return memoryValue;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return memoryValue;
  }
}

export function getServerSnapshot(): string {
  return SERVER_SNAPSHOT;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function parseConsent(raw: string | null): StoredConsent {
  if (!raw || raw === SERVER_SNAPSHOT) return UNDECIDED;
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== "object" || data === null) return UNDECIDED;
    const rec = data as { v?: unknown; at?: unknown; accepted?: unknown };
    if (rec.v !== CONSENT_VERSION || !Array.isArray(rec.accepted)) return UNDECIDED;
    const known = new Set(optionalCategories.map((c) => c.id));
    const accepted = rec.accepted.filter((x): x is string => typeof x === "string" && known.has(x));
    return { decided: true, accepted, decidedAt: typeof rec.at === "string" ? rec.at : null };
  } catch {
    return UNDECIDED;
  }
}

/** Speichert die Auswahl; `accepted` wird auf bekannte optionale Kategorien begrenzt. */
export function writeConsent(accepted: readonly string[]): void {
  const known = new Set(optionalCategories.map((c) => c.id));
  const clean = Array.from(new Set(accepted.filter((id) => known.has(id))));
  const raw = JSON.stringify({ v: CONSENT_VERSION, at: new Date().toISOString(), accepted: clean });
  memoryValue = raw;
  try {
    window.localStorage.setItem(STORAGE_KEY, raw);
    if (window.localStorage.getItem(STORAGE_KEY) !== raw) throw new Error("not persisted");
    memoryOnly = false;
  } catch {
    memoryOnly = true;
  }
  notify();
}

export function clearConsent(): void {
  memoryValue = null;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    memoryOnly = true;
  }
  notify();
}
