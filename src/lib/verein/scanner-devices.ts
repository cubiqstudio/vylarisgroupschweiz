// Verwaltung der Scanner-Geräte (Türkontrolle mit der Android-App «Vylaris Scanner»): anlegen, sperren, wieder aktivieren, löschen.
// Recht: Modul «system», schreibende Aktionen nur mit Schreibrecht. Jede Änderung steht im Änderungsprotokoll (scanner.device.*), der
// Akteur ist die ausführende Person aus der Verwaltung. Das Token (Klartext) erscheint genau einmal, in der Antwort von
// createScannerDevice; in der Datenbank liegt nur der SHA-256-Hash (src/lib/scanner-token.ts), nie im Protokoll oder im Log.
// Die Anmeldung der Geräte an der Schnittstelle v1 steht in src/lib/scanner.ts.
import "server-only";
import { z } from "zod";
import { ApiError } from "@/lib/api";
import type { CurrentAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateScannerToken } from "@/lib/scanner-token";
import { site } from "@/lib/site";
import { auditActor, logAudit } from "./audit";
import { qrShape, type QrShape } from "./membership-card";
import { canAccess } from "./permissions";
import { text } from "./validation";

type Actor = Pick<CurrentAdmin, "id" | "name" | "roles">;

export const SCANNER_LABEL_MAX = 60;

export const scannerDeviceCreateSchema = z.object({
  label: text(1, SCANNER_LABEL_MAX, "Bitte eine Bezeichnung angeben."),
  canCheckIn: z.boolean().default(true),
});
export type ScannerDeviceCreateInput = z.infer<typeof scannerDeviceCreateSchema>;

/** Änderung eines Geräts: sperren/aktivieren (`active`) oder «darf einchecken» ändern. Mindestens ein Feld. */
export const scannerDevicePatchSchema = z
  .object({ active: z.boolean(), canCheckIn: z.boolean() })
  .partial()
  .strict()
  .refine((v) => v.active !== undefined || v.canCheckIn !== undefined, { message: "Keine Änderung angegeben." });
export type ScannerDevicePatch = z.infer<typeof scannerDevicePatchSchema>;

/** Gerät in der Verwaltung: nie mit Token oder Hash, nur mit Hinweis (Anfang des Tokens). */
export type ScannerDeviceRow = {
  id: string;
  label: string;
  tokenHint: string;
  canCheckIn: boolean;
  active: boolean;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
};

const rowSelect = { id: true, label: true, tokenHint: true, canCheckIn: true, active: true, createdAt: true, lastUsedAt: true, revokedAt: true } as const;

/**
 * Inhalt des Kopplungs-QR-Codes: vylarisscanner://pair?server=<URL-kodierte Basis-URL>&token=<Token>.
 * Die Basis-URL kommt aus der Konfiguration (site.url, SITE_URL), nie aus dem Host-Header der Anfrage.
 */
export function scannerPairingUrl(token: string, baseUrl: string = site.url): string {
  const server = baseUrl.replace(/\/+$/, "");
  return `vylarisscanner://pair?server=${encodeURIComponent(server)}&token=${encodeURIComponent(token)}`;
}

export async function listScannerDevices(): Promise<ScannerDeviceRow[]> {
  return db.scannerDevice.findMany({ orderBy: [{ createdAt: "desc" }, { id: "asc" }], select: rowSelect });
}

/** Schreibrecht auf «system» (Inhaber, Administration oder entsprechend eingestellte Rolle); sonst 403. */
function assertCanWrite(admin: Actor): void {
  if (!canAccess(admin.roles, "system", "write")) throw new ApiError(403, "FORBIDDEN", "Dafür fehlt dir die Berechtigung.");
}

function notFound(): never {
  throw new ApiError(404, "NOT_FOUND", "Gerät nicht gefunden.");
}

/** Legt ein Gerät an. Das Token steht NUR in dieser Rückgabe (und im daraus berechneten Kopplungs-Link und QR-Code). */
export async function createScannerDevice(
  admin: Actor,
  input: ScannerDeviceCreateInput,
): Promise<{ device: ScannerDeviceRow; token: string; pairingUrl: string; qr: QrShape }> {
  assertCanWrite(admin);
  const { token, tokenHash, tokenHint } = generateScannerToken();
  const device = await db.$transaction(async (tx) => {
    const row = await tx.scannerDevice.create({ data: { label: input.label, canCheckIn: input.canCheckIn, tokenHash, tokenHint }, select: rowSelect });
    await logAudit(tx, {
      actor: auditActor(admin),
      action: "scanner.device.create",
      objectType: "ScannerDevice",
      objectId: row.id,
      summary: `Scanner-Gerät «${row.label}» angelegt${row.canCheckIn ? "" : " (darf nicht einchecken)"}`,
      after: { label: row.label, canCheckIn: row.canCheckIn, active: row.active },
    });
    return row;
  });
  const pairingUrl = scannerPairingUrl(token);
  return { device, token, pairingUrl, qr: qrShape(pairingUrl) };
}

/** Sperrt oder aktiviert ein Gerät und/oder ändert «darf einchecken». Unveränderte Werte erzeugen keinen Protokolleintrag. */
export async function updateScannerDevice(admin: Actor, id: string, patch: ScannerDevicePatch): Promise<ScannerDeviceRow> {
  assertCanWrite(admin);
  return db.$transaction(async (tx) => {
    const before = await tx.scannerDevice.findUnique({ where: { id }, select: rowSelect });
    if (!before) notFound();
    const data: { active?: boolean; revokedAt?: Date | null; canCheckIn?: boolean } = {};
    const actor = auditActor(admin);
    const base = { actor, objectType: "ScannerDevice", objectId: id } as const;

    if (patch.active !== undefined && patch.active !== before.active) {
      data.active = patch.active;
      data.revokedAt = patch.active ? null : new Date();
    }
    if (patch.canCheckIn !== undefined && patch.canCheckIn !== before.canCheckIn) data.canCheckIn = patch.canCheckIn;
    if (Object.keys(data).length === 0) return before;

    const after = await tx.scannerDevice.update({ where: { id }, data, select: rowSelect });
    if (data.active !== undefined) {
      await logAudit(tx, {
        ...base,
        action: data.active ? "scanner.device.activate" : "scanner.device.revoke",
        summary: `Scanner-Gerät «${after.label}» ${data.active ? "wieder aktiviert" : "gesperrt"}`,
        before: { label: before.label, active: before.active },
        after: { label: after.label, active: after.active },
      });
    }
    if (data.canCheckIn !== undefined) {
      await logAudit(tx, {
        ...base,
        action: "scanner.device.update",
        summary: `Scanner-Gerät «${after.label}»: ${data.canCheckIn ? "darf jetzt einchecken" : "darf nicht mehr einchecken"}`,
        before: { label: before.label, canCheckIn: before.canCheckIn },
        after: { label: after.label, canCheckIn: after.canCheckIn },
      });
    }
    return after;
  });
}

/** Löscht ein Gerät endgültig; sein Token ist danach nie wieder gültig. */
export async function deleteScannerDevice(admin: Actor, id: string): Promise<void> {
  assertCanWrite(admin);
  await db.$transaction(async (tx) => {
    const row = await tx.scannerDevice.findUnique({ where: { id }, select: { id: true, label: true, canCheckIn: true, active: true } });
    if (!row) notFound();
    await tx.scannerDevice.delete({ where: { id } });
    await logAudit(tx, {
      actor: auditActor(admin),
      action: "scanner.device.delete",
      objectType: "ScannerDevice",
      objectId: id,
      summary: `Scanner-Gerät «${row.label}» gelöscht`,
      before: { label: row.label, canCheckIn: row.canCheckIn, active: row.active },
    });
  });
}
