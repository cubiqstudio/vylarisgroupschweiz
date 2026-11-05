import type { Metadata } from "next";
import { headers } from "next/headers";
import { CheckCircle2, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Container, PageHeader } from "@/components/ui/section";
import { getMessages } from "@/i18n/server";
import { vereinUebersicht } from "@/i18n/verein-uebersicht";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { formatDateCh } from "@/lib/verein/dates";
import { checkCardToken, type CardCheck } from "@/lib/verein/membership-card-data";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const m = (await getMessages(vereinUebersicht)).verify;
  return { title: m.metaTitle, robots: { index: false, follow: false } };
}

/**
 * Öffentliche Prüfseite hinter dem QR-Code des Mitgliederausweises. Zeigt nur «gültiges Mitglied: Vorname N., Nr.». Bei ungültigem
 * oder unbekanntem Code erscheint keinerlei Information über Personen. Die Abfragen sind pro Adresse begrenzt (kein Durchprobieren).
 */
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const m = (await getMessages(vereinUebersicht)).verify;
  const ip = clientIp(new Request("http://localhost/", { headers: await headers() }));
  const limited = !rateLimit(`card-check:${ip}`, 30, 60_000).ok;

  let result: CardCheck = { valid: false };
  if (!limited) {
    try {
      result = await checkCardToken(decodeURIComponent(token));
    } catch {
      result = { valid: false };
    }
  }

  return (
    <>
      <PageHeader eyebrow="Verein" title={m.heading} />
      <Container className="py-12">
        <Card className="mx-auto max-w-lg px-6 py-10 text-center" role="status" aria-live="polite">
          {limited ? (
            <p className="text-sm text-zinc-400">{m.tooMany}</p>
          ) : result.valid ? (
            <>
              <CheckCircle2 className="mx-auto h-12 w-12 text-green-700" aria-hidden />
              <h2 className="mt-4 text-xl font-semibold text-white">{m.valid}</h2>
              <p className="mt-3 text-lg text-zinc-100">
                {result.shortName}, Nr. {result.memberNumber}
              </p>
              <p className="mt-1 text-sm text-zinc-400">{m.memberOf(result.clubName)}</p>
              <p className="mt-6 text-xs text-zinc-500">
                {m.asOf(formatDateCh(new Date()))}. {m.note}
              </p>
            </>
          ) : (
            <>
              <XCircle className="mx-auto h-12 w-12 text-rose-400" aria-hidden />
              <h2 className="mt-4 text-xl font-semibold text-white">{m.invalid}</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm text-zinc-400">{m.invalidText}</p>
            </>
          )}
        </Card>
      </Container>
    </>
  );
}
