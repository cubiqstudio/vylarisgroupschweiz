import Link from "next/link";
import { Logo } from "@/components/site/logo";
import { MobileNav, type NavAction } from "@/components/site/mobile-nav";
import { NavLinks, type NavItem } from "@/components/site/nav-links";
import { ProfileMenu } from "@/components/site/profile-menu";
import { profileLinks, type ProfileInfo } from "@/lib/profile-links";
import { Container } from "@/components/ui/section";
import { buttonClass } from "@/components/ui/button";
import { getViewer, type Viewer } from "@/lib/auth";
import { isMailConfigured } from "@/lib/mailer";
import { getRegistrationEnabled } from "@/lib/settings";
import { getMessages } from "@/i18n/server";
import { shell } from "@/i18n/shell";

type NavLabels = (typeof shell)["de"]["nav"];

function navItems(n: NavLabels): NavItem[] {
  return [
    { href: "/", label: n.home },
    { href: "/services", label: n.services },
    { href: "/preise", label: n.pricing },
    { href: "/status", label: n.status },
    { href: "/contact", label: n.contact },
    { href: "/blog", label: n.blog },
    { href: "/anlaesse", label: n.events },
    { href: "/about", label: n.about },
    { href: "/allianz", label: n.alliance },
  ];
}

async function loadViewer(): Promise<Viewer | null> {
  try {
    return await getViewer();
  } catch {
    return null;
  }
}

async function loadRegistrationOpen(): Promise<boolean> {
  try {
    return (await getRegistrationEnabled()) && (await isMailConfigured());
  } catch {
    return false;
  }
}

/** Server Component: Navigation und je nach Sitzung Anmelden/Registrieren bzw. Konto. Impressum/Datenschutz stehen nur im Footer. */
export async function SiteHeader() {
  const m = await getMessages(shell);
  const NAV = navItems(m.nav);
  const viewer = await loadViewer();
  const registration = viewer ? false : await loadRegistrationOpen();

  // Öffentlich gibt es nur Anmelden/Registrieren bzw. „Konto“. Wer weitere Rechte hat, wird von /account weitergeleitet.
  const profile: ProfileInfo | null = viewer
    ? { id: viewer.id, name: viewer.name, email: viewer.email, kind: viewer.kind, isTeam: viewer.isTeam, hasAvatar: viewer.hasAvatar }
    : null;
  const actions: NavAction[] = profile
    ? profileLinks(profile).map((l, i) => ({ href: l.href, label: m.profile[l.icon], primary: i === 0 }))
    : [
        { href: "/login", label: m.header.signIn, primary: false },
        ...(registration ? [{ href: "/register", label: m.header.register, primary: false, desktop: false }] : []),
        { href: "/mitglied-werden", label: m.header.join, primary: true },
      ];

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800 bg-surface/90 backdrop-blur-xl">
      <Container className="flex h-20 items-center justify-between gap-4">
        <Logo />
        <NavLinks items={NAV} />
        <div className="flex items-center gap-2 sm:gap-3">
          {profile && <ProfileMenu profile={profile} />}
          <div className={profile ? "hidden" : "hidden items-center gap-2 sm:flex"}>
            {actions.filter((a) => a.desktop !== false).map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className={buttonClass(a.primary ? "primary" : "secondary", "sm", "h-9 px-4 text-[13px]")}
              >
                {a.label}
              </Link>
            ))}
          </div>
          <MobileNav items={NAV} actions={actions} signedIn={!!profile} />
        </div>
      </Container>
    </header>
  );
}
