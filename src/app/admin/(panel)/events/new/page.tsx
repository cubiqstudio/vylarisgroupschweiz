import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireModulePage } from "@/lib/verein/guard";
import { PageTitle } from "@/components/admin/core/page-title";
import { EventForm } from "@/components/admin/events/event-form";
import { EMPTY_EVENT } from "@/components/admin/events/event-values";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Neuer Anlass" };

export default async function NewEventPage() {
  await requireModulePage("events", "write");
  return (
    <div>
      <PageTitle title="Neuer Anlass" description="Lege einen Anlass an. Er bleibt ein Entwurf, bis du ihn veröffentlichst.">
        <Link href="/admin/events" className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Zur Liste
        </Link>
      </PageTitle>
      <EventForm mode="create" initial={EMPTY_EVENT} />
    </div>
  );
}
