import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireModulePage } from "@/lib/verein/guard";
import { getNewsletterAvailability } from "@/lib/newsletter";
import { listSegmentTypes } from "@/lib/verein/newsletter-segment-data";
import { BrandMark } from "@/components/contact/brand-mark";
import { ContentHeader } from "@/components/admin/content/page-header";
import { CampaignEditor } from "@/components/admin/newsletter/campaign-editor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Neue Newsletter-Kampagne" };

export default async function NewCampaignPage() {
  const admin = await requireModulePage("newsletter");
  const [availability, activeCount, segmentTypes] = await Promise.all([
    getNewsletterAvailability(),
    db.newsletterSubscriber.count({ where: { status: "ACTIVE" } }),
    listSegmentTypes(),
  ]);

  return (
    <div>
      <Link href="/admin/newsletter" className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200">
        <ArrowLeft className="size-4" aria-hidden />
        Alle Kampagnen
      </Link>
      <ContentHeader
        eyebrow={<BrandMark tone="onLight" className="size-11 rounded-xl" />}
        title="Neue Kampagne"
        description="Schreibe Betreff und Inhalt, prüfe die Vorschau und sende eine Testmail, bevor du an die Abonnenten oder an einen Mitgliederkreis versendest."
      />
      <CampaignEditor
        activeCount={activeCount}
        segmentTypes={segmentTypes}
        mailConfigured={availability.mailConfigured}
        enabled={availability.enabled}
        defaultTestEmail={admin.email}
      />
    </div>
  );
}
