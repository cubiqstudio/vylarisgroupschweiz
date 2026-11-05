import type { ReactNode } from "react";
import { SITE } from "@/lib/sites";
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
 * Anbieter-/Verantwortlichen-Anschrift aus getLegal(). Das Impressum zeigt nur, was vorhanden und eingeschaltet ist
 * (nie leere Zeilen); der Verantwortliche der Datenschutzerklärung ist Pflicht und markiert Fehlendes (markMissing).
 */
export function ProviderAddress({
  legal,
  name = SITE.legalName,
  showName = true,
  showAddress = true,
  markMissing = false,
}: {
  legal: Legal;
  name?: string;
  showName?: boolean;
  showAddress?: boolean;
  markMissing?: boolean;
}) {
  const lines: ReactNode[] = [];
  if (showName) lines.push(<strong key="name">{name}</strong>);
  if (showAddress) {
    if (legal.street) lines.push(legal.street);
    else if (markMissing) lines.push(<MissingValue key="street" />);
    if (legal.zipCity) lines.push(legal.zipCity);
    else if (markMissing) lines.push(<MissingValue key="zip" />);
    if (legal.country) lines.push(legal.country);
  }
  if (lines.length === 0) return null;
  return (
    <address className="not-italic leading-relaxed">
      {lines.map((line, i) => (
        <span key={i}>
          {i > 0 && <br />}
          {line}
        </span>
      ))}
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
