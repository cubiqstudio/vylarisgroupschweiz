"use client";

import { createContext } from "react";

export type ConsentChoice = Readonly<Record<string, boolean>>;

export interface ConsentApi {
  /** false = Server-Render/Hydration, Zustand noch nicht bekannt (Banner dann nicht zeigen) */
  ready: boolean;
  /** Besucher hat eine Entscheidung getroffen (und sie ist für die aktuelle Version gültig) */
  decided: boolean;
  /** Alle optionalen Kategorien annehmen (aktuell gibt es keine) und die Entscheidung merken */
  accept: () => void;
  /** Auswahl speichern: { [kategorieId]: true/false }; "necessary" ist immer aktiv */
  save: (choice: ConsentChoice) => void;
  /** Entscheidung verwerfen → Banner erscheint erneut */
  reset: () => void;
  /** Einstellungs-Dialog öffnen */
  open: () => void;
  /** Einstellungs-Dialog schließen */
  close: () => void;
  settingsOpen: boolean;
  /** Ist für die Kategorie zugestimmt? "necessary" ist immer true. */
  hasConsent: (categoryId: string) => boolean;
}

/** Rückfallwert außerhalb des Providers: nichts passiert, nichts bricht. */
export const fallbackConsent: ConsentApi = {
  ready: false,
  decided: false,
  accept: () => {},
  save: () => {},
  reset: () => {},
  open: () => {},
  close: () => {},
  settingsOpen: false,
  hasConsent: (id) => id === "necessary",
};

export const ConsentContext = createContext<ConsentApi>(fallbackConsent);
