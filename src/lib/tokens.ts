import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";

export type TokenType = "EMAIL_VERIFY" | "PASSWORD_RESET";

export const TOKEN_TTL_MS: Record<TokenType, number> = {
  EMAIL_VERIFY: 48 * 60 * 60 * 1000, // 48 Stunden
  PASSWORD_RESET: 60 * 60 * 1000, // 1 Stunde
};

const hash = (raw: string) => createHash("sha256").update(raw).digest("hex");

/** Erzeugt ein Einmal-Token (im Klartext nur hier und in der Mail; in der DB steht nur der Hash). Ältere offene Tokens gleichen Typs werden entwertet. */
export async function createToken(userId: string, type: TokenType): Promise<string> {
  const raw = randomBytes(32).toString("base64url");
  await db.authToken.deleteMany({ where: { userId, type, usedAt: null } });
  await db.authToken.create({
    data: { userId, type, tokenHash: hash(raw), expiresAt: new Date(Date.now() + TOKEN_TTL_MS[type]) },
  });
  return raw;
}

/** Prüft und verbraucht ein Token atomar. Liefert die userId oder null (unbekannt, abgelaufen, schon benutzt). */
export async function consumeToken(raw: string, type: TokenType): Promise<string | null> {
  const tokenHash = hash(raw);
  const claimed = await db.authToken.updateMany({
    where: { tokenHash, type, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  if (claimed.count !== 1) return null;
  const t = await db.authToken.findUnique({ where: { tokenHash }, select: { userId: true } });
  return t?.userId ?? null;
}
