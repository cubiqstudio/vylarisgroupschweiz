import type { Metadata } from "next";
import { Info } from "lucide-react";
import { CancelByToken } from "@/components/verein/events/cancel-by-token";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container, PageHeader } from "@/components/ui/section";
import { getMessages } from "@/i18n/server";
import { vereinAnlaesse } from "@/i18n/verein-anlaesse";
import { describeCancelToken } from "@/lib/verein/events-ops";
import { formatEventWhen } from "@/lib/verein/events-lib";
import { isPlausibleCancelToken } from "@/lib/verein/events-token";

export const dynamic = "force-dynamic";

/** Der Link enthält ein persönliches Token: nicht indexieren, keinen Referrer weitergeben. */
export async function generateMetadata(): Promise<Metadata> {
  const m = (await getMessages(vereinAnlaesse)).cancelPage;
  return { title: m.metaTitle, robots: { index: false, follow: false }, referrer: "no-referrer" };
}

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Abmelden von einem Anlass über den Link aus der Bestätigungsmail (Token). Zeigt zuerst, worum es geht; abgemeldet wird erst nach dem Klick. */
export default async function CancelPage({ params, searchParams }: Props) {
  const m = (await getMessages(vereinAnlaesse)).cancelPage;
  const { id } = await params;
  const sp = await searchParams;
  const raw = Array.isArray(sp.token) ? sp.token[0] : sp.token;
  const token = isPlausibleCancelToken(raw) ? raw : null;
  const info = token ? await describeCancelToken(token, id) : null;

  return (
    <>
      <PageHeader eyebrow={m.eyebrow} title={m.heading} />
      <Container className="py-12">
        <Card className="mx-auto max-w-xl p-6 sm:p-8">
          {!info || !token ? (
            <div role="status" className="space-y-3">
              <Info className="size-8 text-rose-300" aria-hidden />
              <h2 className="text-lg font-semibold text-white">{m.unknownTitle}</h2>
              <p className="text-sm leading-relaxed text-zinc-400">{m.unknownText}</p>
              <ButtonLink href="/anlaesse" variant="secondary">
                {m.allEvents}
              </ButtonLink>
            </div>
          ) : info.status === "ABGESAGT" ? (
            <div role="status" className="space-y-3">
              <Info className="size-8 text-sky-300" aria-hidden />
              <h2 className="text-lg font-semibold text-white">{m.alreadyTitle}</h2>
              <p className="text-sm leading-relaxed text-zinc-400">{m.alreadyText}</p>
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
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">{m.seats}</dt>
                  <dd className="mt-0.5 text-zinc-200">{info.seats}</dd>
                </div>
              </dl>
              {info.canCancel ? (
                <CancelByToken token={token} />
              ) : (
                <div role="status" className="space-y-1">
                  <h2 className="text-lg font-semibold text-white">{m.startedTitle}</h2>
                  <p className="text-sm text-zinc-400">{m.startedText}</p>
                </div>
              )}
            </div>
          )}
        </Card>
      </Container>
    </>
  );
}
