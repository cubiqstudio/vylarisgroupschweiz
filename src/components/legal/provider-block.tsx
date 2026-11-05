import type { ReactNode } from "react";
import { SITES } from "@/lib/sites";
import type { getLegal } from "@/lib/legal";
import { legalUi } from "@/i18n/legal";
import { getMessages } from "@/i18n/server";

type Legal = Awaited<ReturnType<typeof getLegal>>;

/** Kennzeichnet eine noch fehlende Pflichtangabe. */
export async function MissingValue() {
  const m = await getMessages(legalUi);
  return (
    <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-sm text-amber-300 ring-1 ring-inset ring-amber-500/30">
      {m.missingValue}
    </span>
  );
}

async function Mail({ email }: { email?: string }) {
  if (!email) return <MissingValue />;
  return <a href={`mailto:${email}`}>{email}</a>;
}

/**
 * Anbieter-/Verantwortlichen-Anschrift aus getLegal(); fehlende Pflichtangaben werden markiert.
 * Die Anschrift gehört dem Betreiber VylarisGroupEurope – auch auf vylaris.de (gleiche Anschrift).
 */
export function ProviderAddress({
  legal,
  name = SITES.eu.name,
}: {
  legal: Legal;
  name?: string;
}) {
  return (
    <address className="not-italic leading-relaxed">
      <strong>{name}</strong>
      <br />
      {legal.street ?? <MissingValue />}
      <br />
      {legal.zipCity ?? <MissingValue />}
      <br />
      {legal.country}
    </address>
  );
}

/** Definitionsliste mit Zeilen (Label links, Wert rechts) für Impressum-Angaben. */
export function FactList({ children }: { children: ReactNode }) {
  return (
    <dl className="divide-y divide-zinc-800 rounded-xl border border-zinc-800 bg-zinc-900/40 !mt-5">
      {children}
    </dl>
  );
}

export function Fact({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1 px-4 py-3.5 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-6">
      <dt className="text-sm font-medium text-zinc-400">{label}</dt>
      <dd className="min-w-0 break-words text-zinc-200">{children}</dd>
    </div>
  );
}

export { Mail as EmailValue };
