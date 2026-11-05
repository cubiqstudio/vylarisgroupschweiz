import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { MinutesSheet } from "@/components/admin/meetings/minutes-sheet";
import { PrintButton } from "@/components/verein/print-button";
import { requireModulePage } from "@/lib/verein/guard";
import { getMeetingDetail } from "@/lib/verein/meetings-data";
import { memberName } from "@/lib/verein/members-lib";
import { getVereinSettings } from "@/lib/verein/settings";
import { idSchema } from "@/lib/verein/validation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Protokoll drucken" };

/** Druckansicht des Protokolls (A4). Im Druckdialog «Als PDF speichern» wählen. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireModulePage("meetings");
  const parsed = idSchema.safeParse((await params).id);
  if (!parsed.success) notFound();
  const m = await getMeetingDetail(parsed.data);
  if (!m) notFound();
  const settings = await getVereinSettings();
  return (
    <div>
      <div className="invoice-hide-print">
        <Link href={`/admin/meetings/${m.id}?tab=protokoll`} className="mb-3 inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white">
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Zurück zum Protokoll
        </Link>
      </div>
      <PrintButton label="Drucken oder als PDF speichern" hint="Im Druckdialog deines Browsers kannst du «Als PDF speichern» wählen." />
      <MinutesSheet
        data={{
          title: m.title,
          kind: m.kind,
          startsAt: m.startsAt,
          endsAt: m.endsAt,
          location: m.location,
          leaderName: m.leader ? memberName(m.leader) : null,
          recorderName: m.recorder ? memberName(m.recorder) : null,
          minutes: m.minutes,
          approved: m.minutesApprovedAt ? { on: m.minutesApprovedAt, by: m.minutesApprovedBy || "–", note: m.minutesApprovedNote } : null,
          resolutions: m.resolutions.map((r) => ({ number: r.number, text: r.text, votesYes: r.votesYes, votesNo: r.votesNo, abstentions: r.abstentions, majority: r.majority, result: r.result, recusal: r.recusal })),
          sender: settings.senderName,
        }}
      />
    </div>
  );
}
