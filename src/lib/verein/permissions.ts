// Zentrale Rechteprüfung der Vereinsverwaltung. Reine Funktionen ohne Seiteneffekte: nutzbar in API-Routen, Server-Seiten und
// Client-Komponenten (Navigation). Die serverseitigen Wächter (requireAdminModule, requireModulePage) stehen in ./guard.ts.
//
// Modell: Jede Admin-Rolle bekommt je Modul die Stufe «read» (lesen) oder «write» (lesen und ändern). Eine Person kann mehrere
// Rollen haben (AdminUser.role + AdminUser.extraRoles); es gilt die höchste Stufe je Modul. «Statuten gehen vor»: Die Matrix ist eine
// Voreinstellung, die die Funktionen im Vorstand abbildet – wer mehr oder weniger darf, bekommt die passende Rolle zugewiesen.

export const ADMIN_ROLE_VALUES = [
  "OWNER",
  "ADMIN",
  "EDITOR",
  "PRAESIDENT",
  "VIZEPRAESIDENT",
  "KASSIER",
  "AKTUAR",
  "REVISOR",
] as const;
export type AdminRoleValue = (typeof ADMIN_ROLE_VALUES)[number];

export const ADMIN_ROLE_LABEL: Record<AdminRoleValue, string> = {
  OWNER: "Inhaber",
  ADMIN: "Administrator",
  EDITOR: "Redakteur",
  PRAESIDENT: "Präsident/in",
  VIZEPRAESIDENT: "Vize-Präsident/in",
  KASSIER: "Kassier/in",
  AKTUAR: "Aktuar/in",
  REVISOR: "Revisor/in (nur lesen)",
};

/** Kurze Erklärung je Rolle für die Zugangsverwaltung. */
export const ADMIN_ROLE_HINT: Record<AdminRoleValue, string> = {
  OWNER: "Voller Zugriff auf alles, inklusive Zugänge und Systemeinstellungen.",
  ADMIN: "Voller Zugriff auf alles, inklusive Zugänge und Systemeinstellungen.",
  EDITOR: "Nur Website-Inhalte (Blog, Dienste, Status, Tickets, Lizenzen) und Newsletter.",
  PRAESIDENT: "Mitglieder, Versammlungen, Anlässe, Dokumente, Aufgaben und Vereinseinstellungen; Beiträge und Kassa lesend.",
  VIZEPRAESIDENT: "Wie Präsident/in, aber Vereinseinstellungen nur lesend.",
  KASSIER: "Beiträge, Rechnungen, Kassa und Finanzeinstellungen; Mitglieder lesend.",
  AKTUAR: "Mitglieder, Versammlungen und Protokolle, Anlässe, Dokumente, Aufgaben und Newsletter.",
  REVISOR: "Nur lesen: Beiträge, Kassa, Versammlungen, Dokumente und Änderungsprotokoll.",
};

export const VEREIN_MODULES = [
  "dashboard",
  "members",
  "fees",
  "ledger",
  "meetings",
  "events",
  "documents",
  "tasks",
  "verein_settings",
  "finance_settings",
  "audit",
  "website",
  "newsletter",
  "system",
  "self",
] as const;
export type VereinModule = (typeof VEREIN_MODULES)[number];

export const MODULE_LABEL: Record<VereinModule, string> = {
  dashboard: "Übersicht",
  members: "Mitglieder",
  fees: "Beiträge und Rechnungen",
  ledger: "Kassa",
  meetings: "Versammlungen",
  events: "Anlässe",
  documents: "Dokumente",
  tasks: "Aufgaben",
  verein_settings: "Vereinseinstellungen",
  finance_settings: "Finanzeinstellungen",
  audit: "Änderungsprotokoll",
  website: "Website (Dienste, Status, Blog, Tickets, Lizenzen, Benutzer)",
  newsletter: "Newsletter",
  system: "System (Zugänge, Mailserver, Registrierung, Impressum)",
  self: "Eigenes Konto",
};

export type AccessLevel = "read" | "write";
type Matrix = Partial<Record<VereinModule, AccessLevel>>;

const FULL: Matrix = Object.fromEntries(VEREIN_MODULES.map((m) => [m, "write" as const]));

/** Voreinstellung. «self» (eigenes Passwort) und «dashboard» (Lesen) hat jede Rolle. */
const MATRIX: Record<AdminRoleValue, Matrix> = {
  OWNER: FULL,
  ADMIN: FULL,
  EDITOR: { dashboard: "read", website: "write", newsletter: "write", self: "write" },
  PRAESIDENT: {
    dashboard: "read",
    members: "write",
    fees: "read",
    ledger: "read",
    meetings: "write",
    events: "write",
    documents: "write",
    tasks: "write",
    verein_settings: "write",
    finance_settings: "read",
    audit: "read",
    website: "write",
    newsletter: "write",
    system: "read",
    self: "write",
  },
  VIZEPRAESIDENT: {
    dashboard: "read",
    members: "write",
    fees: "read",
    ledger: "read",
    meetings: "write",
    events: "write",
    documents: "write",
    tasks: "write",
    verein_settings: "read",
    finance_settings: "read",
    audit: "read",
    website: "write",
    newsletter: "write",
    self: "write",
  },
  KASSIER: {
    dashboard: "read",
    members: "read",
    fees: "write",
    ledger: "write",
    meetings: "read",
    events: "read",
    documents: "write",
    tasks: "write",
    verein_settings: "read",
    finance_settings: "write",
    self: "write",
  },
  AKTUAR: {
    dashboard: "read",
    members: "write",
    meetings: "write",
    events: "write",
    documents: "write",
    tasks: "write",
    verein_settings: "read",
    newsletter: "write",
    self: "write",
  },
  REVISOR: {
    dashboard: "read",
    fees: "read",
    ledger: "read",
    meetings: "read",
    documents: "read",
    audit: "read",
    self: "write",
  },
};

export function isAdminRole(value: string): value is AdminRoleValue {
  return (ADMIN_ROLE_VALUES as readonly string[]).includes(value);
}

/** Alle wirksamen Rollen einer Person: Hauptrolle + zusätzliche (kommagetrennt), bereinigt, ohne Duplikate, nur bekannte Werte. */
export function effectiveRoles(role: string, extraRoles: string | null | undefined = ""): AdminRoleValue[] {
  const out: AdminRoleValue[] = [];
  for (const raw of [role, ...(extraRoles ?? "").split(",")]) {
    const v = raw.trim().toUpperCase();
    if (isAdminRole(v) && !out.includes(v)) out.push(v);
  }
  return out;
}

/** Zusätzliche Rollen für die Speicherung normalisieren (nur bekannte, ohne Hauptrolle, ohne Duplikate). */
export function serializeExtraRoles(primary: string, extra: readonly string[]): string {
  return effectiveRoles(primary, extra.join(",")).filter((r) => r !== primary.trim().toUpperCase()).join(",");
}

const RANK: Record<AccessLevel, number> = { read: 1, write: 2 };

/** Höchste Stufe, die die Rollen für das Modul haben (oder null). */
export function levelFor(roles: readonly string[], module: VereinModule): AccessLevel | null {
  let best: AccessLevel | null = null;
  for (const r of roles) {
    if (!isAdminRole(r)) continue;
    const l = MATRIX[r][module];
    if (l && (best === null || RANK[l] > RANK[best])) best = l;
  }
  return best;
}

/** Darf die Person das Modul mindestens auf der verlangten Stufe nutzen? Unbekannte Rollen dürfen nichts. */
export function canAccess(roles: readonly string[], module: VereinModule, level: AccessLevel = "read"): boolean {
  const have = levelFor(roles, module);
  return have !== null && RANK[have] >= RANK[level];
}

/** Module, die die Rollen mindestens lesen dürfen (für Navigation und Übersicht). */
export function visibleModules(roles: readonly string[]): VereinModule[] {
  return VEREIN_MODULES.filter((m) => canAccess(roles, m, "read"));
}

/** Vorstandsrollen: dürfen z. B. die Vorstandsnotizen bei Mitgliedern sehen (Datenschutz: nur wer sie braucht). */
const BOARD_ROLES: readonly AdminRoleValue[] = ["OWNER", "ADMIN", "PRAESIDENT", "VIZEPRAESIDENT", "KASSIER", "AKTUAR"];
export function hasBoardRole(roles: readonly string[]): boolean {
  return roles.some((r) => (BOARD_ROLES as readonly string[]).includes(r));
}

/**
 * Welches Modul gehört zu einem Pfad? Wird von requireAdmin (API) und der Navigation genutzt.
 * Unbekannte Pfade fallen auf «system» (nur OWNER/ADMIN): neue Bereiche sind erst offen, wenn sie hier eingetragen sind.
 */
const PATH_MODULES: ReadonlyArray<readonly [prefix: string, module: VereinModule]> = [
  // Spezifischere Präfixe zuerst
  ["/api/admin/settings/verein/finanzen", "finance_settings"],
  ["/admin/verein/finanzen", "finance_settings"],
  ["/api/admin/settings/verein", "verein_settings"],
  ["/admin/verein/zugaenge", "system"],
  ["/admin/verein/protokoll", "audit"],
  ["/admin/verein", "verein_settings"],
  ["/api/admin/access", "system"],
  ["/api/admin/audit", "audit"],
  ["/api/admin/members", "members"],
  ["/admin/members", "members"],
  ["/api/admin/fees", "fees"],
  ["/api/admin/invoices", "fees"],
  ["/admin/fees", "fees"],
  ["/api/admin/ledger", "ledger"],
  ["/admin/ledger", "ledger"],
  ["/api/admin/meetings", "meetings"],
  ["/admin/meetings", "meetings"],
  ["/api/admin/events", "events"],
  ["/admin/events", "events"],
  ["/api/admin/documents", "documents"],
  ["/admin/documents", "documents"],
  ["/api/admin/tasks", "tasks"],
  ["/admin/tasks", "tasks"],
  ["/api/admin/newsletter", "newsletter"],
  ["/admin/newsletter", "newsletter"],
  ["/api/admin/stats", "dashboard"],
  ["/api/admin/account", "self"],
  ["/admin/account", "self"],
  ["/admin/keine-berechtigung", "self"],
  ["/api/admin/services", "website"],
  ["/api/admin/incidents", "website"],
  ["/api/admin/metrics", "website"],
  ["/api/admin/blog", "website"],
  ["/api/admin/tickets", "website"],
  ["/api/admin/licenses", "website"],
  ["/api/admin/products", "website"],
  ["/api/admin/api-clients", "website"],
  ["/api/admin/webspace-requests", "website"],
  ["/api/admin/users", "website"],
  ["/admin/services", "website"],
  ["/admin/status", "website"],
  ["/admin/blog", "website"],
  ["/admin/tickets", "website"],
  ["/admin/licenses", "website"],
  ["/admin/users", "website"],
  ["/api/admin/settings", "system"],
  ["/admin/settings", "system"],
];

export function moduleForPath(pathname: string): VereinModule {
  const p = pathname.replace(/\/+$/, "") || "/";
  if (p === "/admin") return "dashboard";
  for (const [prefix, module] of PATH_MODULES) {
    if (p === prefix || p.startsWith(`${prefix}/`)) return module;
  }
  return "system";
}

/** HTTP-Methode → verlangte Stufe: Lesen (GET/HEAD/OPTIONS) oder Ändern (alles andere). */
export function levelForMethod(method: string): AccessLevel {
  return ["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase()) ? "read" : "write";
}

export type AdminNavLink = { href: string; label: string; module: VereinModule };

/** Seitenleiste des Admin-Bereichs in Gruppen. Einträge ohne Leserecht werden ausgeblendet (siehe filterNav). */
export type AdminNavGroup<T extends AdminNavLink = AdminNavLink> = { title: string; items: T[] };

export function filterNav<T extends AdminNavLink>(groups: readonly AdminNavGroup<T>[], roles: readonly string[]): AdminNavGroup<T>[] {
  return groups
    .map((g) => ({ title: g.title, items: g.items.filter((i) => canAccess(roles, i.module, "read")) }))
    .filter((g) => g.items.length > 0);
}

// ---- Besondere Rechte -----------------------------------------------------------------------------------------------

/**
 * Darf die Person die E-Mail-Adresse eines Website-Kontos von Hand als bestätigt markieren? Das ersetzt den Nachweis per Mail und ist
 * deshalb nur mit dem Recht «Mitglieder ändern» oder «System ändern» erlaubt (eine Rolle nur für die Website genügt nicht).
 */
export function canHandVerifyAccounts(roles: readonly string[]): boolean {
  return canAccess(roles, "members", "write") || canAccess(roles, "system", "write");
}

/**
 * Solange ein Zugang noch das Startpasswort nutzt (mustChangePassword), ist nur das Ändern des eigenen Passworts erlaubt
 * (API-Pfad und Konto-Seite). Alles andere antwortet mit 403 PASSWORD_CHANGE_REQUIRED bzw. leitet auf die Konto-Seite um.
 */
export const PASSWORD_CHANGE_API_PATH = "/api/admin/account/password";
export const PASSWORD_CHANGE_PAGE_PATH = "/admin/account";

export function isAllowedWhilePasswordChangeRequired(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "");
  return path === PASSWORD_CHANGE_API_PATH || path === PASSWORD_CHANGE_PAGE_PATH;
}
