import { Hourglass } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Container, PageHeader } from "@/components/ui/section";
import { getMessages } from "@/i18n/server";
import { verein } from "@/i18n/verein";

/** Platzhalter für öffentliche Seiten (Kopfbereich + Hinweis «in Arbeit»). Wird durch die echte Seite ersetzt. */
export async function PublicInProgress({ eyebrow, heading }: { eyebrow: string; heading: string }) {
  const m = (await getMessages(verein)).inProgress;
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={heading} />
      <Container className="py-12">
        <Card className="flex flex-col items-center px-6 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800/80 text-zinc-400 ring-1 ring-inset ring-zinc-700">
            <Hourglass className="h-5 w-5" aria-hidden />
          </span>
          <h2 className="mt-4 text-lg font-semibold text-white">{m.title}</h2>
          <p className="mt-1.5 max-w-sm text-sm text-zinc-400">{m.text}</p>
        </Card>
      </Container>
    </>
  );
}

/** Platzhalter innerhalb des Mitgliederportals (der Rahmen mit Reitern kommt aus account/verein/layout.tsx). */
export async function PortalInProgress({ heading }: { heading: string }) {
  const m = (await getMessages(verein)).inProgress;
  return (
    <section aria-labelledby="portal-heading">
      <h2 id="portal-heading" className="text-xl font-semibold tracking-tight text-white">
        {heading}
      </h2>
      <Card className="mt-6 flex flex-col items-center px-6 py-14 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800/80 text-zinc-400 ring-1 ring-inset ring-zinc-700">
          <Hourglass className="h-5 w-5" aria-hidden />
        </span>
        <h3 className="mt-4 text-lg font-semibold text-white">{m.title}</h3>
        <p className="mt-1.5 max-w-sm text-sm text-zinc-400">{m.text}</p>
      </Card>
    </section>
  );
}
