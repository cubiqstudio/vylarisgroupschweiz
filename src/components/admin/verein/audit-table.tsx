import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PILL } from "@/components/admin/core/styles";
import type { AuditRow } from "@/lib/verein/audit-data";
import { auditActionLabel, auditChanges, auditObjectLabel } from "@/lib/verein/audit-view";
import { TONE_CLASS, type Tone } from "@/lib/verein/constants";
import { formatDateTimeCh } from "@/lib/verein/dates";

const ACTOR_LABEL: Record<string, string> = { ADMIN: "Verwaltung", MEMBER: "Mitglied", SYSTEM: "System" };
const ACTOR_TONE: Record<string, Tone> = { ADMIN: "indigo", MEMBER: "sky", SYSTEM: "zinc" };

function Changes({ before, after }: { before: string | null; after: string | null }) {
  const changes = auditChanges(before, after);
  if (changes.length === 0) return <span className="text-zinc-600">–</span>;
  return (
    <details className="group">
      <summary className="cursor-pointer list-none text-xs font-medium text-emerald-400 hover:underline [&::-webkit-details-marker]:hidden">
        {changes.length === 1 ? "1 Angabe anzeigen" : `${changes.length} Angaben anzeigen`}
      </summary>
      <dl className="mt-2 space-y-2 text-xs">
        {changes.map((c) => (
          <div key={c.field} className="rounded-lg bg-zinc-950 px-2.5 py-2 ring-1 ring-inset ring-zinc-800">
            <dt className="font-medium text-zinc-300">{c.label}</dt>
            <dd className="mt-0.5 break-words text-zinc-500">
              <span className="sr-only">Vorher: </span>
              <span className="line-through decoration-zinc-600">{c.before}</span>
              <span aria-hidden="true"> → </span>
              <span className="sr-only"> Nachher: </span>
              <span className="text-zinc-200">{c.after}</span>
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

/** Tabelle des Änderungsprotokolls (nur Lesen). Auf schmalen Bildschirmen scrollt die Tabelle waagrecht. */
export function AuditTable({ rows }: { rows: AuditRow[] }) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto" role="region" aria-label="Änderungsprotokoll" tabIndex={0}>
        <table className="w-full min-w-[52rem] text-left text-sm">
          <caption className="sr-only">Änderungsprotokoll, neueste Einträge zuerst</caption>
          <thead className="border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Zeitpunkt</th>
              <th scope="col" className="px-4 py-3 font-medium">Wer</th>
              <th scope="col" className="px-4 py-3 font-medium">Was</th>
              <th scope="col" className="px-4 py-3 font-medium">Angaben</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800 align-top">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-zinc-900/40">
                <td className="whitespace-nowrap px-4 py-3 tabular-nums text-zinc-400">
                  <time dateTime={r.createdAt.toISOString()}>{formatDateTimeCh(r.createdAt)}</time>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-zinc-100">{r.actorName || "–"}</div>
                  <span className={cn(PILL, TONE_CLASS[ACTOR_TONE[r.actorType] ?? "zinc"], "mt-1")}>{ACTOR_LABEL[r.actorType] ?? r.actorType}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-zinc-100">{auditActionLabel(r.action)}</div>
                  <div className="text-xs text-zinc-500">{auditObjectLabel(r.objectType)}</div>
                  {r.summary && <div className="mt-1 break-words text-zinc-400">{r.summary}</div>}
                </td>
                <td className="px-4 py-3">
                  <Changes before={r.before} after={r.after} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
