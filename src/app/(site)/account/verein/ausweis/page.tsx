import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { CardPrintStyles } from "@/components/verein/print-styles-card";
import { MembershipCard } from "@/components/verein/membership-card";
import { PrintButton } from "@/components/verein/print-button";
import { Card } from "@/components/ui/card";
import { getMessages } from "@/i18n/server";
import { vereinUebersicht } from "@/i18n/verein-uebersicht";
import { findBrandAsset } from "@/lib/brand";
import { formatDateCh } from "@/lib/verein/dates";
import { requireMemberPage } from "@/lib/verein/guard";
import { getPortalMember } from "@/lib/verein/members-data";
import { cardValidity, memberSinceText, qrShape } from "@/lib/verein/membership-card";
import { cardVerifyUrl } from "@/lib/verein/membership-card-data";
import { getVereinName } from "@/lib/verein/profile";

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
  const clubName = await getVereinName();

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
            typeName={data.membershipType?.name ?? ""}
            sinceText={memberSinceText(data.joinedAt)}
            validityText={validity.text}
            valid
            qr={qrShape(cardVerifyUrl(data.id))}
            logoSrc={findBrandAsset("logo-mark-on-dark")}
            labels={{ card: m.label, memberNo: m.memberNo, type: m.type, verifyHint: m.verifyHint, qrAlt: m.verifyHint }}
          />
          <p className="ausweis-hide-print mt-4 max-w-xl text-xs text-zinc-500">
            {m.validNow(formatDateCh(new Date()))}. {m.privacy}
          </p>
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
