import type { Metadata } from "next";
import { Download } from "lucide-react";
import { MembershipExit } from "@/components/verein/members/membership-exit";
import { MembershipProfileForm } from "@/components/verein/members/membership-profile-form";
import { MemberStatusPill } from "@/components/admin/members/status-pill";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getMessages } from "@/i18n/server";
import { verein } from "@/i18n/verein";
import { vereinMitglieder } from "@/i18n/verein-mitglieder";
import { formatDateCh } from "@/lib/verein/dates";
import { requireMemberPage } from "@/lib/verein/guard";
import { getPortalMember, previewOwnExit } from "@/lib/verein/members-data";
import { officePeriodLabel, officeState, officeTitle, memberName } from "@/lib/verein/members-lib";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const m = (await getMessages(verein)).portal;
  return { title: m.meta.membership, robots: { index: false, follow: false } };
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-zinc-200">{children || <span className="text-zinc-600">–</span>}</dd>
    </div>
  );
}

/** Eigene Mitgliedschaft: Angaben ansehen und ändern, Austritt erklären, eigene Daten herunterladen. Nur Daten des angemeldeten Mitglieds. */
export default async function MembershipPage() {
  const member = await requireMemberPage("/account/verein/mitgliedschaft");
  const portal = (await getMessages(verein)).portal;
  const m = (await getMessages(vereinMitglieder)).membership;
  const data = await getPortalMember(member.id);
  if (!data) notFound();

  const editable = !data.anonymizedAt && (data.status === "AKTIV" || data.status === "ANTRAG");
  const canExit = data.status === "AKTIV" && !data.exitNoticeAt;
  const plan = canExit ? await previewOwnExit() : null;
  const offices = data.offices.filter((o) => officeState(o) !== "BEENDET");

  return (
    <section aria-labelledby="membership-heading" className="space-y-8">
      <div>
        <h2 id="membership-heading" className="text-xl font-semibold tracking-tight text-white">
          {portal.tabs.membership}
        </h2>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-zinc-400">{m.intro}</p>
      </div>

      {data.status === "ANTRAG" && <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{m.applicationPending}</p>}
      {(data.status === "AUSGETRETEN" || data.status === "AUSGESCHLOSSEN" || data.status === "VERSTORBEN") && (
        <p className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-sm text-zinc-300">{m.formerMember}</p>
      )}

      <Card className="p-6">
        <h3 className="text-base font-semibold text-white">{m.summary.title}</h3>
        <dl className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <Row label={m.summary.number}>{data.memberNumber}</Row>
          <Row label={m.summary.status}>
            <MemberStatusPill status={data.status} />
          </Row>
          <Row label={m.summary.name}>{memberName(data)}</Row>
          <Row label={m.summary.email}>{data.email}</Row>
          <Row label={m.summary.type}>{data.membershipType?.name}</Row>
          <Row label={m.summary.voting}>{data.membershipType ? (data.membershipType.votingRight ? m.summary.yes : m.summary.no) : ""}</Row>
          <Row label={m.summary.application}>{formatDateCh(data.applicationAt)}</Row>
          <Row label={m.summary.joined}>{data.joinedAt ? formatDateCh(data.joinedAt) : ""}</Row>
          {data.exitNoticeAt && <Row label={m.summary.exitNotice}>{formatDateCh(data.exitNoticeAt)}</Row>}
          {data.leftAt && <Row label={data.status === "AKTIV" ? m.summary.exitDate : m.summary.left}>{formatDateCh(data.leftAt)}</Row>}
        </dl>
        {offices.length > 0 && (
          <div className="mt-6 border-t border-zinc-800 pt-4">
            <h4 className="text-sm font-semibold text-white">{m.offices.title}</h4>
            <ul className="mt-2 space-y-1 text-sm text-zinc-300">
              {offices.map((o) => (
                <li key={o.id}>
                  {officeTitle(o)} <span className="text-zinc-500">({officePeriodLabel(o)})</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h3 className="text-base font-semibold text-white">{m.edit.title}</h3>
        {editable ? (
          <>
            <p className="mt-1 text-sm text-zinc-400">{m.edit.hint}</p>
            <div className="mt-5">
              <MembershipProfileForm
                initial={{
                  salutation: data.salutation,
                  street: data.street,
                  houseNumber: data.houseNumber,
                  zip: data.zip,
                  city: data.city,
                  country: data.country,
                  phone: data.phone,
                  communicationPref: data.communicationPref,
                }}
              />
            </div>
            <p className="mt-5 text-sm text-zinc-500">{m.edit.emailNote}</p>
          </>
        ) : (
          <p className="mt-1 text-sm text-zinc-400">{m.edit.readOnly}</p>
        )}
      </Card>

      {data.status === "AKTIV" && (
        <Card className="p-6">
          <h3 className="text-base font-semibold text-white">{m.exit.title}</h3>
          <div className="mt-3">
            {data.exitNoticeAt && data.leftAt ? (
              <div className="space-y-2">
                <p className="text-sm text-zinc-300">{m.exit.pending(formatDateCh(data.leftAt))}</p>
                <p className="text-sm text-zinc-500">{m.exit.withdrawHint}</p>
              </div>
            ) : plan ? (
              <MembershipExit earliest={formatDateCh(plan.effective)} />
            ) : (
              <p className="text-sm text-zinc-400">{m.exit.notPossible}</p>
            )}
          </div>
        </Card>
      )}

      <Card className="p-6">
        <h3 className="text-base font-semibold text-white">{m.data.title}</h3>
        <p className="mt-1 text-sm text-zinc-400">{m.data.text}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href="/api/account/verein/membership/export?format=json" download className={buttonClass("secondary", "md")}>
            <Download className="size-4" aria-hidden />
            {m.data.json}
          </a>
          <a href="/api/account/verein/membership/export?format=csv" download className={buttonClass("secondary", "md")}>
            <Download className="size-4" aria-hidden />
            {m.data.csv}
          </a>
        </div>
        <p className="mt-3 text-xs text-zinc-500">{m.data.note}</p>
      </Card>
    </section>
  );
}
