import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/section";
import { InvoiceDocument } from "@/components/verein/invoice-document";
import { PrintButton } from "@/components/verein/print-button";
import { getMessages } from "@/i18n/server";
import { beitraege } from "@/i18n/verein-beitraege";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { getInvoiceByViewToken, loadInvoiceRender } from "@/lib/verein/fees-data";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages(beitraege);
  return { title: m.publicView.metaTitle, robots: { index: false, follow: false, nocache: true }, referrer: "no-referrer" };
}

/**
 * Rechnung über den persönlichen Link aus der Mail (ohne Konto). Das Token steht nur in der Mail, in der Datenbank liegt sein Hash.
 * Die Seite wird nicht indexiert und nicht gecacht; ungültige Links ergeben immer dieselbe Antwort (404). Zugriffe pro IP sind begrenzt.
 */
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const h = await headers();
  const ip = clientIp(new Request("http://local", { headers: h }));
  const limit = rateLimit(`invoice-view:${ip}`, 60, 10 * 60 * 1000);
  if (!limit.ok) notFound();
  const inv = await getInvoiceByViewToken(token);
  if (!inv) notFound();
  const m = await getMessages(beitraege);
  const { bill, sender, document } = await loadInvoiceRender(inv);
  return (
    <Container className="py-10 sm:py-14">
      <div className="invoice-hide-print mb-4">
        <h1 className="text-xl font-semibold tracking-tight text-white">{m.meta.publicInvoice}</h1>
        <p className="mt-1 text-sm text-zinc-400">{m.publicView.note}</p>
      </div>
      <PrintButton label={m.portal.print} hint={m.portal.printHint} />
      <InvoiceDocument inv={document} bill={bill} sender={sender} m={m} />
    </Container>
  );
}
