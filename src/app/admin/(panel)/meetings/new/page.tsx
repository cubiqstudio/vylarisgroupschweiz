import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireModulePage } from "@/lib/verein/guard";
import { PageTitle } from "@/components/admin/core/page-title";
import { MeetingForm } from "@/components/admin/meetings/meeting-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Neue Sitzung" };

export default async function NewMeetingPage() {
  await requireModulePage("meetings", "write");
  return (
    <div>
      <Link href="/admin/meetings" className="mb-3 inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white">
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Alle Sitzungen
      </Link>
      <PageTitle title="Neue Sitzung" description="Lege Art, Zeit und Ort fest. Traktanden, Einladung und Protokoll ergänzt du danach." />
      <MeetingForm canWrite />
    </div>
  );
}
