import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CheckCheck, FileEdit, Mail, Send, type LucideIcon } from "lucide-react";
import { db } from "@/lib/db";
import { requireModulePage } from "@/lib/verein/guard";
import { cn, formatDateTime } from "@/lib/utils";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BrandMark } from "@/components/contact/brand-mark";
import { NewsletterTop } from "@/components/admin/newsletter/newsletter-top";
import { AutoRefresh } from "@/components/admin/newsletter/auto-refresh";
import { CampaignStatusPill, SendProgress } from "@/components/admin/newsletter/status-pill";
import { segmentLabel } from "@/lib/verein/newsletter-segment";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Newsletter" };

const ICON: Record<string, { icon: LucideIcon; tone: string }> = {
  DRAFT: { icon: FileEdit, tone: "bg-zinc-900 text-zinc-500 ring-zinc-800" },
  SENDING: { icon: Send, tone: "bg-indigo-500/10 text-indigo-300 ring-indigo-500/30" },
  SENT: { icon: CheckCheck, tone: "bg-green-500/10 text-green-800 ring-green-600/30" },
  FAILED: { icon: AlertTriangle, tone: "bg-rose-500/10 text-rose-300 ring-rose-500/40" },
};

export default async function AdminNewsletterPage() {
  await requireModulePage("newsletter");
  const campaigns = await db.newsletterCampaign.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { segmentType: { select: { name: true } } } });
  const anySending = campaigns.some((c) => c.status === "SENDING");

  return (
    <div>
      {anySending && <AutoRefresh />}
      <NewsletterTop active="campaigns" />

      {campaigns.length === 0 ? (
        <Card className="flex flex-col items-center px-6 py-16 text-center">
          <BrandMark tone="onLight" className="size-16 rounded-2xl" />
          <h2 className="mt-4 text-lg font-semibold text-white">Noch keine Kampagne</h2>
          <p className="mt-1.5 max-w-sm text-sm text-zinc-400">
            Schreibe deine erste Ausgabe mit Betreff, Vorschautext und Inhalt. Vor dem Versand siehst du die Vorschau und kannst eine Testmail an dich schicken.
          </p>
          <ButtonLink href="/admin/newsletter/campaigns/new" className="mt-6">
            <Send className="size-4" aria-hidden />
            Erste Kampagne schreiben
          </ButtonLink>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-zinc-800">
            {campaigns.map((c) => {
              const tone = ICON[c.status] ?? ICON.DRAFT;
              const Icon = tone.icon;
              const date = c.status === "SENT" && c.sentAt ? `Versendet am ${formatDateTime(c.sentAt)}` : `Erstellt am ${formatDateTime(c.createdAt)}`;
              return (
                <li key={c.id} className="relative flex gap-3.5 px-4 py-4 transition-colors hover:bg-zinc-950 sm:gap-4 sm:px-5">
                  <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset", tone.tone)} aria-hidden>
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
                      <h2 className="min-w-0 break-words text-sm font-semibold text-white sm:text-base">
                        <Link
                          href={`/admin/newsletter/campaigns/${c.id}`}
                          className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-emerald-400"
                        >
                          {c.subject}
                        </Link>
                      </h2>
                      <CampaignStatusPill status={c.status} />
                    </div>
                    {c.preheader && <p className="mt-0.5 line-clamp-1 break-words text-sm text-zinc-500">{c.preheader}</p>}
                    <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-zinc-500">
                      <span className="inline-flex items-center gap-1.5">
                        <Mail className="size-3.5" aria-hidden />
                        {c.status === "DRAFT" ? "Noch nicht versendet" : `${c.sentCount.toLocaleString("de-CH")} von ${c.recipientCount.toLocaleString("de-CH")} zugestellt`}
                      </span>
                      {c.segment !== "ALL" && <span>Empfängerkreis: {segmentLabel(c.segment, c.segmentType?.name)}</span>}
                      {c.failedCount > 0 && <span className="font-medium text-rose-400">{c.failedCount.toLocaleString("de-CH")} fehlgeschlagen</span>}
                      <time dateTime={(c.status === "SENT" && c.sentAt ? c.sentAt : c.createdAt).toISOString()} className="sm:ml-auto">
                        {date}
                      </time>
                    </div>
                    {c.status === "SENDING" && <SendProgress sent={c.sentCount} failed={c.failedCount} total={c.recipientCount} className="mt-3" />}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
