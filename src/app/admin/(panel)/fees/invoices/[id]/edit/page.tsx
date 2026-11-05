import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PageTitle } from "@/components/admin/core/page-title";
import { InvoiceForm } from "@/components/admin/fees/invoice-form";
import { toDateInputValue } from "@/lib/verein/dates";
import { getInvoiceDetail } from "@/lib/verein/fees-data";
import { requireModulePage } from "@/lib/verein/guard";
import { listBookingAccounts } from "@/lib/verein/ledger-link";
import { toDecimalString } from "@/lib/verein/money";
import { idSchema } from "@/lib/verein/validation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Rechnung bearbeiten" };

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  await requireModulePage("fees", "write");
  const parsed = idSchema.safeParse((await params).id);
  if (!parsed.success) notFound();
  const inv = await getInvoiceDetail(parsed.data);
  if (!inv) notFound();
  if (inv.status !== "ENTWURF") redirect(`/admin/fees/invoices/${inv.id}`);
  const accounts = await listBookingAccounts();
  return (
    <div>
      <Link href={`/admin/fees/invoices/${inv.id}`} className="mb-3 inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white">
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Zurück zur Rechnung
      </Link>
      <PageTitle title={`Rechnung ${inv.number} bearbeiten`} description={`Entwurf für ${inv.recipientName}. Das Rechnungsdatum muss im Jahr ${inv.year} bleiben.`} />
      <InvoiceForm
        mode="edit"
        members={[{ id: inv.member.id, label: `Nr. ${inv.member.memberNumber} · ${inv.recipientName}` }]}
        incomes={accounts.incomes}
        initial={{
          id: inv.id,
          memberId: inv.member.id,
          subject: inv.subject,
          issueDate: toDateInputValue(inv.issueDate),
          dueDate: toDateInputValue(inv.dueDate),
          notes: inv.notes,
          items: inv.items.map((i) => ({ description: i.description, quantity: String(i.quantity), unit: toDecimalString(i.unitRappen), categoryId: i.categoryId ?? "" })),
        }}
      />
    </div>
  );
}
