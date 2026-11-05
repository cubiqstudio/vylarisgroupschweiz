// Serverseitige Auth-Helfer (Node-Runtime): Cookie lesen, Konto in der DB gegenprüfen.
import "server-only";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/lib/db";
import { SESSION_COOKIE, verifySession, type SessionKind } from "@/lib/session";

export type CurrentAdmin = {
  id: string;
  email: string;
  name: string;
  role: string;
  mustChangePassword: boolean;
};

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  isTeam: boolean;
  teamTitle: string | null;
  hasAvatar: boolean;
};

/** Wer ist angemeldet? (kind + Anzeigename; für Header etc.). Prüft Signatur UND Existenz des Kontos. */
export type Viewer = { kind: SessionKind; id: string; name: string; email: string; isTeam: boolean; hasAvatar: boolean };

const readSession = cache(async () => verifySession((await cookies()).get(SESSION_COOKIE)?.value));

/** Liefert den eingeloggten Admin (JWT gültig, kind=admin UND Nutzer existiert noch) oder null. */
export const getCurrentAdmin = cache(async (): Promise<CurrentAdmin | null> => {
  const session = await readSession();
  if (!session || session.kind !== "admin") return null;
  const row = await db.adminUser.findUnique({
    where: { id: session.sub },
    select: { id: true, email: true, name: true, role: true, mustChangePassword: true, sessionVersion: true },
  });
  // Nach Passwortänderung ist die Sitzungsversion höher: ältere Sitzungen (z. B. gestohlene Cookies) sind ungültig.
  if (!row || row.sessionVersion !== (session.sv ?? 0)) return null;
  return { id: row.id, email: row.email, name: row.name, role: row.role, mustChangePassword: row.mustChangePassword };
});

/** Liefert das eingeloggte Website-Konto (verifiziert, nicht gesperrt) oder null. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await readSession();
  if (!session || session.kind !== "user") return null;
  const u = await db.user.findUnique({
    where: { id: session.sub },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      disabled: true,
      emailVerifiedAt: true,
      isTeam: true,
      teamTitle: true,
      avatarType: true,
      sessionVersion: true,
    },
  });
  if (!u || u.disabled || !u.emailVerifiedAt || u.sessionVersion !== (session.sv ?? 0)) return null;
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    createdAt: u.createdAt,
    isTeam: u.isTeam,
    teamTitle: u.teamTitle,
    hasAvatar: !!u.avatarType,
  };
});

export const getViewer = cache(async (): Promise<Viewer | null> => {
  try {
    const admin = await getCurrentAdmin();
    if (admin) return { kind: "admin", id: admin.id, name: admin.name, email: admin.email, isTeam: true, hasAvatar: false };
    const user = await getCurrentUser();
    if (user) return { kind: "user", id: user.id, name: user.name, email: user.email, isTeam: user.isTeam, hasAvatar: user.hasAvatar };
  } catch {
    /* DB-Ausfall: als abgemeldet behandeln */
  }
  return null;
});

/** Für Server Components/Layouts unter /admin: ohne Admin-Sitzung 404 – der Admin-Bereich verrät sich nicht. */
export async function requireAdminPage(): Promise<CurrentAdmin> {
  const admin = await getCurrentAdmin();
  if (!admin) notFound();
  return admin;
}

/** Für geschützte Nutzerseiten (/account): leitet auf /login um. */
export async function requireUserPage(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");
  return user;
}
