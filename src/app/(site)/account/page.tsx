import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, ArrowRight, BookOpen, Building2, Inbox, KeyRound, LifeBuoy, LockKeyhole, Mail, Server, Settings, ShieldCheck, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ThemeSwitch } from "@/components/theme/theme-switch";
import { themeMsgs } from "@/i18n/theme";
import { Container } from "@/components/ui/section";
import { getMessages, getSite } from "@/i18n/server";
import { account } from "@/i18n/account";
import { licenses } from "@/i18n/licenses";
import { getCurrentAdmin, getViewer } from "@/lib/auth";
import { getCurrentMember } from "@/lib/verein/guard";
import { formatDate } from "@/lib/utils";
import { db } from "@/lib/db";
import { canAccess, moduleForPath } from "@/lib/verein/permissions";
import { verein } from "@/i18n/verein";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages(account);
  return {
    title: m.meta.overview.title,
    robots: { index: false, follow: false },
  };
}

type Tile = {
  href: string;
  title: string;
  text: string;
  icon: React.ComponentType<{ className?: string }>;
  highlight?: boolean;
};

function TileCard({ t, open }: { t: Tile; open: string }) {
  return (
    <Link
      href={t.href}
      className={`group flex h-full flex-col rounded-2xl border p-5 transition-colors hover:border-emerald-400/60 ${
        t.highlight ? "border-emerald-400/40 bg-emerald-400/5" : "border-zinc-800 bg-surface"
      }`}
    >
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-400 ring-1 ring-inset ring-emerald-400/20">
        <t.icon className="h-5 w-5" />
      </span>
      <h3 className="mt-4 text-base font-semibold text-white">{t.title}</h3>
      <p className="mt-1 flex-1 text-sm leading-relaxed text-zinc-400">{t.text}</p>
      <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-emerald-400">
        {open} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </span>
    </Link>
  );
}

function Group({ title, tiles, open }: { title: string; tiles: Tile[]; open: string }) {
  if (tiles.length === 0) return null;
  return (
    <section className="mt-10 first:mt-0">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-zinc-500">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <TileCard key={t.href} t={t} open={open} />
        ))}
      </div>
    </section>
  );
}

export default async function AccountOverviewPage() {
  const site = await getSite();
  const m = await getMessages(account);
  const lic = await getMessages(licenses);
  const vm = await getMessages(verein);
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/account");
  const isAdmin = viewer.kind === "admin";

  const linkedMember = await getCurrentMember().catch(() => null);
  const userRole = linkedMember && linkedMember.status === "AKTIV" ? m.area.roleMember(linkedMember.memberNumber) : m.area.roleUser;
  let memberSince: Date | null = null;
  let verified = true;
  let adminRole = "";
  let adminRoles: readonly string[] = [];
  if (isAdmin) {
    const current = await getCurrentAdmin();
    adminRole = current?.role ?? "";
    adminRoles = current?.roles ?? [];
  } else {
    const u = await db.user.findUnique({
      where: { id: viewer.id },
      select: { createdAt: true, emailVerifiedAt: true },
    });
    memberSince = u?.createdAt ?? null;
    verified = !!u?.emailVerifiedAt;
  }

  // Der Verwaltungsbereich ist nur für Admin-Sitzungen sichtbar.
  const admin: Tile[] =
    isAdmin
      ? [
          {
            href: "/admin",
            title: "Admin-Bereich",
            text: "Dashboard mit Kennzahlen, Diensten, Status und Vorfällen.",
            icon: ShieldCheck,
            highlight: true,
          },
          {
            href: "/admin/members",
            title: "Mitglieder",
            text: "Mitgliederverwaltung, Beiträge, Kasse und Versammlungen des Vereins.",
            icon: Building2,
          },
          {
            href: "/admin/tickets",
            title: "Tickets",
            text: "Anfragen lesen, beantworten und Status ändern.",
            icon: Inbox,
          },
          {
            href: "/admin/services",
            title: "Dienste & Status",
            text: "Dienste pflegen und den Betriebsstatus setzen.",
            icon: Server,
          },
          {
            href: "/admin/newsletter",
            title: "Newsletter",
            text: "Abonnenten verwalten und Ausgaben versenden.",
            icon: Mail,
          },
          {
            href: "/admin/users",
            title: "Benutzer & Team",
            text: "Konten verwalten und Nutzer ins Team aufnehmen.",
            icon: Users,
          },
          {
            href: "/admin/settings",
            title: "Einstellungen",
            text: "Impressum, Mailserver und Registrierung.",
            icon: Settings,
          },
        ]
      : [];
  // Kacheln nur für Bereiche, die die Rolle öffnen darf (sonst führt der Link auf «Keine Berechtigung»).
  const adminAllowed = admin.filter((t) => canAccess(adminRoles, moduleForPath(t.href), "read"));

  const team: Tile[] = viewer.isTeam
    ? [
        {
          href: "/account/team",
          title: m.overview.teamTile.title,
          text: m.overview.teamTile.text,
          icon: Users,
          highlight: !isAdmin,
        },
      ]
    : [];

  const vereinTile: Tile = {
    href: "/account/verein",
    title: vm.portal.tile.title,
    text: vm.portal.tile.text,
    icon: Building2,
  };

  const own: Tile[] = [
    vereinTile,
    ...(isAdmin
      ? [
          {
            href: "/admin/account",
            title: "Zugang & Passwort",
            text: "Passwort ändern und Zugangsdaten prüfen.",
            icon: LockKeyhole,
          },
        ]
      : [
          {
            href: "/account/settings",
            title: m.overview.settingsTile.title,
            text: m.overview.settingsTile.text,
            icon: LockKeyhole,
          },
        ]),
    ...(isAdmin
      ? []
      : [
          {
            href: "/account/licenses",
            title: lic.tile.title,
            text: lic.tile.text,
            icon: KeyRound,
          },
        ]),
    {
      href: "/contact",
      title: m.overview.supportTile.title,
      text: m.overview.supportTile.text,
      icon: LifeBuoy,
    },
    {
      href: "/status",
      title: m.overview.statusTile.title,
      text: m.overview.statusTile.text,
      icon: Activity,
    },
    {
      href: "/blog",
      title: m.overview.blogTile.title,
      text: m.overview.blogTile.text,
      icon: BookOpen,
    },
  ];

  const theme = await getMessages(themeMsgs);

  return (
    <Container className="py-10 sm:py-14">
      <Card className="mb-6 flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
        <div>
          <h2 className="text-sm font-semibold text-white">{theme.cardTitle}</h2>
          <p className="mt-1 text-sm text-zinc-400">{theme.cardText}</p>
          <p className="mt-1 text-xs text-zinc-500">{theme.hint}</p>
        </div>
        <ThemeSwitch />
      </Card>
      <Card className="mb-10 p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-white">{m.overview.profileTitle}</h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs text-zinc-500">{m.overview.name}</dt>
            <dd className="mt-1 font-medium text-zinc-100">{viewer.name}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-zinc-500">{m.overview.email}</dt>
            <dd className="mt-1 break-words font-medium text-zinc-100">{viewer.email}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">{m.overview.role}</dt>
            <dd className="mt-1 font-medium text-zinc-100">
              {isAdmin ? `${m.area.roleAdmin}${adminRole ? ` (${adminRole})` : ""}` : viewer.isTeam ? m.area.roleTeam : userRole}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">{isAdmin ? m.overview.status : m.overview.memberSince}</dt>
            <dd className="mt-1 font-medium text-zinc-100">
              {isAdmin ? m.overview.active : `${memberSince ? formatDate(memberSince, site.locale) : "–"}${verified ? "" : m.overview.unverified}`}
            </dd>
          </div>
        </dl>
      </Card>

      <Group title="Verwaltung" tiles={adminAllowed} open={m.overview.open} />
      <Group title={m.overview.groupTeam} tiles={team} open={m.overview.open} />
      <Group title={m.overview.groupOwn} tiles={own} open={m.overview.open} />
    </Container>
  );
}
