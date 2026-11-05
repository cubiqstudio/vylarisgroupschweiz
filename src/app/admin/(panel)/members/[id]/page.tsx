import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Link2, UserCog } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PILL } from "@/components/admin/core/styles";
import { COMMUNICATION_PREF_LABEL, SALUTATION_LABEL, labelOf } from "@/lib/verein/constants";
import { formatDateCh, formatDateTimeCh, toDateInputValue, todayZurich } from "@/lib/verein/dates";
import { requireModulePage } from "@/lib/verein/guard";
import { getMemberDetail, memberHistory, openClaims } from "@/lib/verein/members-data";
import { describeExitRule, formatAddress, isExitDue, memberName, officePeriodLabel, officeState, officeTitle, OFFICE_STATE_LABEL } from "@/lib/verein/members-lib";
import { formatChf } from "@/lib/verein/money";
import { canAccess, hasBoardRole } from "@/lib/verein/permissions";
import { exitRuleOf, fiscalStartOf, getVereinSettings } from "@/lib/verein/settings";
import { listMembershipTypes } from "@/lib/verein/members-data";
import { PageTitle } from "@/components/admin/core/page-title";
import { Notice } from "@/components/admin/core/notice";
import { MemberActions } from "@/components/admin/members/member-actions";
import { MemberForm } from "@/components/admin/members/member-form";
import type { MemberFormValues } from "@/components/admin/members/member-values";
import { MembersNav } from "@/components/admin/members/members-nav";
import { OfficeAddButton, OfficeRowActions, type OfficeDTO } from "@/components/admin/members/office-actions";
import { MemberStatusPill } from "@/components/admin/members/status-pill";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mitglied" };

type Props = { params: Promise<{ id: string }> };

function Dl({ items }: { items: Array<[string, React.ReactNode]> }) {
  return (
    <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">{k}</dt>
          <dd className="mt-0.5 break-words text-sm text-zinc-200">{v || <span className="text-zinc-600">–</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

export default async function MemberDetailPage({ params }: Props) {
  const admin = await requireModulePage("members");
  const { id } = await params;
  const m = await getMemberDetail(id);
  if (!m) notFound();

  const canWrite = canAccess(admin.roles, "members", "write");
  const showNotes = hasBoardRole(admin.roles);
  const [types, settings, claims, history] = await Promise.all([listMembershipTypes(), getVereinSettings(), openClaims(m.id), memberHistory(m.id)]);
  const rule = exitRuleOf(settings);
  const fiscal = fiscalStartOf(settings);
  const name = memberName(m);
  const today = todayZurich();
  const exitDue = isExitDue(m, today);

  const initial: MemberFormValues = {
    salutation: m.salutation,
    firstName: m.firstName,
    lastName: m.lastName,
    birthDate: m.birthDate ? toDateInputValue(m.birthDate) : "",
    street: m.street,
    houseNumber: m.houseNumber,
    zip: m.zip,
    city: m.city,
    country: m.country,
    email: m.email,
    phone: m.phone,
    communicationPref: m.communicationPref,
    membershipTypeId: m.membershipTypeId ?? "",
    boardNotes: m.boardNotes,
  };

  const officeDto = (o: (typeof m.offices)[number]): OfficeDTO => ({
    id: o.id,
    kind: o.kind,
    title: o.title,
    validFrom: toDateInputValue(o.validFrom),
    validUntil: o.validUntil ? toDateInputValue(o.validUntil) : "",
    note: o.note,
    label: officeTitle(o),
    memberName: name,
  });

  const claimsText = claims.count > 0 ? `Es ${claims.count === 1 ? "ist eine Rechnung" : `sind ${claims.count} Rechnungen`} offen (CHF ${formatChf(claims.openRappen)}). Solange Forderungen offen sind, lassen sich die Personendaten nicht entfernen.` : null;

  return (
    <div>
      <PageTitle
        title={name}
        description={
          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <span>Mitglied Nr. {m.memberNumber}</span>
            <MemberStatusPill status={m.status} />
            {m.membershipType && <span className="text-zinc-500">· {m.membershipType.name}</span>}
          </span>
        }
      >
        <Link href="/admin/members" className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Zur Mitgliederliste
        </Link>
      </PageTitle>
      <MembersNav />

      <div className="space-y-6">
        {m.anonymizedAt && <Notice variant="info">Die Personendaten wurden am {formatDateTimeCh(m.anonymizedAt)} entfernt. Mitgliedernummer, Status sowie Eintritts- und Austrittsdatum bleiben für die Vereinsgeschichte erhalten.</Notice>}
        {m.status === "AKTIV" && m.exitNoticeAt && m.leftAt && (
          <Notice variant="warning">
            Austritt vorgemerkt: Erklärung vom {formatDateCh(m.exitNoticeAt)}, Mitgliedschaft endet am <strong>{formatDateCh(m.leftAt)}</strong>.
            {exitDue ? " Der Termin ist überschritten; vollziehe den Austritt, damit das Mitglied als ausgetreten geführt wird." : " Bis dahin bleibt das Mitglied aktiv."}
          </Notice>
        )}
        {m.status === "ANTRAG" && (
          <Notice variant="warning">
            Dieser Beitrittsantrag ist noch nicht geprüft{m.consentAt ? `; Statuten und Datenschutz wurden am ${formatDateTimeCh(m.consentAt)} bestätigt` : ""}. Über die Aufnahme entscheidet der Verein gemäss seinen Statuten.
          </Notice>
        )}

        {canWrite && (
          <MemberActions
            member={{
              id: m.id,
              memberNumber: m.memberNumber,
              name,
              status: m.status,
              email: m.email,
              membershipTypeId: m.membershipTypeId,
              exitNoticeAt: m.exitNoticeAt ? m.exitNoticeAt.toISOString() : null,
              leftAt: m.leftAt ? m.leftAt.toISOString() : null,
              anonymized: m.anonymizedAt !== null,
              hasUser: m.userId !== null,
            }}
            types={types.map((t) => ({ id: t.id, name: t.name, active: t.active }))}
            canWrite={canWrite}
            rule={rule}
            fiscal={fiscal}
            exitDue={exitDue}
            claimsText={claimsText}
          />
        )}

        <Card className="p-5">
          <h2 className="text-base font-semibold text-white">Mitgliedschaft</h2>
          <div className="mt-4">
            <Dl
              items={[
                ["Status", <MemberStatusPill key="s" status={m.status} />],
                ["Mitgliedschaftsart", m.membershipType ? `${m.membershipType.name} (Jahresbeitrag CHF ${formatChf(m.membershipType.annualFeeRappen)})` : ""],
                ["Antrag eingegangen", formatDateCh(m.applicationAt)],
                ["Eintritt", m.joinedAt ? formatDateCh(m.joinedAt) : ""],
                ["Austrittserklärung vom", m.exitNoticeAt ? formatDateCh(m.exitNoticeAt) : ""],
                [m.status === "AKTIV" ? "Austritt vorgemerkt per" : "Austritt / Ende", m.leftAt ? formatDateCh(m.leftAt) : ""],
                [m.status === "ABGELEHNT" ? "Interne Begründung" : m.status === "AUSGESCHLOSSEN" ? "Begründung des Ausschlusses" : "Grund des Austritts", m.exitReason],
                ["Einwilligung (Statuten, Datenschutz)", m.consentAt ? formatDateTimeCh(m.consentAt) : ""],
                ["Stimmrecht", m.membershipType ? (m.membershipType.votingRight ? "Ja" : "Nein") : ""],
                ["Offene Rechnungen", claims.count > 0 ? `${claims.count} (CHF ${formatChf(claims.openRappen)})` : "Keine"],
              ]}
            />
          </div>
          <p className="mt-4 text-xs text-zinc-500">Austrittsregel nach Einstellungen (gemäss Statuten anpassen): {describeExitRule(rule)}</p>
        </Card>

        {canWrite && !m.anonymizedAt ? (
          <MemberForm mode="edit" memberId={m.id} initial={initial} types={types.map((t) => ({ id: t.id, name: t.name, active: t.active }))} showBoardNotes={showNotes} />
        ) : (
          !m.anonymizedAt && (
            <Card className="p-5">
              <h2 className="text-base font-semibold text-white">Stammdaten</h2>
              <div className="mt-4">
                <Dl
                  items={[
                    ["Anrede", labelOf(SALUTATION_LABEL, m.salutation) === "Keine Angabe" ? "" : labelOf(SALUTATION_LABEL, m.salutation)],
                    ["Name", name],
                    ["Anschrift", formatAddress(m)],
                    ["E-Mail", m.email],
                    ["Telefon", m.phone],
                    ["Mitteilungen", labelOf(COMMUNICATION_PREF_LABEL, m.communicationPref)],
                    ...(showNotes ? ([["Vorstandsnotizen", <span key="n" className="whitespace-pre-wrap">{m.boardNotes}</span>]] as Array<[string, React.ReactNode]>) : []),
                  ]}
                />
              </div>
            </Card>
          )
        )}

        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-white">Ämter</h2>
              <p className="mt-1 text-sm text-zinc-400">Vorstand, Revisionsstelle und weitere Ämter mit Amtszeit. Das Amt ist unabhängig vom Zugang zu dieser Software.</p>
            </div>
            {canWrite && m.status === "AKTIV" && <OfficeAddButton fixedMember={{ id: m.id, memberNumber: m.memberNumber, name, city: m.city }} />}
          </div>
          {m.offices.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">Dieses Mitglied hatte bisher kein Amt.</p>
          ) : (
            <ul className="mt-4 divide-y divide-zinc-800 rounded-xl border border-zinc-800">
              {m.offices.map((o) => {
                const state = officeState(o);
                return (
                  <li key={o.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-white">{officeTitle(o)}</span>
                      <span className={cn(PILL, state === "LAUFEND" ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30" : state === "GEPLANT" ? "bg-sky-500/10 text-sky-300 ring-sky-500/30" : "bg-zinc-800/80 text-zinc-400 ring-zinc-700")}>{OFFICE_STATE_LABEL[state]}</span>
                      <span className="text-xs text-zinc-500">{officePeriodLabel(o)}</span>
                    </div>
                    {o.note && <p className="mt-1 text-xs text-zinc-500">{o.note}</p>}
                    {canWrite && (
                      <div className="mt-2">
                        <OfficeRowActions office={officeDto(o)} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-white">
            <Link2 className="h-4 w-4 text-zinc-400" aria-hidden />
            Website-Konto
          </h2>
          <div className="mt-3 space-y-2 text-sm text-zinc-300">
            {m.user ? (
              <p>
                Verknüpft mit dem Konto <span className="break-all font-medium text-white">{m.user.email}</span>
                {m.user.disabled ? " (gesperrt)" : ""}. Die Person sieht ihre Mitgliedschaft im Mitgliederbereich der Website.
              </p>
            ) : m.anonymizedAt ? (
              <p className="text-zinc-500">Keine Verknüpfung.</p>
            ) : (
              <p className="text-zinc-400">
                Kein Website-Konto verknüpft. Die Verknüpfung entsteht automatisch, sobald ein Konto mit derselben, bestätigten E-Mail-Adresse besteht und das Mitglied aktiv ist, oder du verknüpfst es von Hand.
              </p>
            )}
            {m.adminAccount && (
              <p className="flex items-center gap-1.5 text-zinc-400">
                <UserCog className="h-4 w-4" aria-hidden />
                Gehört zum Zugang «{m.adminAccount.name}» in der Verwaltung.
              </p>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-base font-semibold text-white">Verlauf</h2>
          <p className="mt-1 text-sm text-zinc-400">Änderungen an diesem Mitglied aus dem Änderungsprotokoll (neueste zuerst).</p>
          {history.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">Noch keine Einträge.</p>
          ) : (
            <ol className="mt-4 space-y-3">
              {history.map((h) => (
                <li key={h.id} className="border-l-2 border-zinc-800 pl-3">
                  <p className="text-sm text-zinc-200">{h.summary || h.action}</p>
                  <p className="text-xs text-zinc-500">
                    <time dateTime={h.createdAt.toISOString()}>{formatDateTimeCh(h.createdAt)}</time> · {h.actorName || "System"}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </div>
  );
}

