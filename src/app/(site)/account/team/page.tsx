import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Inbox } from "lucide-react";
import { Avatar } from "@/components/account/avatar";
import { AvatarUpload } from "@/components/account/avatar-upload";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/section";
import { getMessages } from "@/i18n/server";
import { account } from "@/i18n/account";
import { getViewer } from "@/lib/auth";
import { db } from "@/lib/db";
import { teamTicketCounts } from "@/lib/team";
import { teamTicketsHref } from "@/components/team/team-filters";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages(account);
  return { title: t.meta.team.title, robots: { index: false, follow: false } };
}

export default async function TeamAreaPage() {
  const viewer = await getViewer();
  if (!viewer || !viewer.isTeam) notFound();
  const t = await getMessages(account);

  const members = await db.user.findMany({
    where: { isTeam: true, disabled: false },
    orderBy: { name: "asc" },
    select: { id: true, name: true, teamTitle: true, avatarType: true },
  });
  // Ticket-Kennzahlen nur für Website-Konten (Admins bearbeiten Tickets im Admin-Bereich)
  const ticketCounts = viewer.kind === "user" ? await teamTicketCounts(viewer.id) : null;
  const me = viewer.kind === "user" ? members.find((m) => m.id === viewer.id) : undefined;

  return (
    <Container className="py-10 sm:py-14">
      <div className="mx-auto max-w-3xl space-y-6">
        <Card className="p-6 sm:p-8">
          <h2 className="text-lg font-semibold tracking-tight text-white">{t.team.profileTitle}</h2>
          {viewer.kind === "user" ? (
            <>
              <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                {t.team.profileText}
                {me?.teamTitle ? t.team.yourRole(me.teamTitle) : ""}
              </p>
              <div className="mt-6">
                <AvatarUpload userId={viewer.id} name={viewer.name} hasAvatar={viewer.hasAvatar} />
              </div>
            </>
          ) : (
            <p className="mt-1 text-sm leading-relaxed text-zinc-400">{t.team.adminText}</p>
          )}
        </Card>

        {ticketCounts && (
          <Card className="p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-white">
                  <Inbox className="h-5 w-5 text-emerald-400" aria-hidden />
                  Tickets
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-zinc-400">Anfragen aus dem Kontaktformular bearbeiten, beantworten und zuweisen.</p>
              </div>
              <Link
                href="/account/team/tickets"
                className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-emerald-400 hover:text-emerald-300"
              >
                Öffnen
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
            <dl className="mt-5 grid gap-3 sm:grid-cols-2">
              <Link
                href={teamTicketsHref({ status: "OPEN" })}
                className="rounded-xl border border-zinc-800 p-4 transition-colors hover:border-zinc-700 hover:bg-zinc-950"
              >
                <dt className="text-sm text-zinc-400">Offene Tickets</dt>
                <dd className="mt-1 text-3xl font-semibold tabular-nums text-white">{ticketCounts.open.toLocaleString("de-DE")}</dd>
              </Link>
              <Link
                href={teamTicketsHref({ mine: true })}
                className="rounded-xl border border-zinc-800 p-4 transition-colors hover:border-zinc-700 hover:bg-zinc-950"
              >
                <dt className="text-sm text-zinc-400">Mir zugewiesen</dt>
                <dd className="mt-1 text-3xl font-semibold tabular-nums text-white">{ticketCounts.mineOpen.toLocaleString("de-DE")}</dd>
              </Link>
            </dl>
          </Card>
        )}

        <Card className="p-6 sm:p-8">
          <h2 className="text-lg font-semibold tracking-tight text-white">{t.team.teamTitle}</h2>
          {members.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-400">{t.team.empty}</p>
          ) : (
            <ul className="mt-5 grid gap-4 sm:grid-cols-2">
              {members.map((m) => (
                <li key={m.id} className="flex items-center gap-3 rounded-xl border border-zinc-800 p-3">
                  <Avatar name={m.name} userId={m.id} hasImage={!!m.avatarType} size={44} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{m.name}</p>
                    <p className="truncate text-xs text-zinc-500">{m.teamTitle || t.team.member}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </Container>
  );
}
