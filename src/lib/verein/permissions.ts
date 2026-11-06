// Zentrale Rechteprüfung der Vereinsverwaltung. Reine Funktionen ohne Seiteneffekte: nutzbar in API-Routen, Server-Seiten und
// Client-Komponenten (Navigation). Die serverseitigen Wächter (requireAdminModule, requireModulePage) stehen in ./guard.ts.
//
// Modell: Jede Admin-Rolle bekommt je Modul die Stufe «read» (lesen) oder «write» (lesen und ändern) oder keinen Zugriff. Eine Person
// kann mehrere Rollen haben (AdminUser.role + AdminUser.extraRoles); es gilt die höchste Stufe je Modul. «Statuten gehen vor»: Die
// Matrix ist eine Voreinstellung (DEFAULT_MATRIX), die die Funktionen im Vorstand abbildet. Inhaber und Administration können sie in
// der Verwaltung anpassen (Abweichungen stehen in SiteSetting «verein.permissions.v1», Laden: ./permissions-data.ts).
//
// Die wirksame Matrix (EffectiveMatrix) entsteht ausschliesslich in resolveMatrix(): ungültige oder unzulässige Angaben werden
// verworfen, sodass nie mehr Rechte entstehen als erlaubt (Schranken: isAllowedLevel). Der Server hängt die wirksame Matrix an
// `admin.roles` (withMatrix); canAccess, levelFor usw. lesen sie von dort. Eine Rollenliste ohne angehängte Matrix (Tests, Kopien)
// nutzt die Voreinstellung.

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

/** Kurze Erklärung je Rolle bei Voreinstellung (für die tatsächlich eingestellten Rechte: roleHint). */
export const ADMIN_ROLE_HINT: Record<AdminRoleValue, string> = {
  OWNER: "Voller Zugriff auf alles, inklusive Zugänge und Systemeinstellungen.",
  ADMIN: "Voller Zugriff auf alles, inklusive Zugänge und Systemeinstellungen.",
  EDITOR: "Nur Website-Inhalte (Blog, Dienste, Status, Tickets, Lizenzen) und Newsletter.",
  PRAESIDENT: "Mitglieder, Versammlungen, Anlässe, Dokumente, Aufgaben und Vereinseinstellungen; Kasse (buchen, Konten ändern); Beiträge lesend.",
  VIZEPRAESIDENT: "Wie Präsident/in, aber Kasse und Vereinseinstellungen nur lesend.",
  KASSIER: "Beiträge, Rechnungen, Kasse und Finanzeinstellungen; Mitglieder lesend.",
  AKTUAR: "Mitglieder, Versammlungen und Protokolle, Anlässe, Dokumente, Aufgaben und Newsletter.",
  REVISOR: "Nur lesen: Beiträge, Kasse, Versammlungen, Dokumente und Änderungsprotokoll.",
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
  ledger: "Kasse",
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
/** Einstellbare Stufe: «none» = kein Zugriff. */
export type ConfigurableLevel = AccessLevel | "none";
export type LevelMap = Partial<Record<VereinModule, AccessLevel>>;

/** Inhaber und Administration dürfen immer alles und können nie eingeschränkt werden. */
export const FIXED_ROLES = ["OWNER", "ADMIN"] as const;
export type ConfigurableRole = Exclude<AdminRoleValue, (typeof FIXED_ROLES)[number]>;
export const CONFIGURABLE_ROLES: readonly ConfigurableRole[] = ADMIN_ROLE_VALUES.filter((r): r is ConfigurableRole => !(FIXED_ROLES as readonly string[]).includes(r));
export const isConfigurableRole = (value: string): value is ConfigurableRole => (CONFIGURABLE_ROLES as readonly string[]).includes(value);

/** Einzelrechte neben den Modulstufen. */
export const ROLE_FLAGS = ["boardNotes", "boardDocuments", "fiscalYearClose"] as const;
export type RoleFlag = (typeof ROLE_FLAGS)[number];
export type RoleFlags = Record<RoleFlag, boolean>;
export const ROLE_FLAG_LABEL: Record<RoleFlag, string> = {
  boardNotes: "Vorstandsnotizen bei Mitgliedern sehen",
  boardDocuments: "Dokumente «Nur Vorstand» sehen",
  fiscalYearClose: "Geschäftsjahr abschliessen und wieder öffnen",
};
export const ROLE_FLAG_HINT: Record<RoleFlag, string> = {
  boardNotes: "Interne Notizen des Vorstands im Mitgliederdossier (Datenschutz: nur wer sie braucht).",
  boardDocuments: "Dokumente mit der Sichtbarkeit «Nur Vorstand»: in Liste, Suche und Download.",
  fiscalYearClose: "Jahresabschluss in der Kasse, Wiedereröffnung und Genehmigungsvermerk. Wirkt nur mit mindestens «Lesen» bei «Kasse». Buchen braucht weiterhin «Ändern».",
};

/** Wirksame Rechte: Stufen je Rolle und Modul sowie Einzelrechte je Rolle. */
export type EffectiveMatrix = {
  readonly levels: Readonly<Record<AdminRoleValue, Readonly<LevelMap>>>;
  readonly flags: Readonly<Record<AdminRoleValue, Readonly<RoleFlags>>>;
};

/** Abweichungen von der Voreinstellung (so wird gespeichert). «none» nimmt eine Stufe weg. */
export type PermissionOverrides = {
  levels?: Partial<Record<ConfigurableRole, Partial<Record<VereinModule, ConfigurableLevel>>>>;
  flags?: Partial<Record<ConfigurableRole, Partial<RoleFlags>>>;
};

const FULL: LevelMap = Object.fromEntries(VEREIN_MODULES.map((m) => [m, "write" as const]));

/** Voreinstellung der Stufen. «self» (eigenes Passwort) und «dashboard» (Lesen) hat jede Rolle. */
const DEFAULT_LEVELS: Record<AdminRoleValue, LevelMap> = {
  OWNER: FULL,
  ADMIN: FULL,
  EDITOR: { dashboard: "read", website: "write", newsletter: "write", self: "write" },
  PRAESIDENT: {
    dashboard: "read",
    members: "write",
    fees: "read",
    ledger: "write",
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

/**
 * Voreinstellung der Einzelrechte. Vorstandsnotizen und Dokumente «Nur Vorstand»: Vorstandsrollen ja, Revisor und Redakteur nein
 * (Datenminimierung). Geschäftsjahr abschliessen: nur Inhaber, Administration, Präsident/in und Kassier/in.
 */
const DEFAULT_FLAGS: Record<AdminRoleValue, RoleFlags> = {
  OWNER: { boardNotes: true, boardDocuments: true, fiscalYearClose: true },
  ADMIN: { boardNotes: true, boardDocuments: true, fiscalYearClose: true },
  PRAESIDENT: { boardNotes: true, boardDocuments: true, fiscalYearClose: true },
  VIZEPRAESIDENT: { boardNotes: true, boardDocuments: true, fiscalYearClose: false },
  KASSIER: { boardNotes: true, boardDocuments: true, fiscalYearClose: true },
  AKTUAR: { boardNotes: true, boardDocuments: true, fiscalYearClose: false },
  REVISOR: { boardNotes: false, boardDocuments: false, fiscalYearClose: false },
  EDITOR: { boardNotes: false, boardDocuments: false, fiscalYearClose: false },
};

/**
 * Schranken gegen Aussperrung und Rechteausweitung: Darf diese (einstellbare) Rolle das Modul auf dieser Stufe haben?
 *  - «self» (eigenes Passwort): immer «write».
 *  - «dashboard»: mindestens «read» (sonst landet man nach der Anmeldung im Leeren).
 *  - «system» (Zugänge, Mailserver, Registrierung, Impressum, diese Rollenverwaltung): nie «write» ausser Inhaber/Administration;
 *    sonst könnte sich jemand selbst mehr Rechte geben.
 */
export function isAllowedLevel(role: string, module: VereinModule, level: ConfigurableLevel): boolean {
  if (!isConfigurableRole(role)) return false;
  if (module === "self") return level === "write";
  if (module === "dashboard") return level !== "none";
  if (module === "system") return level !== "write";
  return true;
}

const isLevelValue = (v: unknown): v is ConfigurableLevel => v === "none" || v === "read" || v === "write";
const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
const isPlain = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function freezeMatrix(m: { levels: Record<AdminRoleValue, LevelMap>; flags: Record<AdminRoleValue, RoleFlags> }): EffectiveMatrix {
  for (const r of ADMIN_ROLE_VALUES) {
    Object.freeze(m.levels[r]);
    Object.freeze(m.flags[r]);
  }
  Object.freeze(m.levels);
  Object.freeze(m.flags);
  return Object.freeze(m);
}

function cloneDefaults() {
  const levels = {} as Record<AdminRoleValue, LevelMap>;
  const flags = {} as Record<AdminRoleValue, RoleFlags>;
  for (const r of ADMIN_ROLE_VALUES) {
    levels[r] = { ...DEFAULT_LEVELS[r] };
    flags[r] = { ...DEFAULT_FLAGS[r] };
  }
  return { levels, flags };
}

/** Voreinstellung (unveränderlich). */
export const DEFAULT_MATRIX: EffectiveMatrix = freezeMatrix(cloneDefaults());

/**
 * Wirksame Matrix aus gespeicherten Abweichungen. Nimmt beliebige (auch manipulierte) Daten: unbekannte Rollen und Module,
 * Inhaber/Administration, ungültige Werte und alles, was die Schranken (isAllowedLevel) verletzt, wird verworfen – dort gilt die
 * Voreinstellung. Die Funktion wirft nie und gibt nie mehr Rechte, als die Schranken zulassen.
 */
export function resolveMatrix(overrides: unknown): EffectiveMatrix {
  const m = cloneDefaults();
  if (!isPlain(overrides)) return freezeMatrix(m);
  const { levels, flags } = overrides;
  if (isPlain(levels)) {
    for (const role of CONFIGURABLE_ROLES) {
      const row = own(levels, role) ? levels[role] : undefined;
      if (!isPlain(row)) continue;
      for (const mod of VEREIN_MODULES) {
        const v = own(row, mod) ? row[mod] : undefined;
        if (!isLevelValue(v) || !isAllowedLevel(role, mod, v)) continue;
        if (v === "none") delete m.levels[role][mod];
        else m.levels[role][mod] = v;
      }
    }
  }
  if (isPlain(flags)) {
    for (const role of CONFIGURABLE_ROLES) {
      const row = own(flags, role) ? flags[role] : undefined;
      if (!isPlain(row)) continue;
      for (const flag of ROLE_FLAGS) {
        const v = own(row, flag) ? row[flag] : undefined;
        if (typeof v === "boolean") m.flags[role][flag] = v;
      }
    }
  }
  return freezeMatrix(m);
}

/** Nur die Abweichungen einer wirksamen Matrix von der Voreinstellung (das, was gespeichert wird). */
export function diffFromDefault(matrix: EffectiveMatrix): PermissionOverrides {
  const out: PermissionOverrides = {};
  for (const role of CONFIGURABLE_ROLES) {
    for (const mod of VEREIN_MODULES) {
      const have = matrix.levels[role][mod] ?? "none";
      const def = DEFAULT_MATRIX.levels[role][mod] ?? "none";
      if (have !== def) ((out.levels ??= {})[role] ??= {})[mod] = have;
    }
    for (const flag of ROLE_FLAGS) {
      if (matrix.flags[role][flag] !== DEFAULT_MATRIX.flags[role][flag]) ((out.flags ??= {})[role] ??= {})[flag] = matrix.flags[role][flag];
    }
  }
  return out;
}

export const hasOverrides = (o: PermissionOverrides): boolean => Object.keys(o.levels ?? {}).length > 0 || Object.keys(o.flags ?? {}).length > 0;

// ---- Wirksame Matrix an der Rollenliste ---------------------------------------------------------------------------------

const MATRIX_KEY = Symbol.for("vylaris.verein.effectiveMatrix");

/**
 * Hängt die wirksame Matrix an eine Kopie der Rollenliste. Der Server tut das in getCurrentAdmin(); danach arbeiten canAccess,
 * levelFor, visibleModules, filterNav, canSeeBoardNotes usw. mit dieser Matrix, ohne dass jeder Aufrufer sie weiterreichen muss.
 * Die Matrix ist nicht aufzählbar (geht beim Serialisieren zum Client verloren; dort die Stufen als Props übergeben, siehe levelsFor).
 */
export function withMatrix<T extends readonly string[]>(roles: T, matrix: EffectiveMatrix): T {
  const copy = [...roles] as unknown as T;
  Object.defineProperty(copy, MATRIX_KEY, { value: matrix, enumerable: false });
  return copy;
}

/** Die für diese Rollenliste geltende Matrix: die angehängte, sonst die Voreinstellung. */
export function matrixOf(roles: readonly string[], explicit?: EffectiveMatrix): EffectiveMatrix {
  if (explicit) return explicit;
  const attached = (roles as unknown as Record<symbol, unknown>)[MATRIX_KEY];
  return isPlain(attached) && isPlain(attached.levels) && isPlain(attached.flags) ? (attached as unknown as EffectiveMatrix) : DEFAULT_MATRIX;
}

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
export function levelFor(roles: readonly string[], module: VereinModule, matrix?: EffectiveMatrix): AccessLevel | null {
  const m = matrixOf(roles, matrix);
  let best: AccessLevel | null = null;
  for (const r of roles) {
    if (!isAdminRole(r)) continue;
    const l = m.levels[r][module];
    if (l && (best === null || RANK[l] > RANK[best])) best = l;
  }
  return best;
}

/** Darf die Person das Modul mindestens auf der verlangten Stufe nutzen? Unbekannte Rollen dürfen nichts. */
export function canAccess(roles: readonly string[], module: VereinModule, level: AccessLevel = "read", matrix?: EffectiveMatrix): boolean {
  const have = levelFor(roles, module, matrix);
  return have !== null && RANK[have] >= RANK[level];
}

/** Module, die die Rollen mindestens lesen dürfen (für Navigation und Übersicht). */
export function visibleModules(roles: readonly string[], matrix?: EffectiveMatrix): VereinModule[] {
  return VEREIN_MODULES.filter((m) => canAccess(roles, m, "read", matrix));
}

/** Stufe je Modul für die Rollen (für Client-Komponenten, die keine Rollenliste mit Matrix erhalten). */
export function levelsFor(roles: readonly string[], matrix?: EffectiveMatrix): LevelMap {
  const out: LevelMap = {};
  for (const m of VEREIN_MODULES) {
    const l = levelFor(roles, m, matrix);
    if (l) out[m] = l;
  }
  return out;
}

/** Darf eine der Rollen das Einzelrecht? */
export function hasFlag(roles: readonly string[], flag: RoleFlag, matrix?: EffectiveMatrix): boolean {
  const m = matrixOf(roles, matrix);
  return roles.some((r) => isAdminRole(r) && m.flags[r][flag] === true);
}

/** Vorstandsnotizen bei Mitgliedern sehen und erfassen (Datenschutz: nur wer sie braucht). Einstellbar je Rolle. */
export const canSeeBoardNotes = (roles: readonly string[], matrix?: EffectiveMatrix): boolean => hasFlag(roles, "boardNotes", matrix);
/** Dokumente mit der Sichtbarkeit «Nur Vorstand» sehen (zusätzlich zum Leserecht auf «documents»). Einstellbar je Rolle. */
export const canSeeBoardDocuments = (roles: readonly string[], matrix?: EffectiveMatrix): boolean => hasFlag(roles, "boardDocuments", matrix);
/**
 * Geschäftsjahr abschliessen, wieder öffnen und Genehmigung vermerken. Braucht das Einzelrecht «fiscalYearClose» UND mindestens das
 * Leserecht auf «ledger» (Kasse): ohne Zugriff auf die Kasse gibt es keinen Abschluss. Das Schreibrecht auf «ledger» genügt nicht
 * mehr und ist auch nicht nötig (Buchen bleibt am Schreibrecht). Inhaber und Administration haben das Recht immer.
 */
export const canCloseFiscalYear = (roles: readonly string[], matrix?: EffectiveMatrix): boolean => canAccess(roles, "ledger", "read", matrix) && hasFlag(roles, "fiscalYearClose", matrix);
/** Ältere Bezeichnung für canSeeBoardNotes (gleiche Wirkung: gilt jetzt die Einstellung je Rolle, keine feste Liste mehr). */
export const hasBoardRole = canSeeBoardNotes;

// ---- Beschreibungen für die Oberfläche -----------------------------------------------------------------------------------

/** Kurzbezeichnungen der Module für Aufzählungen. */
export const MODULE_SHORT_LABEL: Record<VereinModule, string> = {
  dashboard: "Übersicht",
  members: "Mitglieder",
  fees: "Beiträge und Rechnungen",
  ledger: "Kasse",
  meetings: "Versammlungen",
  events: "Anlässe",
  documents: "Dokumente",
  tasks: "Aufgaben",
  verein_settings: "Vereinseinstellungen",
  finance_settings: "Finanzeinstellungen",
  audit: "Änderungsprotokoll",
  website: "Website",
  newsletter: "Newsletter",
  system: "System und Rollen",
  self: "Eigenes Konto",
};

export type AccessSummary = { write: VereinModule[]; read: VereinModule[]; none: VereinModule[]; boardNotes: boolean; boardDocuments: boolean; fiscalYearClose: boolean };

/** Was dürfen die Rollen zusammen? Grundlage der Vorschau «Diese Person darf …» und der Rollenerklärungen. «self» bleibt aussen vor. */
export function describeAccess(roles: readonly string[], matrix?: EffectiveMatrix): AccessSummary {
  const out: AccessSummary = { write: [], read: [], none: [], boardNotes: canSeeBoardNotes(roles, matrix), boardDocuments: canSeeBoardDocuments(roles, matrix), fiscalYearClose: canCloseFiscalYear(roles, matrix) };
  for (const m of VEREIN_MODULES) {
    if (m === "self") continue;
    const l = levelFor(roles, m, matrix);
    (l === "write" ? out.write : l === "read" ? out.read : out.none).push(m);
  }
  return out;
}

/** Erklärung einer Rolle aus der wirksamen Matrix (statt fester Texte). */
export function roleHint(role: AdminRoleValue, matrix?: EffectiveMatrix): string {
  const m = matrix ?? DEFAULT_MATRIX;
  if (role === "OWNER" || role === "ADMIN") return ADMIN_ROLE_HINT[role];
  const a = describeAccess([role], m);
  const parts: string[] = [];
  if (a.write.length > 0) parts.push(`Ändern: ${a.write.map((x) => MODULE_SHORT_LABEL[x]).join(", ")}`);
  if (a.read.length > 0) parts.push(`Nur lesen: ${a.read.map((x) => MODULE_SHORT_LABEL[x]).join(", ")}`);
  const extras: string[] = [];
  if (a.boardNotes) extras.push("Vorstandsnotizen");
  if (a.boardDocuments) extras.push("Dokumente «Nur Vorstand»");
  if (extras.length > 0) parts.push(`Sieht zusätzlich: ${extras.join(", ")}`);
  if (a.fiscalYearClose) parts.push("Darf das Geschäftsjahr abschliessen und wieder öffnen");
  return parts.join(". ") + (parts.length > 0 ? "." : "");
}

/**
 * Welches Modul gehört zu einem Pfad? Wird von requireAdmin (API) und der Navigation genutzt.
 * Unbekannte Pfade fallen auf «system» (nur OWNER/ADMIN): neue Bereiche sind erst offen, wenn sie hier eingetragen sind.
 */
const PATH_MODULES: ReadonlyArray<readonly [prefix: string, module: VereinModule]> = [
  // Spezifischere Präfixe zuerst
  ["/api/admin/settings/verein/finanzen", "finance_settings"],
  ["/admin/verein/finanzen", "finance_settings"],
  ["/api/admin/settings/verein/rollen", "system"],
  ["/api/admin/settings/verein", "verein_settings"],
  ["/admin/verein/zugaenge", "system"],
  ["/admin/verein/rollen", "system"],
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

export function filterNav<T extends AdminNavLink>(groups: readonly AdminNavGroup<T>[], roles: readonly string[], matrix?: EffectiveMatrix): AdminNavGroup<T>[] {
  return filterNavByLevels(groups, levelsFor(roles, matrix));
}

/** Wie filterNav, aber mit fertig berechneten Stufen (Client-Komponenten: Props vom Server, siehe levelsFor). */
export function filterNavByLevels<T extends AdminNavLink>(groups: readonly AdminNavGroup<T>[], levels: LevelMap): AdminNavGroup<T>[] {
  return groups
    .map((g) => ({ title: g.title, items: g.items.filter((i) => levels[i.module] !== undefined) }))
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
