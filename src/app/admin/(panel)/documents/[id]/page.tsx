import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { Card } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { formatDateCh, formatDateTimeCh } from "@/lib/verein/dates";
import { getDocumentDetail, listMeetingOptions } from "@/lib/verein/documents-data";
import { VISIBILITY_HINT, formatFileSize } from "@/lib/verein/documents-meta";
import { requireModulePage } from "@/lib/verein/guard";
import { canAccess } from "@/lib/verein/permissions";
import { idSchema } from "@/lib/verein/validation";
import type { DocumentVisibility } from "@/lib/verein/constants";
import { PageTitle } from "@/components/admin/core/page-title";
import { ArchivedPill, CategoryPill, VisibilityPill } from "@/components/admin/documents/pills";
import { DocumentDetailActions } from "@/components/admin/documents/document-detail-actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dokument" };

type Props = { params: Promise<{ id: string }> };

export default async function AdminDocumentDetailPage({ params }: Props) {
  const admin = await requireModulePage("documents");
  const canWrite = canAccess(admin.roles, "documents", "write");
  const parsed = idSchema.safeParse((await params).id);
  if (!parsed.success) notFound();
  const doc = await getDocumentDetail(parsed.data!);
  if (!doc) notFound();
  const meetings = canWrite ? await listMeetingOptions() : [];

  return (
    <div>
      <Link href="/admin/documents" className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Alle Dokumente
      </Link>

      <PageTitle title={doc.title} description={doc.description || undefined}>
        <CategoryPill category={doc.category} />
        <VisibilityPill visibility={doc.visibility} />
        {doc.archivedAt && <ArchivedPill />}
      </PageTitle>

      <div className="mb-6">
        <DocumentDetailActions
          doc={{
            id: doc.id,
            title: doc.title,
            description: doc.description,
            category: doc.category,
            visibility: doc.visibility,
            meetingId: doc.meetingId,
            archived: doc.archivedAt !== null,
            currentVersion: doc.currentVersion,
          }}
          meetings={meetings.map((m) => ({ id: m.id, label: `${m.title} (${formatDateCh(m.startsAt)})` }))}
          canWrite={canWrite}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section aria-labelledby="versions-heading">
          <h2 id="versions-heading" className="mb-3 text-base font-semibold text-white">
            Versionen
          </h2>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-left text-sm">
                <caption className="sr-only">Versionsverlauf, neueste zuerst</caption>
                <thead className="border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">Version</th>
                    <th scope="col" className="px-4 py-3 font-medium">Datei</th>
                    <th scope="col" className="px-4 py-3 font-medium">Hochgeladen</th>
                    <th scope="col" className="px-4 py-3 font-medium"><span className="sr-only">Herunterladen</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {doc.versions.map((v) => (
                    <tr key={v.version} className="align-top hover:bg-zinc-900/40">
                      <td className="px-4 py-3 tabular-nums text-zinc-200">
                        {v.version}
                        {v.version === doc.currentVersion && <span className="ml-2 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-300 ring-1 ring-inset ring-emerald-500/30">aktuell</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="break-all text-zinc-200">{v.fileName}</div>
                        <div className="text-xs text-zinc-500">{formatFileSize(v.sizeBytes)}</div>
                        {v.changeNote && <div className="mt-1 text-xs text-zinc-400 [overflow-wrap:anywhere]">{v.changeNote}</div>}
                      </td>
                      <td className="px-4 py-3 text-zinc-400">
                        <div className="tabular-nums">{formatDateTimeCh(v.createdAt)}</div>
                        {v.uploadedByName && <div className="text-xs text-zinc-500">{v.uploadedByName}</div>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <a href={`/api/admin/documents/${doc.id}/download?version=${v.version}`} download className={buttonClass("ghost", "sm")}>
                          <Download className="h-4 w-4" aria-hidden />
                          <span className="sr-only">Version {v.version} herunterladen</span>
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </section>

        <aside aria-labelledby="info-heading">
          <h2 id="info-heading" className="mb-3 text-base font-semibold text-white">
            Angaben
          </h2>
          <Card className="space-y-3 p-5 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-500">Sichtbarkeit</p>
              <p className="mt-0.5 text-zinc-300">{VISIBILITY_HINT[doc.visibility as DocumentVisibility] ?? doc.visibility}</p>
            </div>
            {doc.meeting && (
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500">Sitzung</p>
                <p className="mt-0.5">
                  {canAccess(admin.roles, "meetings", "read") ? (
                    <Link href={`/admin/meetings/${doc.meeting.id}`} className="text-emerald-400 hover:underline">
                      {doc.meeting.title}
                    </Link>
                  ) : (
                    <span className="text-zinc-300">{doc.meeting.title}</span>
                  )}{" "}
                  <span className="text-zinc-500">({formatDateCh(doc.meeting.startsAt)})</span>
                </p>
              </div>
            )}
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-500">Angelegt</p>
              <p className="mt-0.5 tabular-nums text-zinc-300">{formatDateTimeCh(doc.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-500">Zuletzt geändert</p>
              <p className="mt-0.5 tabular-nums text-zinc-300">{formatDateTimeCh(doc.updatedAt)}</p>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
