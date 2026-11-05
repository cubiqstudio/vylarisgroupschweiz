import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { InvoiceDocument } from "@/components/verein/invoice-document";
import { PrintButton } from "@/components/verein/print-button";
import { getMessages } from "@/i18n/server";
import { beitraege } from "@/i18n/verein-beitraege";
import { getInvoiceForMember, loadInvoiceRender } from "@/lib/verein/fees-data";
import { requireMemberPage } from "@/lib/verein/guard";
import { idSchema } from "@/lib/verein/validation";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages(beitraege);
  return { title: m.meta.invoice, robots: { index: false, follow: false } };
}

/** Eine eigene Rechnung mit QR-Zahlteil. Fremde oder unbekannte IDs ergeben 404 (Abfrage immer mit memberId). */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const member = await requireMemberPage(`/account/verein/beitraege/${encodeURIComponent(id)}`);
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) notFound();
  const inv = await getInvoiceForMember(member.id, parsed.data);
  if (!inv) notFound();
  const m = await getMessages(beitraege);
  const { bill, sender, document } = await loadInvoiceRender(inv);
  return (
    <div>
      <div className="invoice-hide-print">
        <Link href="/account/verein/beitraege" className="mb-3 inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white">
          <ChevronLeft className="h-4 w-4" aria-hidden />
          {m.portal.back}
        </Link>
      </div>
      <PrintButton label={m.portal.print} hint={m.portal.printHint} />
      <InvoiceDocument inv={document} bill={bill} sender={sender} m={m} />
    </div>
  );
}
