// Serverseitige Wächter für Admin-Routen, Admin-Seiten und das Mitgliederportal.
//  - API:    const admin = await requireAdminModule(req, "fees");          // Stufe folgt der Methode (GET = lesen, sonst ändern)
//  - Seite:  const admin = await requireModulePage("members", "write");
//  - Portal: const { member } = await requireMember(req);                  // /api/account/** und /api/events/** für Mitglieder
// Grundregel: Der Wächter steht als erste Anweisung jedes Handlers bzw. jeder Seite. Layouts genügen nicht (sie rendern bei der
// Navigation innerhalb des Bereichs nicht neu).
import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { ApiError, assertPasswordChanged, assertRole, assertSameOrigin } from "@/lib/api";
import { getCurrentAdmin, getCurrentUser, type CurrentAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { levelForMethod, canAccess, PASSWORD_CHANGE_PAGE_PATH, type AccessLevel, type VereinModule } from "./permissions";

/** Pfad der Seite «Keine Berechtigung» (angemeldet, aber ohne Recht für diesen Bereich). */
export const FORBIDDEN_PATH = "/admin/keine-berechtigung";

/**
 * Für /api/admin/**-Handler, die mehr verlangen als das Modul des Pfades (oder ein anderes Modul berühren).
 * Prüft Origin, Sitzung und Rolle. Ohne `level` gilt: GET/HEAD = lesen, alles andere = ändern.
 */
export async function requireAdminModule(req: Request, module: VereinModule, level?: AccessLevel): Promise<CurrentAdmin> {
  assertSameOrigin(req);
  const admin = await getCurrentAdmin();
  if (!admin) throw new ApiError(401, "UNAUTHORIZED", "Nicht angemeldet.");
  assertPasswordChanged(admin, new URL(req.url).pathname);
  assertRole(admin, module, level ?? levelForMethod(req.method));
  return admin;
}

/**
 * Für Server-Seiten unter /admin: ohne Admin-Sitzung 404 (der Bereich verrät sich nicht), ohne Recht Weiterleitung auf
 * «Keine Berechtigung». Gibt den Admin zurück.
 */
export async function requireModulePage(module: VereinModule, level: AccessLevel = "read"): Promise<CurrentAdmin> {
  const admin = await getCurrentAdmin();
  if (!admin) notFound();
  // Startpasswort noch nicht geändert: nur die Konto-Seite («self») ist erreichbar, alles andere leitet dorthin um.
  if (admin.mustChangePassword && module !== "self") redirect(PASSWORD_CHANGE_PAGE_PATH);
  if (!canAccess(admin.roles, module, level)) redirect(FORBIDDEN_PATH);
  return admin;
}

// ---- Mitgliederportal -------------------------------------------------------------------------------------------

export type CurrentMember = {
  id: string;
  memberNumber: number;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  membershipTypeId: string | null;
  /** Anmelde-Sitzung, über die das Mitglied erkannt wurde */
  via: "user" | "admin";
};

const memberSelect = { id: true, memberNumber: true, firstName: true, lastName: true, email: true, status: true, membershipTypeId: true } as const;

/**
 * Das zur Sitzung gehörende Mitglied oder null. Massgeblich ist ausschliesslich die serverseitige Verknüpfung
 * (Member.userId bzw. AdminUser.memberId) – nie eine ID aus der Anfrage. Alle Portal-Abfragen müssen mit `member.id` filtern.
 * Das Konto muss bestätigt und nicht gesperrt sein (getCurrentUser prüft das).
 */
export const getCurrentMember = cache(async (): Promise<CurrentMember | null> => {
  const user = await getCurrentUser();
  if (user) {
    const m = await db.member.findUnique({ where: { userId: user.id }, select: memberSelect });
    return m ? { ...m, via: "user" } : null;
  }
  const admin = await getCurrentAdmin();
  // Mit Startpasswort ist auch der Zugang zum Mitgliederbereich gesperrt, bis das Passwort geändert ist.
  if (admin?.memberId && !admin.mustChangePassword) {
    const m = await db.member.findUnique({ where: { id: admin.memberId }, select: memberSelect });
    return m ? { ...m, via: "admin" } : null;
  }
  return null;
});

/** Mitglieder mit diesem Status dürfen das Portal für Beiträge, Anlässe und Dokumente nutzen. */
export const PORTAL_STATUSES: readonly string[] = ["AKTIV"];

/** Für Mitglieder-Endpunkte: Sitzung + verknüpftes Mitglied (jeder Status). 401 ohne Sitzung, 403 ohne Mitglied. */
export async function requireMember(req: Request): Promise<{ member: CurrentMember }> {
  assertSameOrigin(req);
  const member = await getCurrentMember();
  if (!member) {
    const signedIn = (await getCurrentUser()) ?? (await getCurrentAdmin());
    if (!signedIn) throw new ApiError(401, "UNAUTHORIZED", "Nicht angemeldet.");
    throw new ApiError(403, "NOT_A_MEMBER", "Mit deinem Konto ist kein Mitglied verknüpft.");
  }
  return { member };
}

/** Wie requireMember, aber nur für aktuelle Mitglieder (Status AKTIV): Anlässe für Mitglieder, Mitgliederdokumente, Stimmrecht. */
export async function requireActiveMember(req: Request): Promise<{ member: CurrentMember }> {
  const r = await requireMember(req);
  if (!PORTAL_STATUSES.includes(r.member.status)) {
    throw new ApiError(403, "NOT_ACTIVE_MEMBER", "Dafür musst du aktuelles Mitglied sein.");
  }
  return r;
}

/** Für Portal-Seiten: ohne Sitzung auf die Anmeldung, ohne verknüpftes Mitglied zur Portal-Übersicht (dort steht, wie man Mitglied wird). */
export async function requireMemberPage(next = "/account/verein"): Promise<CurrentMember> {
  const signedIn = (await getCurrentUser()) ?? (await getCurrentAdmin());
  if (!signedIn) redirect(`/login?next=${encodeURIComponent(next)}`);
  const member = await getCurrentMember();
  if (!member) redirect("/account/verein");
  return member;
}
