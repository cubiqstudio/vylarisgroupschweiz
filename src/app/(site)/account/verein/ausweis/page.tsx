import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronDown, ShieldCheck } from "lucide-react";
import { CopyField } from "@/components/admin/licenses/copy-field";
import { CardPrintStyles } from "@/components/verein/print-styles-card";
import { MembershipCard } from "@/components/verein/membership-card";
import { PrintButton } from "@/components/verein/print-button";
import { Card } from "@/components/ui/card";
import { getMessages } from "@/i18n/server";
import { vereinUebersicht } from "@/i18n/verein-uebersicht";
import { findBrandAsset } from "@/lib/brand";
import { db } from "@/lib/db";
import { formatDateCh } from "@/lib/verein/dates";
import { requireMemberPage } from "@/lib/verein/guard";
import { getPortalMember } from "@/lib/verein/members-data";
import { cardValidity, memberSinceText, qrShape } from "@/lib/verein/membership-card";
import { cardVerifyUrl } from "@/lib/verein/membership-card-data";
import { site } from "@/lib/site";
import { getVereinProfile, profileDisplayName } from "@/lib/verein/profile";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const m = (await getMessages(vereinUebersicht)).card;
  return { title: m.metaTitle, robots: { index: false, follow: false } };
}

/** Mitgliederausweis des angemeldeten Mitglieds mit Druckansicht. Nur eigene Daten (die Mitglieds-ID kommt aus der Sitzung). */
export default async function Page() {
  const member = await requireMemberPage("/account/verein/ausweis");
  const m = (await getMessages(vereinUebersicht)).card;
  const data = await getPortalMember(member.id);
  const validity = data ? cardValidity(data) : { valid: false, text: "" };
  // Vorderseite: eingetragener Vereinsname aus den Einstellungen, sonst der Name der Website («VylarisGroup Schweiz»).
  const clubName = profileDisplayName(await getVereinProfile().catch(() => ({ name: "" })), site.name);
  const verifyUrl = data ? cardVerifyUrl(data.id, data.cardVersion) : "";
  // NFC-Karten bekommt nur der Vorstand: der Bereich erscheint nur, wenn das Mitglied ein Admin-Konto hat. Alle anderen
  // Mitglieder bekommen normale Plastikkarten mit QR-Code.
  const showNfc = Boolean(await db.adminUser.findFirst({ where: { memberId: member.id }, select: { id: true } }).catch(() => null));

  return (
    <section aria-labelledby="card-heading">
      <div className="ausweis-hide-print">
        <Link href="/account/verein" className="mb-3 inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white">
          <ChevronLeft className="h-4 w-4" aria-hidden />
          {m.back}
        </Link>
        <h2 id="card-heading" className="text-xl font-semibold tracking-tight text-white">
          {m.heading}
        </h2>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-zinc-400">{m.intro}</p>
      </div>

      {data && validity.valid ? (
        <div className="mt-6">
          <CardPrintStyles />
          <div className="ausweis-hide-print">
            <PrintButton label={m.print} hint={m.printHint} />
          </div>
          <MembershipCard
            clubName={clubName}
            memberName={`${data.firstName} ${data.lastName}`.trim()}
            memberNumber={data.memberNumber}
            sinceText={memberSinceText(data.joinedAt)}
            qr={qrShape(verifyUrl)}
            logoSrc={findBrandAsset("logo-mark-on-dark")}
            labels={{ card: m.label, memberNo: m.memberNo, front: m.faceFront, back: m.faceBack, qrAlt: m.qrAlt }}
          />
          <div className="ausweis-hide-print mt-6 max-w-[58rem] space-y-4">
            <p className="flex items-start gap-2 text-sm text-zinc-300">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
              <span>{m.status(validity.text, formatDateCh(new Date()))}</span>
            </p>
            <p className="max-w-2xl text-xs text-zinc-500">{m.privacy}</p>
            {showNfc && (
            <details className="group rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-zinc-200 [&::-webkit-details-marker]:hidden">
                {m.nfc.title}
                <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <div className="mt-3 space-y-3">
                <CopyField label={m.nfc.field} value={verifyUrl} />
                <p className="text-sm leading-relaxed text-zinc-400">{m.nfc.text}</p>
                <p className="text-sm leading-relaxed text-zinc-400">{m.nfc.warning}</p>
              </div>
            </details>
            )}
          </div>
        </div>
      ) : (
        <Card className="mt-6 px-6 py-10 text-center">
          <h3 className="text-lg font-semibold text-white">{m.notActiveTitle}</h3>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-zinc-400">{m.notActive}</p>
        </Card>
      )}
    </section>
  );
}
