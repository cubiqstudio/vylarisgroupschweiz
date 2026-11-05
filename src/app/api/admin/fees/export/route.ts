import { handle, requireAdmin } from "@/lib/api";
import { auditActor, logAudit } from "@/lib/verein/audit";
import { csvMoney, csvResponse } from "@/lib/verein/csv";
import { db } from "@/lib/db";
import { INVOICE_STATUS_LABEL, INVOICE_STATUSES, type InvoiceStatus } from "@/lib/verein/constants";
import { formatDateCh, todayZurich } from "@/lib/verein/dates";
import { getOpenItems, exportInvoiceRows } from "@/lib/verein/fees-ops";
import { openAmount } from "@/lib/verein/money";

export const dynamic = "force-dynamic";

/**
 * CSV-Export (Excel, Semikolon, UTF-8). ?type=invoices (Standard) | open (offene Posten) ; optional status, periodId.
 * Namen und Texte laufen durch den Formel-Schutz (csv.ts). Der Export wird protokolliert.
 */
export const GET = handle(async (req: Request) => {
  const admin = await requireAdmin(req);
  const sp = new URL(req.url).searchParams;
  const type = sp.get("type") === "open" ? "open" : "invoices";
  const today = todayZurich();

  let response: Response;
  let count: number;
  if (type === "open") {
    const { rows } = await getOpenItems();
    count = rows.length;
    response = csvResponse(
      `offene-posten-${formatDateCh(today).replace(/\./g, "-")}`,
      ["Rechnung", "Mitgliedernummer", "Name", "Betreff", "Rechnungsdatum", "Fällig", "Tage überfällig", "Total CHF", "Bezahlt CHF", "Offen CHF", "Mahnstufe"],
      rows.map((r) => [
        r.number,
        r.member.memberNumber,
        r.recipientName,
        r.subject,
        r.issueDate,
        r.dueDate,
        Math.max(0, Math.round((today.getTime() - r.dueDate.getTime()) / 86_400_000)),
        csvMoney(r.totalRappen),
        csvMoney(r.paidRappen),
        csvMoney(openAmount(r.totalRappen, r.paidRappen)),
        r.reminderLevel,
      ]),
    );
  } else {
    const status = sp.get("status") ?? undefined;
    const statusOk = !status || status === "UEBERFAELLIG" || (INVOICE_STATUSES as readonly string[]).includes(status);
    const rows = await exportInvoiceRows({ status: statusOk ? status : undefined, periodId: sp.get("periodId") ?? undefined });
    count = rows.length;
    response = csvResponse(
      `rechnungen-${formatDateCh(today).replace(/\./g, "-")}`,
      ["Rechnung", "Mitgliedernummer", "Name", "Betreff", "Rechnungsdatum", "Fällig", "Status", "Zahlungsstand", "Total CHF", "Bezahlt CHF", "Offen CHF", "Bezahlt am", "Mahnstufe"],
      rows.map((r) => [
        r.number,
        r.member.memberNumber,
        r.recipientName,
        r.subject,
        r.issueDate,
        r.dueDate,
        INVOICE_STATUS_LABEL[r.status as InvoiceStatus] ?? r.status,
        r.stateLabel,
        csvMoney(r.totalRappen),
        csvMoney(r.paidRappen),
        csvMoney(openAmount(r.totalRappen, r.paidRappen)),
        r.paidAt,
        r.reminderLevel,
      ]),
    );
  }
  await db.$transaction((tx) =>
    logAudit(tx, { actor: auditActor(admin), action: "export.invoices", objectType: "Invoice", summary: `Export ${type === "open" ? "offene Posten" : "Rechnungen"} (${count} Zeilen)`, after: { type, count } }),
  );
  return response;
});
