// Lizenzen: Schlüssel erzeugen, speichern (nur als HMAC + verschlüsselt), beantragen, freigeben und per API prüfen.
// Sicherheitsprinzipien:
//  - Schlüssel haben 100 Bit Zufall (nicht erratbar) und liegen nie im Klartext in der DB (keyHash = HMAC, keyEnc = AES-GCM).
//  - Die Prüfung per API verlangt ein Token (ApiClient, nur als Hash gespeichert), Schlüssel im POST-Body (nie in URLs), Rate-Limits,
//    einheitliche Antworten bei ungültigen Schlüsseln und eine HMAC-Signatur der Antwort (Schutz vor Manipulation auf dem Weg).
//  - Ein Schlüssel wird beim ersten Prüfen an eine Installation (instance) gebunden und gilt nur dort.
import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { LicenseKey, Product, WebspaceRequest } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { authSecretString } from "@/lib/session";
import {
  notifyBusinessDecision,
  notifyKeyDecision,
  notifyTeamNewBusinessRequest,
  notifyTeamNewKeyRequest,
  notifyTeamNewWebspaceRequest,
  notifyWebspaceDecision,
} from "@/lib/license-mail";

// ---- Schlüssel ----------------------------------------------------------------------------------------------------

/** 32 Zeichen ohne I und O (verwechselbar mit 1/0): jedes Zeichen trägt genau 5 Bit. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const KEY_RE = /^VGS-[A-Z]{3,4}-[A-HJ-NP-Z2-9]{5}(-[A-HJ-NP-Z2-9]{5}){3}$/;

/** Neuer Schlüssel im Format VGS-<CODE>-XXXXX-XXXXX-XXXXX-XXXXX (100 Bit Zufall). Das Präfix VGS macht ihn als Schweizer Schlüssel erkennbar. */
export function generateKey(code: string): string {
  const bytes = randomBytes(20);
  const chars = Array.from(bytes, (b) => ALPHABET[b & 31]!);
  const groups = [0, 5, 10, 15].map((i) => chars.slice(i, i + 5).join(""));
  return `VGS-${code.toUpperCase()}-${groups.join("-")}`;
}

/** Eingabe vereinheitlichen (Leerzeichen, Kleinbuchstaben) und Format prüfen; null = kein gültiges Format. */
export function normalizeKey(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 60) return null;
  const k = raw.replace(/\s+/g, "").toUpperCase();
  return KEY_RE.test(k) ? k : null;
}

/**
 * Geheimnis für Schlüssel-Hashes und Antwort-Signaturen: LICENSE_SECRET, sonst AUTH_SECRET dieser Instanz.
 * Es ist nie mit einer anderen Installation geteilt, fremde Schlüssel und Signaturen werden daher nie als gültig erkannt.
 */
function licenseSecret(): string {
  const s = process.env.LICENSE_SECRET;
  if (s && s.length >= 32) return s;
  if (s && process.env.NODE_ENV === "production") throw new Error("LICENSE_SECRET ist kürzer als 32 Zeichen.");
  return authSecretString();
}

const hmacKey = () => createHash("sha256").update(`vgs-license-v1:${licenseSecret()}`).digest();
export const hashKey = (key: string) => createHmac("sha256", hmacKey()).update(key).digest("hex");
export const keyHint = (key: string) => key.replace(/-/g, "").slice(-4);

/** Klartext-Schlüssel des Besitzers (nur für aktive Schlüssel anzeigen). */
export const revealKey = (row: Pick<LicenseKey, "keyEnc">): string | null => decryptSecret(row.keyEnc);

// ---- Berechtigung -------------------------------------------------------------------------------------------------

export type Eligibility =
  | { mode: "key"; approval: "AUTO" | "MANUAL" }
  /** Kein Schlüssel möglich, aber ein Konto kann beantragt werden (Webspace-Konto). */
  | { mode: "account" }
  | { mode: "none"; reason: "inactive" | "business_only" };

export function eligibilityFor(
  product: Pick<Product, "active" | "businessOnly" | "allowAccountRequest" | "approvalMode">,
  user: { businessStatus: string },
): Eligibility {
  if (!product.active) return { mode: "none", reason: "inactive" };
  if (product.businessOnly && user.businessStatus !== "APPROVED") {
    return product.allowAccountRequest ? { mode: "account" } : { mode: "none", reason: "business_only" };
  }
  return { mode: "key", approval: product.approvalMode === "MANUAL" ? "MANUAL" : "AUTO" };
}

async function loadActiveUser(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, disabled: true, emailVerifiedAt: true, businessStatus: true, companyName: true },
  });
  if (!user || user.disabled || !user.emailVerifiedAt) throw new ApiError(403, "FORBIDDEN", "Dein Konto ist dafür nicht freigeschaltet.");
  return user;
}

async function loadProduct(slug: string) {
  const product = await db.product.findUnique({ where: { slug } });
  if (!product || !product.active) throw new ApiError(404, "NOT_FOUND", "Dieses Produkt gibt es nicht.");
  return product;
}

// ---- Nutzer: beantragen -------------------------------------------------------------------------------------------

export type KeyDto = {
  id: string;
  status: string;
  hint: string;
  /** Nur bei aktiven Schlüsseln. */
  key: string | null;
  message: string;
  adminNote: string;
  createdAt: Date;
  bound: boolean;
};

export const toKeyDto = (k: LicenseKey): KeyDto => ({
  id: k.id,
  status: k.status,
  hint: k.keyHint,
  key: k.status === "ACTIVE" ? revealKey(k) : null,
  message: k.message,
  adminNote: k.adminNote,
  createdAt: k.createdAt,
  bound: Boolean(k.boundInstance),
});

/** Schlüssel für ein Produkt beantragen: je Nutzer und Produkt nur einer. Automatische Ausstellung oder Freigabe durch das Team. */
export async function requestKey(userId: string, productSlug: string, message: string): Promise<KeyDto> {
  const user = await loadActiveUser(userId);
  const product = await loadProduct(productSlug);
  const el = eligibilityFor(product, user);
  if (el.mode === "none") {
    throw new ApiError(
      403,
      "NOT_ELIGIBLE",
      el.reason === "business_only" ? "Für dieses Produkt gibt es Schlüssel nur für freigegebene Firmenkunden." : "Dieses Produkt ist derzeit nicht verfügbar.",
    );
  }
  if (el.mode === "account") {
    throw new ApiError(403, "NOT_ELIGIBLE", "Für dieses Produkt gibt es Schlüssel nur für Firmenkunden. Du kannst stattdessen ein Konto beantragen.");
  }

  const existing = await db.licenseKey.findUnique({ where: { userId_productId: { userId, productId: product.id } } });
  if (existing && existing.status !== "REJECTED") {
    throw new ApiError(
      409,
      "ALREADY_EXISTS",
      existing.status === "PENDING"
        ? "Dein Antrag für dieses Produkt wartet auf Freigabe."
        : existing.status === "REVOKED"
          ? "Dein Schlüssel für dieses Produkt wurde gesperrt. Bitte wende dich an den Support."
          : "Du hast für dieses Produkt bereits einen Schlüssel.",
    );
  }

  const key = generateKey(product.code);
  const auto = el.approval === "AUTO";
  const data = {
    keyHash: hashKey(key),
    keyEnc: encryptSecret(key),
    keyHint: keyHint(key),
    status: auto ? "ACTIVE" : "PENDING",
    message: message.trim(),
    adminNote: "",
    boundInstance: null,
    boundAt: null,
    decidedAt: auto ? new Date() : null,
    lastVerifiedAt: null,
    verifyCount: 0,
  };
  try {
    const row = existing
      ? await db.licenseKey.update({ where: { id: existing.id }, data })
      : await db.licenseKey.create({ data: { ...data, userId, productId: product.id } });
    // Nur wartende Anträge (approvalMode MANUAL) brauchen eine Entscheidung des Teams.
    if (!auto) notifyTeamNewKeyRequest(row.id);
    return toKeyDto(row);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ApiError(409, "ALREADY_EXISTS", "Du hast für dieses Produkt bereits einen Schlüssel.");
    }
    throw e;
  }
}

/** Konto für den Webspace beantragen (für alle, die keinen Firmenkunden-Schlüssel bekommen). */
export async function requestWebspaceAccount(userId: string, productSlug: string, message: string): Promise<WebspaceRequest> {
  const user = await loadActiveUser(userId);
  const product = await loadProduct(productSlug);
  if (!product.allowAccountRequest) throw new ApiError(403, "NOT_ELIGIBLE", "Für dieses Produkt kann kein Konto beantragt werden.");
  if (eligibilityFor(product, user).mode !== "account") {
    throw new ApiError(403, "NOT_ELIGIBLE", "Als Firmenkunde beantragst du einen Lizenzschlüssel statt eines Kontos.");
  }
  const existing = await db.webspaceRequest.findUnique({ where: { userId_productId: { userId, productId: product.id } } });
  if (existing && existing.status !== "REJECTED") {
    throw new ApiError(409, "ALREADY_EXISTS", existing.status === "APPROVED" ? "Dein Konto wurde bereits freigegeben." : "Dein Antrag wartet auf Bearbeitung.");
  }
  const data = { status: "PENDING", message: message.trim(), adminNote: "", decidedAt: null };
  try {
    const row = existing
      ? await db.webspaceRequest.update({ where: { id: existing.id }, data })
      : await db.webspaceRequest.create({ data: { ...data, userId, productId: product.id } });
    notifyTeamNewWebspaceRequest(row.id);
    return row;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ApiError(409, "ALREADY_EXISTS", "Dein Antrag wartet auf Bearbeitung.");
    }
    throw e;
  }
}

/** Firmenkunden-Status beantragen (Freigabe durch das Team). */
export async function requestBusiness(userId: string, companyName: string): Promise<{ businessStatus: string; companyName: string }> {
  const user = await loadActiveUser(userId);
  if (user.businessStatus === "APPROVED") throw new ApiError(409, "ALREADY_EXISTS", "Dein Konto ist bereits als Firmenkunde freigegeben.");
  if (user.businessStatus === "PENDING") throw new ApiError(409, "ALREADY_EXISTS", "Dein Antrag als Firmenkunde wartet auf Freigabe.");
  const updated = await db.user.update({
    where: { id: userId },
    data: { businessStatus: "PENDING", companyName: companyName.trim() },
    select: { businessStatus: true, companyName: true },
  });
  notifyTeamNewBusinessRequest(userId);
  return { businessStatus: updated.businessStatus, companyName: updated.companyName ?? "" };
}

export type ProductDto = {
  slug: string;
  name: string;
  description: string;
  comingSoon: boolean;
  businessOnly: boolean;
  approvalMode: string;
  eligibility: Eligibility;
  key: KeyDto | null;
  webspace: { status: string; message: string; adminNote: string; createdAt: Date } | null;
};

/** Alles für das Nutzer-Dashboard: Produkte mit Berechtigung, eigene Schlüssel/Anträge und Firmenkunden-Status. */
export async function getLicenseOverview(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { businessStatus: true, companyName: true } });
  if (!user) throw new ApiError(401, "UNAUTHORIZED", "Nicht angemeldet.");
  const [products, keys, requests] = await Promise.all([
    db.product.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    db.licenseKey.findMany({ where: { userId } }),
    db.webspaceRequest.findMany({ where: { userId } }),
  ]);
  const items: ProductDto[] = products.map((p) => {
    const k = keys.find((x) => x.productId === p.id);
    const w = requests.find((x) => x.productId === p.id);
    return {
      slug: p.slug,
      name: p.name,
      description: p.description,
      comingSoon: p.comingSoon,
      businessOnly: p.businessOnly,
      approvalMode: p.approvalMode,
      eligibility: eligibilityFor(p, user),
      key: k ? toKeyDto(k) : null,
      webspace: w ? { status: w.status, message: w.message, adminNote: w.adminNote, createdAt: w.createdAt } : null,
    };
  });
  return { business: { status: user.businessStatus, companyName: user.companyName ?? "" }, products: items };
}

// ---- Admin: Entscheidungen ----------------------------------------------------------------------------------------

export type KeyAction = "approve" | "reject" | "revoke" | "reactivate" | "reset-binding";

export async function decideKey(id: string, action: KeyAction, adminNote?: string) {
  const row = await db.licenseKey.findUnique({ where: { id } });
  if (!row) throw new ApiError(404, "NOT_FOUND", "Schlüssel nicht gefunden.");
  const note = adminNote === undefined ? undefined : adminNote.trim();
  const now = new Date();
  const decide = async (status: string, mail?: "approve" | "reject" | "revoke") => {
    const updated = await db.licenseKey.update({ where: { id }, data: { status, decidedAt: now, ...(note !== undefined && { adminNote: note }) } });
    // Mail an die Person im Hintergrund: ein Mailfehler lässt die Entscheidung nie scheitern.
    if (mail) notifyKeyDecision(id, mail);
    return updated;
  };
  switch (action) {
    case "approve":
      if (row.status !== "PENDING") throw new ApiError(409, "CONFLICT", "Nur wartende Anträge können freigegeben werden.");
      return decide("ACTIVE", "approve");
    case "reject":
      if (row.status !== "PENDING") throw new ApiError(409, "CONFLICT", "Nur wartende Anträge können abgelehnt werden.");
      return decide("REJECTED", "reject");
    case "revoke":
      if (row.status !== "ACTIVE") throw new ApiError(409, "CONFLICT", "Nur aktive Schlüssel können gesperrt werden.");
      return decide("REVOKED", "revoke");
    case "reactivate":
      if (row.status !== "REVOKED") throw new ApiError(409, "CONFLICT", "Nur gesperrte Schlüssel können wieder aktiviert werden.");
      return decide("ACTIVE");
    case "reset-binding":
      return db.licenseKey.update({ where: { id }, data: { boundInstance: null, boundAt: null } });
  }
}

export async function decideWebspace(id: string, action: "approve" | "reject", adminNote?: string) {
  const row = await db.webspaceRequest.findUnique({ where: { id } });
  if (!row) throw new ApiError(404, "NOT_FOUND", "Antrag nicht gefunden.");
  if (row.status !== "PENDING") throw new ApiError(409, "CONFLICT", "Dieser Antrag wurde bereits entschieden.");
  const updated = await db.webspaceRequest.update({
    where: { id },
    data: { status: action === "approve" ? "APPROVED" : "REJECTED", decidedAt: new Date(), ...(adminNote !== undefined && { adminNote: adminNote.trim() }) },
  });
  notifyWebspaceDecision(id, action);
  return updated;
}

export async function decideBusiness(userId: string, action: "approve" | "reject" | "reset") {
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, businessStatus: true } });
  if (!user) throw new ApiError(404, "NOT_FOUND", "Nutzer nicht gefunden.");
  const status = action === "approve" ? "APPROVED" : action === "reject" ? "REJECTED" : "NONE";
  const updated = await db.user.update({
    where: { id: userId },
    data: { businessStatus: status, ...(action === "reset" && { companyName: null }) },
    select: { id: true, businessStatus: true, companyName: true },
  });
  // Nur bei tatsächlicher Änderung benachrichtigen (erneutes Speichern im Admin soll keine zweite Mail auslösen).
  if (action !== "reset" && user.businessStatus !== status) notifyBusinessDecision(userId, action);
  return updated;
}

// ---- API-Zugänge und Prüfung ------------------------------------------------------------------------------------

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Schlüssel zum Signieren der Prüfantworten dieses Zugangs (aus LICENSE_SECRET bzw. AUTH_SECRET abgeleitet, wird einmal beim Anlegen angezeigt). */
export const signingKeyFor = (clientId: string) =>
  createHmac("sha256", hmacKey()).update(`sig:${clientId}`).digest("hex");

export async function createApiClient(name: string, productSlugs: string[]) {
  const token = `vgsk_${randomBytes(32).toString("base64url")}`;
  const slugs = productSlugs.length ? productSlugs.join(",") : "*";
  const client = await db.apiClient.create({
    data: { name: name.trim(), tokenHash: sha256(token), tokenHint: token.slice(0, 8), productSlugs: slugs },
  });
  return { client, token, signingKey: signingKeyFor(client.id) };
}

/** Prüft den Authorization-Header (Bearer) und liefert den aktiven Zugang oder null. */
export async function authenticateApiClient(header: string | null) {
  const m = /^Bearer (vgsk_[A-Za-z0-9_-]{20,80})$/.exec(header ?? "");
  if (!m) return null;
  const client = await db.apiClient.findUnique({ where: { tokenHash: sha256(m[1]!) } });
  if (!client || !client.active || client.revokedAt) return null;
  return client;
}

const clientAllows = (productSlugs: string, slug: string) => productSlugs === "*" || productSlugs.split(",").includes(slug);

export type VerifyResult = {
  valid: boolean;
  /** invalid | revoked | instance_mismatch | instance_required – bewusst grob, damit nichts über fremde Schlüssel verraten wird. */
  reason: string | null;
  product: string;
  status: string | null;
  instance: string | null;
  nonce: string;
  ts: number;
  signature: string;
};

/** Signatur über die Antwortfelder (HMAC-SHA256, Schlüssel = signingKeyFor(clientId)). Clients prüfen sie mit timingSafeEqual. */
export function signVerifyResponse(clientId: string, r: Omit<VerifyResult, "signature">): string {
  const payload = [r.valid ? "1" : "0", r.reason ?? "", r.product, r.status ?? "", r.instance ?? "", r.nonce, String(r.ts)].join("|");
  return createHmac("sha256", signingKeyFor(clientId)).update(payload).digest("hex");
}

export async function verifyLicense(
  client: { id: string; productSlugs: string },
  input: { key: string; product: string; instance: string | null; nonce: string },
): Promise<VerifyResult> {
  const base = { product: input.product, instance: input.instance, nonce: input.nonce, ts: Math.floor(Date.now() / 1000) };
  const done = (valid: boolean, reason: string | null, status: string | null): VerifyResult => {
    const r = { valid, reason, status, ...base };
    return { ...r, signature: signVerifyResponse(client.id, r) };
  };

  if (!clientAllows(client.productSlugs, input.product)) return done(false, "invalid", null);
  const row = await db.licenseKey.findUnique({
    where: { keyHash: hashKey(input.key) },
    include: {
      product: { select: { slug: true, active: true, businessOnly: true } },
      user: { select: { disabled: true, businessStatus: true } },
    },
  });
  // Unbekannt, falsches Produkt, wartend, abgelehnt, Produkt abgeschaltet: alles gleich «invalid».
  if (!row || row.product.slug !== input.product || !row.product.active || (row.status !== "ACTIVE" && row.status !== "REVOKED")) {
    return done(false, "invalid", null);
  }
  if (row.status === "REVOKED") return done(false, "revoked", "REVOKED");
  // Gesperrtes Konto oder entzogener Firmenkunden-Status beendet auch bereits ausgestellte Schlüssel.
  if (row.user.disabled || (row.product.businessOnly && row.user.businessStatus !== "APPROVED")) return done(false, "revoked", "REVOKED");

  // Bindung an eine Installation: erste Prüfung bindet, danach muss dieselbe Installation prüfen.
  const sameInstance = (bound: string, given: string) => timingSafeEqual(Buffer.from(sha256(bound)), Buffer.from(sha256(given)));
  let bound = row.boundInstance;
  if (!bound && input.instance) {
    // Atomar: nur die erste gleichzeitige Prüfung bindet; alle anderen sehen danach die Bindung.
    const claimed = await db.licenseKey.updateMany({
      where: { id: row.id, boundInstance: null },
      data: { boundInstance: input.instance, boundAt: new Date(), lastVerifiedAt: new Date(), verifyCount: { increment: 1 } },
    });
    if (claimed.count === 1) return done(true, null, "ACTIVE");
    bound = (await db.licenseKey.findUnique({ where: { id: row.id }, select: { boundInstance: true } }))?.boundInstance ?? null;
  }
  if (bound) {
    if (!input.instance) return done(false, "instance_required", "ACTIVE");
    if (!sameInstance(bound, input.instance)) return done(false, "instance_mismatch", "ACTIVE");
  }
  await db.licenseKey.update({ where: { id: row.id }, data: { lastVerifiedAt: new Date(), verifyCount: { increment: 1 } } });
  return done(true, null, "ACTIVE");
}
