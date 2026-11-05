"use client";

import { useContext } from "react";
import { ConsentContext, type ConsentApi } from "./consent-context";

export type { ConsentApi, ConsentChoice } from "./consent-context";

/** Zugriff auf den Einwilligungs-Zustand: { decided, accept, save, reset, open, hasConsent, … }. */
export function useConsent(): ConsentApi {
  return useContext(ConsentContext);
}
