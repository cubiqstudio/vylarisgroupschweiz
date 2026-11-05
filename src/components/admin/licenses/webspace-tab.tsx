import Link from "next/link";
import { Server } from "lucide-react";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";
import { Button, buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/form";
import { EmptyState } from "./empty-state";
import { StatusPill } from "./status-pill";
import { WebspaceActions } from "./webspace-actions";
import { REQUEST_STATUS_LABEL } from "./types";

const STATUSES = Object.keys(REQUEST_STATUS_LABEL);
const first = (v: string | string[] | undefined): string => (Array.isArray(v) ? v[0] : v) ?? "";

export async function WebspaceTab({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const status = STATUSES.includes(first(searchParams.status)) ? first(searchParams.status) : "";
  const items = await db.webspaceRequest.findMany({
    where: status ? { status } : {},
    orderBy: [{ createdAt: "desc" }],
    take: 200,
    select: {
      id: true,
      status: true,
      message: true,
      adminNote: true,
      createdAt: true,
      decidedAt: true,
      user: { select: { name: true, email: true, companyName: true } },
      product: { select: { name: true } },
    },
  });
  // Wartende zuerst, sonst nach Datum (die Sortierung ist stabil).
  items.sort((a, b) => Number(b.status === "PENDING") - Number(a.status === "PENDING"));

  return (
    <>
      <form method="get" action="/admin/licenses" role="search" className="mb-6 flex gap-2">
        <input type="hidden" name="tab" value="webspace" />
        <div className="w-48">
          <label htmlFor="ws-status" className="sr-only">
            Status
          </label>
          <Select id="ws-status" name="status" defaultValue={status}>
            <option value="">Alle Status</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {REQUEST_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="secondary">
          Filtern
        </Button>
        {status && (
          <Link href="/admin/licenses?tab=webspace" className={buttonClass("ghost", "md")}>
            Zurücksetzen
          </Link>
        )}
      </form>

      {items.length === 0 ? (
        <EmptyState
          icon={Server}
          title={status ? "Keine passenden Anträge" : "Noch keine Webspace-Anträge"}
          text={status ? "Zu diesem Status gibt es keine Anträge." : "Nutzer, die keine Firmenkunden sind, können ein Webspace-Konto beantragen. Die Anträge erscheinen hier."}
        />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-zinc-800">
            {items.map((r) => (
              <li key={r.id} className="px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                  <h2 className="text-sm font-semibold text-white sm:text-base">{r.product.name}</h2>
                  <StatusPill status={r.status} kind="request" />
                </div>
                <p className="mt-1 text-sm text-zinc-300">
                  {r.user.name} <span className="break-all text-zinc-400">· {r.user.email}</span>
                  {r.user.companyName && <span className="text-zinc-400"> · {r.user.companyName}</span>}
                </p>
                {r.message && (
                  <p className="mt-2 max-w-3xl whitespace-pre-line break-words rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm text-zinc-300">
                    <span className="mb-0.5 block text-xs font-medium text-zinc-500">Wunsch des Nutzers</span>
                    {r.message}
                  </p>
                )}
                {r.adminNote && (
                  <p className="mt-2 max-w-3xl whitespace-pre-line break-words text-sm text-zinc-400">
                    <span className="text-xs font-medium text-zinc-500">Hinweis an den Nutzer: </span>
                    {r.adminNote}
                  </p>
                )}
                <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-zinc-500">
                  <div className="flex gap-1.5">
                    <dt>Beantragt:</dt>
                    <dd>
                      <time dateTime={r.createdAt.toISOString()}>{formatDateTime(r.createdAt)}</time>
                    </dd>
                  </div>
                  {r.decidedAt && (
                    <div className="flex gap-1.5">
                      <dt>Entschieden:</dt>
                      <dd>
                        <time dateTime={r.decidedAt.toISOString()}>{formatDateTime(r.decidedAt)}</time>
                      </dd>
                    </div>
                  )}
                </dl>
                {r.status === "PENDING" && (
                  <div className="mt-3">
                    <WebspaceActions id={r.id} label={`${r.product.name}, ${r.user.email}`} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
