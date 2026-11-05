import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { db } from "@/lib/db";
import { PageTitle } from "@/components/admin/core/page-title";
import { InvoiceForm } from "@/components/admin/fees/invoice-form";
import { MissingSettingsNotice } from "@/components/admin/fees/shared";
import { addDays, todayZurich, toDateInputValue } from "@/lib/verein/dates";
import { requireModulePage } from "@/lib/verein/guard";
import { listBookingAccounts } from "@/lib/verein/ledger-link";
import { canAccess } from "@/lib/verein/permissions";
import { getVereinSettings, missingForInvoicing } from "@/lib/verein/settings";
import { idSchema } from "@/lib/verein/validation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Neue Rechnung" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function NewInvoicePage({ searchParams }: Props) {
  const admin = await requireModulePage("fees", "write");
  const sp = await searchParams;
  const memberParam = Array.isArray(sp.member) ? sp.member[0] : sp.member;
  const presetMember = memberParam && idSchema.safeParse(memberParam).success ? memberParam : "";
  const settings = await getVereinSettings();
  const today = todayZurich();
  const [members, accounts] = await Promise.all([
    db.member.findMany({
      where: { anonymizedAt: null, status: { in: ["AKTIV", "ANTRAG", "AUSGETRETEN"] } },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: 2000,
      select: { id: true, memberNumber: true, firstName: true, lastName: true, status: true },
    }),
    listBookingAccounts(),
  ]);
  return (
    <div>
      <Link href="/admin/fees" className="mb-3 inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white">
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Alle Rechnungen
      </Link>
      <PageTitle title="Neue Rechnung" description="Einzelrechnung an ein Mitglied. Sie wird als Entwurf gespeichert und erst mit «Versenden» verbindlich." />
      <MissingSettingsNotice title="Bevor du Rechnungen erstellen kannst, fehlen Angaben:" missing={missingForInvoicing(settings)} canEdit={canAccess(admin.roles, "finance_settings", "read")} />
      <InvoiceForm
        mode="new"
        members={members.map((m) => ({ id: m.id, label: `Nr. ${m.memberNumber} · ${m.lastName} ${m.firstName}${m.status === "AKTIV" ? "" : m.status === "ANTRAG" ? " (Antrag)" : " (ausgetreten)"}` }))}
        incomes={accounts.incomes}
        initial={{
          memberId: presetMember,
          subject: "",
          issueDate: toDateInputValue(today),
          dueDate: toDateInputValue(addDays(today, settings.paymentDays ?? 0)),
          notes: "",
          items: [],
        }}
      />
    </div>
  );
}
