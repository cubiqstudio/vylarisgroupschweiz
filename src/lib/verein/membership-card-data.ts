// Mitgliederausweis: Token mit dem Geheimnis der Installation signieren und die öffentliche Prüfung auflösen. Reine Teile: ./membership-card.ts.
import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { authSecretString } from "@/lib/session";
import { publicUrl } from "./links";
import { cardValidity, shortDisplayName, signCardToken, verifyCardToken } from "./membership-card";
import { getVereinName } from "./profile";

/** Eigenes Geheimnis für die Ausweise, aus AUTH_SECRET abgeleitet (ein anderes Token der Seite lässt sich damit nie fälschen). */
const cardSecret = (): string => createHash("sha256").update(`vgs-ausweis-v1:${authSecretString()}`).digest("hex");

export const cardToken = (memberId: string): string => signCardToken(cardSecret(), memberId);

/** Adresse der Prüfseite für den QR-Code: feste Basis-URL, nie aus dem Host-Header. */
export const cardVerifyUrl = (memberId: string): string => publicUrl(`/verein/pruefen/${encodeURIComponent(cardToken(memberId))}`);

export type CardCheck = { valid: false } | { valid: true; shortName: string; memberNumber: number; clubName: string };

/**
 * Prüft ein Token aus dem QR-Code. Gültig sind nur aktuelle Mitglieder (Status AKTIV, nicht anonymisiert, Austritt nicht überschritten).
 * Bei «nicht gültig» wird nichts über die Person verraten (kein Name, kein Grund).
 */
export async function checkCardToken(token: string, now: Date = new Date()): Promise<CardCheck> {
  const memberId = verifyCardToken(cardSecret(), token);
  if (!memberId) return { valid: false };
  const m = await db.member.findUnique({
    where: { id: memberId },
    select: { firstName: true, lastName: true, memberNumber: true, status: true, joinedAt: true, leftAt: true, exitNoticeAt: true, anonymizedAt: true },
  });
  if (!m || !cardValidity(m, now).valid) return { valid: false };
  return { valid: true, shortName: shortDisplayName(m.firstName, m.lastName), memberNumber: m.memberNumber, clubName: await getVereinName() };
}
