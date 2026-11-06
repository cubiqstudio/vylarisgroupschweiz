import type { Metadata } from "next";
import { Info } from "lucide-react";
import { ConfirmByToken } from "@/components/verein/events/confirm-by-token";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container, PageHeader } from "@/components/ui/section";
import { getMessages } from "@/i18n/server";
import { vereinAnlaesse } from "@/i18n/verein-anlaesse";
import { formatDateTimeCh } from "@/lib/verein/dates";
import { describeConfirmToken } from "@/lib/verein/events-confirm";
import { formatEventWhen } from "@/lib/verein/events-lib";
import { isPlausibleConfirmToken } from "@/lib/verein/events-token";

export const dynamic = "force-dynamic";

/** Der Link enthält ein Token: nicht indexieren, keinen Referrer weitergeben. */
export async function generateMetadata(): Promise<Metadata> {
  const m = (await getMessages(vereinAnlaesse)).confirmPage;
  return { title: m.metaTitle, robots: { index: false, follow: false }, referrer: "no-referrer" };
}

type Props = { params: Promise<{ token: string }> };

/** E-Mail-Adresse bestätigen (Gast-Anmeldung). Die Seite zeigt nur an; bestätigt wird erst nach dem Klick auf die Schaltfläche (POST). */
export default async function ConfirmPage({ params }: Props) {
  const m = (await getMessages(vereinAnlaesse)).confirmPage;
  const { token: rawToken } = await params;
  let decoded = rawToken;
  try {
    decoded = decodeURIComponent(rawToken);
  } catch {
    // ungültige Kodierung: bleibt wie sie ist und wird als ungültig erkannt
  }
  const token = isPlausibleConfirmToken(decoded) ? decoded : null;
  const info = token ? await describeConfirmToken(token) : null;

  const message = (() => {
    switch (info?.state) {
      case "ALREADY":
        return { title: m.alreadyTitle, text: m.alreadyText, tone: "text-sky-300" };
      case "EXPIRED":
        return { title: m.expiredTitle, text: m.expiredText, tone: "text-amber-300" };
      case "CLOSED":
        return { title: m.closedTitle, text: m.closedText, tone: "text-amber-300" };
      case "READY":
        return null;
      default:
        return { title: m.unknownTitle, text: m.unknownText, tone: "text-rose-300" };
    }
  })();

  return (
    <>
      <PageHeader eyebrow={m.eyebrow} title={m.heading} />
      <Container className="py-12">
        <Card className="mx-auto max-w-xl p-6 sm:p-8">
          {message || !info || info.state !== "READY" || !token ? (
            <div role="status" className="space-y-3">
              <Info className={`size-8 ${message?.tone ?? "text-rose-300"}`} aria-hidden />
              <h2 className="text-lg font-semibold text-white">{message?.title ?? m.unknownTitle}</h2>
              <p className="text-sm leading-relaxed text-zinc-400">{message?.text ?? m.unknownText}</p>
              <ButtonLink href="/anlaesse" variant="secondary">
                {m.allEvents}
              </ButtonLink>
            </div>
          ) : (
            <div className="space-y-6">
              <p className="text-sm leading-relaxed text-zinc-400">{m.intro}</p>
              <dl className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm">
                <div>
                  <dt className="sr-only">Anlass</dt>
                  <dd className="text-base font-semibold text-white [overflow-wrap:anywhere]">{info.eventTitle}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">{m.when}</dt>
                  <dd className="mt-0.5 text-zinc-200">{formatEventWhen(info.startsAt, info.endsAt)}</dd>
                </div>
                {info.location && (
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">{m.where}</dt>
                    <dd className="mt-0.5 text-zinc-200 [overflow-wrap:anywhere]">{info.location}</dd>
                  </div>
                )}
                {info.guestName && (
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">{m.registeredAs}</dt>
                    <dd className="mt-0.5 text-zinc-200 [overflow-wrap:anywhere]">{info.guestName}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">{m.seats}</dt>
                  <dd className="mt-0.5 text-zinc-200">{info.seats}</dd>
                </div>
                {info.note && (
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">{m.note}</dt>
                    <dd className="mt-0.5 whitespace-pre-line text-zinc-200 [overflow-wrap:anywhere]">{info.note}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">{m.validUntil}</dt>
                  <dd className="mt-0.5 text-zinc-200">{formatDateTimeCh(info.expiresAt)}</dd>
                </div>
              </dl>
              <p className="text-sm leading-relaxed text-zinc-400">{m.notYours}</p>
              <ConfirmByToken token={token} />
            </div>
          )}
        </Card>
      </Container>
    </>
  );
}
