import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth";
import { getNewsletterAvailability, serializeCampaign } from "@/lib/newsletter";
import { formatDateTime } from "@/lib/utils";
import { BrandMark } from "@/components/contact/brand-mark";
import { ContentHeader } from "@/components/admin/content/page-header";
import { CampaignEditor } from "@/components/admin/newsletter/campaign-editor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Newsletter-Kampagne" };

type Props = { params: Promise<{ id: string }> };

export default async function EditCampaignPage({ params }: Props) {
  const admin = await requireAdminPage();
  const { id } = await params;

  const campaign = await db.newsletterCampaign.findUnique({ where: { id } });
  if (!campaign) notFound();

  const [availability, activeCount, failures] = await Promise.all([
    getNewsletterAvailability(),
    db.newsletterSubscriber.count({ where: { status: "ACTIVE" } }),
    campaign.failedCount > 0
      ? db.newsletterDelivery.findMany({
          where: { campaignId: id, status: "FAILED" },
          orderBy: { id: "asc" },
          take: 50,
          select: { id: true, error: true, subscriber: { select: { email: true } } },
        })
      : Promise.resolve([]),
  ]);

  const draft = campaign.status === "DRAFT";
  return (
    <div>
      <Link href="/admin/newsletter" className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200">
        <ArrowLeft className="size-4" aria-hidden />
        Alle Kampagnen
      </Link>
      <ContentHeader
        eyebrow={<BrandMark tone="onLight" className="size-11 rounded-xl" />}
        title={draft ? "Kampagne bearbeiten" : "Kampagne"}
        description={
          draft
            ? `Zuletzt geändert am ${formatDateTime(campaign.updatedAt)}.`
            : `Erstellt am ${formatDateTime(campaign.createdAt)}. Versendete Kampagnen sind schreibgeschützt.`
        }
      />
      <CampaignEditor
        key={campaign.id}
        campaign={{ ...serializeCampaign(campaign), failures: failures.map((f) => ({ id: f.id, email: f.subscriber.email, error: f.error })) }}
        activeCount={activeCount}
        mailConfigured={availability.mailConfigured}
        enabled={availability.enabled}
        defaultTestEmail={admin.email}
      />
    </div>
  );
}
