// Datenzugriff des Moduls Dokumente (nur auf dem Server). Listen laden nie die Dateiinhalte (DocumentVersion.data):
// immer `select` ohne `data`. Jede Änderung schreibt in derselben Transaktion einen Eintrag ins Änderungsprotokoll.
import "server-only";
import type { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api";
import type { CurrentAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { auditActor, diffForAudit, logAudit } from "./audit";
import { DOCUMENT_CATEGORY_LABEL, DOCUMENT_VISIBILITY_LABEL, type DocumentCategory, type DocumentVisibility } from "./constants";
import { isSameContent, nextVersionNumber, visibilitiesFor, type DocumentAudience, type DocumentFilters } from "./documents-lib";
import type { DocumentCreateInput, DocumentPatchInput } from "./documents-schemas";
import type { UploadCheck } from "./files";
import { searchWhere } from "./pagination";
import { canSeeBoardDocuments } from "./permissions";

type Tx = Prisma.TransactionClient;
type Upload = Extract<UploadCheck, { ok: true }>;

const notFound = (what = "Dokument"): never => {
  throw new ApiError(404, "NOT_FOUND", `${what} nicht gefunden.`);
};

/** Metadaten einer Version – bewusst ohne `data`. */
const versionMeta = { version: true, fileName: true, mimeType: true, sizeBytes: true, sha256: true, changeNote: true, uploadedByName: true, createdAt: true } as const;

const listSelect = {
  id: true,
  title: true,
  description: true,
  category: true,
  visibility: true,
  currentVersion: true,
  archivedAt: true,
  meetingId: true,
  createdAt: true,
  updatedAt: true,
  meeting: { select: { id: true, title: true, startsAt: true } },
  versions: { orderBy: { version: "desc" }, take: 1, select: versionMeta },
} satisfies Prisma.DocumentSelect;

export type DocumentRow = Prisma.DocumentGetPayload<{ select: typeof listSelect }>;

/**
 * Einschränkung auf das, was die Person sehen darf: Dokumente «Nur Vorstand» nur mit dem Einzelrecht «boardDocuments» (einstellbar je
 * Rolle, siehe permissions.ts). Gilt für Liste, Suche, Zähler, Einzelansicht und Download – serverseitig, nicht nur in der Anzeige.
 */
const boardOnly = (canSeeBoard: boolean): Prisma.DocumentWhereInput => (canSeeBoard ? {} : { visibility: { not: "VORSTAND" } });

function listWhere(filters: DocumentFilters, canSeeBoard: boolean): Prisma.DocumentWhereInput {
  return {
    AND: [
      boardOnly(canSeeBoard),
      {
        ...(filters.q ? searchWhere(filters.q, ["title", "description"]) : {}),
        ...(filters.category ? { category: filters.category } : {}),
        ...(filters.visibility ? { visibility: filters.visibility } : {}),
        archivedAt: filters.archived ? { not: null } : null,
      },
    ],
  };
}

/** Darf diese Person Dokumente «Nur Vorstand» sehen? (Wirksame Matrix aus `admin.roles`.) */
export const adminSeesBoardDocuments = (admin: { roles: readonly string[] }): boolean => canSeeBoardDocuments(admin.roles);

/**
 * Dokumentliste der Verwaltung (ohne Dateiinhalt), neueste Änderung zuerst. `canSeeBoard`: Dokumente «Nur Vorstand» einschliessen
 * (adminSeesBoardDocuments); Pflichtangabe, damit sie nie vergessen wird.
 */
export async function listDocuments(filters: DocumentFilters, skip: number, take: number, canSeeBoard: boolean): Promise<{ rows: DocumentRow[]; total: number }> {
  const where = listWhere(filters, canSeeBoard);
  const [rows, total] = await Promise.all([
    db.document.findMany({ where, orderBy: [{ updatedAt: "desc" }, { title: "asc" }], skip, take, select: listSelect }),
    db.document.count({ where }),
  ]);
  return { rows, total };
}

/** Anzahl aktiver und archivierter Dokumente (für die Filterchips). */
export async function documentCounts(canSeeBoard: boolean): Promise<{ active: number; archived: number }> {
  const scope = boardOnly(canSeeBoard);
  const [active, archived] = await Promise.all([
    db.document.count({ where: { AND: [scope, { archivedAt: null }] } }),
    db.document.count({ where: { AND: [scope, { archivedAt: { not: null } }] } }),
  ]);
  return { active, archived };
}

/** Ein Dokument mit allen Versionen (nur Metadaten). */
export async function getDocumentDetail(id: string, canSeeBoard: boolean) {
  return db.document.findFirst({
    where: { AND: [{ id }, boardOnly(canSeeBoard)] },
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      visibility: true,
      currentVersion: true,
      archivedAt: true,
      meetingId: true,
      createdAt: true,
      updatedAt: true,
      meeting: { select: { id: true, title: true, startsAt: true } },
      versions: { orderBy: { version: "desc" }, select: versionMeta },
    },
  });
}
export type DocumentDetail = NonNullable<Awaited<ReturnType<typeof getDocumentDetail>>>;

/** Sitzungen zur Verknüpfung (neueste zuerst). */
export async function listMeetingOptions(limit = 60) {
  return db.meeting.findMany({ orderBy: { startsAt: "desc" }, take: limit, select: { id: true, title: true, startsAt: true } });
}

async function requireMeetingRef(tx: Tx, meetingId: string | null | undefined): Promise<void> {
  if (!meetingId) return;
  const n = await tx.meeting.count({ where: { id: meetingId } });
  if (n === 0) throw new ApiError(422, "VALIDATION_ERROR", "Ungültige Eingabe.", { meetingId: "Die gewählte Sitzung wurde nicht gefunden." });
}

const describe = (d: { title: string; category: string; visibility: string }) =>
  `«${d.title}» (${DOCUMENT_CATEGORY_LABEL[d.category as DocumentCategory] ?? d.category}, ${DOCUMENT_VISIBILITY_LABEL[d.visibility as DocumentVisibility] ?? d.visibility})`;

/** «Nur Vorstand» ohne das Einzelrecht: weder sehen noch anlegen noch ändern (Antwort wie «nicht gefunden»). */
function assertBoardAllowed(admin: { roles: readonly string[] }, visibility: string, create = false): void {
  if (visibility !== "VORSTAND" || canSeeBoardDocuments(admin.roles)) return;
  if (create) throw new ApiError(403, "FORBIDDEN", "Dokumente «Nur Vorstand» dürfen nur Rollen mit diesem Recht anlegen oder zugänglich machen.");
  notFound();
}

/** Neues Dokument mit Version 1. */
export async function createDocument(admin: CurrentAdmin, input: DocumentCreateInput, file: Upload) {
  assertBoardAllowed(admin, input.visibility, true);
  return db.$transaction(async (tx) => {
    await requireMeetingRef(tx, input.meetingId);
    const doc = await tx.document.create({
      data: {
        title: input.title,
        description: input.description,
        category: input.category,
        visibility: input.visibility,
        meetingId: input.meetingId,
        currentVersion: 1,
        versions: {
          create: {
            version: 1,
            fileName: file.fileName,
            mimeType: file.mimeType,
            sizeBytes: file.sizeBytes,
            sha256: file.sha256,
            data: new Uint8Array(file.data),
            changeNote: input.changeNote,
            uploadedById: admin.id,
            uploadedByName: admin.name,
          },
        },
      },
      select: { id: true, title: true, category: true, visibility: true },
    });
    await logAudit(tx, {
      actor: auditActor(admin),
      action: "document.create",
      objectType: "Document",
      objectId: doc.id,
      summary: `Dokument ${describe(doc)} hochgeladen`,
      after: { datei: file.fileName, groesse: file.sizeBytes, sha256: file.sha256 },
    });
    return doc;
  });
}

/** Neue Fassung hochladen. Frühere Fassungen bleiben abrufbar. Eine inhaltlich identische Datei wird abgelehnt. */
export async function addDocumentVersion(admin: CurrentAdmin, id: string, file: Upload, changeNote: string) {
  return db.$transaction(async (tx) => {
    const doc = await tx.document.findUnique({ where: { id }, select: { id: true, title: true, category: true, visibility: true, currentVersion: true } });
    if (!doc) return notFound();
    assertBoardAllowed(admin, doc.visibility);
    const [current, all] = await Promise.all([
      tx.documentVersion.findFirst({ where: { documentId: id, version: doc.currentVersion }, select: { sha256: true } }),
      tx.documentVersion.findMany({ where: { documentId: id }, select: { version: true } }),
    ]);
    if (isSameContent(file.sha256, current?.sha256)) {
      throw new ApiError(409, "UNCHANGED", "Diese Datei ist inhaltlich identisch mit der aktuellen Fassung. Es wurde keine neue Version angelegt.");
    }
    const version = nextVersionNumber(all, doc.currentVersion);
    await tx.documentVersion.create({
      data: {
        documentId: id,
        version,
        fileName: file.fileName,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        sha256: file.sha256,
        data: new Uint8Array(file.data),
        changeNote,
        uploadedById: admin.id,
        uploadedByName: admin.name,
      },
    });
    await tx.document.update({ where: { id }, data: { currentVersion: version } });
    await logAudit(tx, {
      actor: auditActor(admin),
      action: "document.version",
      objectType: "Document",
      objectId: id,
      summary: `Neue Version ${version} zu ${describe(doc)} hochgeladen`,
      after: { version, datei: file.fileName, groesse: file.sizeBytes, sha256: file.sha256 },
    });
    return { id, version };
  });
}

/** Angaben ändern (Titel, Beschreibung, Kategorie, Sichtbarkeit, Sitzung, Archiv). */
export async function updateDocument(admin: CurrentAdmin, id: string, patch: DocumentPatchInput) {
  return db.$transaction(async (tx) => {
    const before = await tx.document.findUnique({ where: { id }, select: { title: true, description: true, category: true, visibility: true, meetingId: true, archivedAt: true } });
    if (!before) return notFound();
    assertBoardAllowed(admin, before.visibility);
    if (patch.visibility !== undefined) assertBoardAllowed(admin, patch.visibility, true);
    if (patch.meetingId !== undefined) await requireMeetingRef(tx, patch.meetingId);
    const { archived, ...rest } = patch;
    const data: Prisma.DocumentUncheckedUpdateInput = { ...rest };
    if (archived !== undefined) data.archivedAt = archived ? (before.archivedAt ?? new Date()) : null;
    const after = await tx.document.update({ where: { id }, data, select: { title: true, description: true, category: true, visibility: true, meetingId: true, archivedAt: true } });
    const diff = diffForAudit(before, after);
    if (Object.keys(diff.after).length > 0 || Object.keys(diff.before).length > 0) {
      const archiveChanged = (before.archivedAt === null) !== (after.archivedAt === null);
      await logAudit(tx, {
        actor: auditActor(admin),
        action: archiveChanged ? (after.archivedAt ? "document.archive" : "document.unarchive") : "document.update",
        objectType: "Document",
        objectId: id,
        summary: archiveChanged ? `Dokument ${describe(after)} ${after.archivedAt ? "archiviert" : "wiederhergestellt"}` : `Dokument ${describe(after)} geändert`,
        ...diff,
      });
    }
    return { id };
  });
}

/** Dokument samt allen Versionen endgültig löschen (mit Protokolleintrag). */
export async function deleteDocument(admin: CurrentAdmin, id: string) {
  return db.$transaction(async (tx) => {
    const doc = await tx.document.findUnique({ where: { id }, select: { id: true, title: true, category: true, visibility: true, _count: { select: { versions: true } } } });
    if (!doc) return notFound();
    assertBoardAllowed(admin, doc.visibility);
    await tx.document.delete({ where: { id } });
    await logAudit(tx, {
      actor: auditActor(admin),
      action: "document.delete",
      objectType: "Document",
      objectId: id,
      summary: `Dokument ${describe(doc)} mit ${doc._count.versions} ${doc._count.versions === 1 ? "Version" : "Versionen"} gelöscht`,
      before: { titel: doc.title, kategorie: doc.category, sichtbarkeit: doc.visibility, versionen: doc._count.versions },
    });
    return { id };
  });
}

// ---- Download -----------------------------------------------------------------------------------------------------

export type DocumentFile = {
  title: string;
  category: string;
  visibility: string;
  archivedAt: Date | null;
  version: number;
  isCurrent: boolean;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  data: Buffer;
};

/** Datei einer Version (null = aktuelle Fassung) samt Sichtbarkeit; der Aufrufer prüft die Berechtigung (canView). */
export async function getDocumentFile(id: string, version: number | null): Promise<DocumentFile | null> {
  const doc = await db.document.findUnique({ where: { id }, select: { title: true, category: true, visibility: true, archivedAt: true, currentVersion: true } });
  if (!doc) return null;
  const wanted = version ?? doc.currentVersion;
  const v = await db.documentVersion.findUnique({
    where: { documentId_version: { documentId: id, version: wanted } },
    select: { version: true, fileName: true, mimeType: true, sizeBytes: true, data: true },
  });
  if (!v) return null;
  return {
    title: doc.title,
    category: doc.category,
    visibility: doc.visibility,
    archivedAt: doc.archivedAt,
    version: v.version,
    isCurrent: v.version === doc.currentVersion,
    fileName: v.fileName,
    mimeType: v.mimeType,
    sizeBytes: v.sizeBytes,
    data: Buffer.from(v.data),
  };
}

// ---- Portal und öffentliche Seiten ----------------------------------------------------------------------------------

const portalSelect = {
  id: true,
  title: true,
  description: true,
  category: true,
  visibility: true,
  currentVersion: true,
  updatedAt: true,
  versions: { orderBy: { version: "desc" }, take: 1, select: { version: true, fileName: true, sizeBytes: true, createdAt: true } },
} satisfies Prisma.DocumentSelect;

export type PortalDocument = Prisma.DocumentGetPayload<{ select: typeof portalSelect }>;

/** Nicht archivierte Dokumente, die das Publikum sehen darf (Sichtbarkeit wird in der Abfrage erzwungen). */
export async function listVisibleDocuments(audience: DocumentAudience, opts: { category?: DocumentCategory | ""; q?: string } = {}): Promise<PortalDocument[]> {
  return db.document.findMany({
    where: {
      visibility: { in: [...visibilitiesFor(audience)] },
      archivedAt: null,
      ...(opts.category ? { category: opts.category } : {}),
      ...(opts.q ? searchWhere(opts.q, ["title", "description"]) : {}),
    },
    orderBy: [{ category: "asc" }, { title: "asc" }],
    take: 500,
    select: portalSelect,
  });
}

/** Öffentliche Statuten: Kategorie STATUTEN, Sichtbarkeit OEFFENTLICH, nicht archiviert; neueste zuerst. */
export async function listPublicStatutes(): Promise<PortalDocument[]> {
  return db.document.findMany({
    where: { category: "STATUTEN", visibility: "OEFFENTLICH", archivedAt: null },
    orderBy: [{ updatedAt: "desc" }],
    take: 10,
    select: portalSelect,
  });
}

/** Gibt es ein öffentliches Statutendokument? (für Verlinkungen) */
export async function hasPublicStatutes(): Promise<boolean> {
  return (await db.document.count({ where: { category: "STATUTEN", visibility: "OEFFENTLICH", archivedAt: null } })) > 0;
}
