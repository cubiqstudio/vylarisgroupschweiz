import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { InvoiceDocument } from "@/components/verein/invoice-document";
import { PrintButton } from "@/components/verein/print-button";
import { getMessages } from "@/i18n/server";
import { beitraege } from "@/i18n/verein-beitraege";
import { getInvoiceDetail, loadInvoiceRender } from "@/lib/verein/fees-data";
import { requireModulePage } from "@/lib/verein/guard";
import { idSchema } from "@/lib/verein/validation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Rechnung drucken" };

/** Druckansicht der Rechnung mit QR-Zahlteil (A4). Im Druckdialog «Als PDF speichern» wählen. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireModulePage("fees");
  const parsed = idSchema.safeParse((await params).id);
  if (!parsed.success) notFound();
  const inv = await getInvoiceDetail(parsed.data);
  if (!inv) notFound();
  const m = await getMessages(beitraege);
  const { bill, sender, document } = await loadInvoiceRender(inv);
  return (
    <div>
      <div className="invoice-hide-print">
        <Link href={`/admin/fees/invoices/${inv.id}`} className="mb-3 inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white">
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Zurück zur Rechnung
        </Link>
      </div>
      <PrintButton label={m.portal.print} hint={m.portal.printHint} />
      <InvoiceDocument inv={document} bill={bill} sender={sender} m={m} showBillProblems />
    </div>
  );
}
