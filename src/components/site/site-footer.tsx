import Link from "next/link";
import { Logo } from "@/components/site/logo";
import { CookieSettingsButton } from "@/components/consent/cookie-settings-button";
import { NewsletterBlock } from "@/components/newsletter/newsletter-block";
import { Container } from "@/components/ui/section";
import { ThemeSwitch } from "@/components/theme/theme-switch";
import { site } from "@/lib/site";
import { getLegal } from "@/lib/legal";
import { hasPublicStatutes } from "@/lib/verein/documents-data";
import { getViewer } from "@/lib/auth";
import { getMessages } from "@/i18n/server";
import { shell } from "@/i18n/shell";

const link = "text-ondark-link transition-colors hover:text-[#ffffff]";

/** Anschrift aus den Admin-Einstellungen (nie im Code); fehlt sie oder ist die Datenbank nicht erreichbar, entfällt die Zeile. */
async function loadAddress(): Promise<string[]> {
  try {
    const l = await getLegal();
    return [l.street, l.zipCity].filter((x): x is string => Boolean(x));
  } catch {
    return [];
  }
}

/** Der Statuten-Link erscheint nur, wenn ein öffentliches Statuten-Dokument vorliegt. */
async function loadHasStatutes(): Promise<boolean> {
  try {
    return await hasPublicStatutes();
  } catch {
    return false;
  }
}

/** Ist jemand angemeldet? Dann zeigt die Fusszeile «Mein Konto» statt «Anmelden». */
async function loadSignedIn(): Promise<boolean> {
  try {
    return (await getViewer()) !== null;
  } catch {
    return false;
  }
}

/** Dunkler Footer: Kurztext, Anschrift, soziale Netzwerke, „Entdecken“ und „Konto & Recht“. */
export async function SiteFooter() {
  const m = (await getMessages(shell)).footer;
  const [address, hasStatutes, signedIn] = await Promise.all([loadAddress(), loadHasStatutes(), loadSignedIn()]);
  const social = [
    { href: site.social.x, label: m.socialX },
    { href: site.social.youtube, label: m.socialYoutube },
    { href: site.social.instagram, label: m.socialInstagram },
    { href: site.social.discord, label: m.socialDiscord },
  ];
  return (
    <footer className="mt-24 bg-ink text-[#d1d1d1]">
      <Container className="pt-10">
        <NewsletterBlock variant="footer" />
      </Container>
      <Container className="grid gap-10 py-14 md:grid-cols-3">
        <div>
          <Logo tone="onDark" />
          <p className="mt-4 max-w-sm text-sm leading-relaxed">{m.intro}</p>
          {address.length > 0 && (
            <address className="mt-4 text-sm not-italic leading-relaxed">
              <span className="sr-only">{m.addressLabel}: </span>
              {site.legalName}
              {address.map((line) => (
                <span key={line} className="block">{line}</span>
              ))}
            </address>
          )}
          <ul aria-label={m.socialNav} className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {social.map((s) => (
              <li key={s.href}>
                <a href={s.href} target="_blank" rel="noopener noreferrer" className={link}>{s.label}</a>
              </li>
            ))}
          </ul>
        </div>
        <nav aria-label={m.exploreNav}>
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#ffffff]">{m.exploreTitle}</h2>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link className={link} href="/">{m.home}</Link></li>
            <li><Link className={link} href="/services">{m.services}</Link></li>
            <li><Link className={link} href="/preise">{m.pricing}</Link></li>
            <li><Link className={link} href="/status">{m.status}</Link></li>
            <li><Link className={link} href="/about">{m.aboutUs}</Link></li>
            <li><Link className={link} href="/blog">{m.blog}</Link></li>
            <li><Link className={link} href="/allianz">{m.alliance}</Link></li>
            <li><Link className={link} href="/anlaesse">{m.events}</Link></li>
            <li><Link className={link} href="/mitglied-werden">{m.join}</Link></li>
            {hasStatutes && <li><Link className={link} href="/verein/statuten">{m.statutes}</Link></li>}
          </ul>
        </nav>
        <nav aria-label={m.accountNav}>
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#ffffff]">{m.accountTitle}</h2>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link className={link} href="/contact">{m.contact}</Link></li>
            <li>{signedIn ? <Link className={link} href="/account">{m.myAccount}</Link> : <Link className={link} href="/login">{m.signIn}</Link>}</li>
            <li><Link className={link} href={m.imprintHref}>{m.imprint}</Link></li>
            <li><Link className={link} href={m.privacyHref}>{m.privacy}</Link></li>
            <li>
              <CookieSettingsButton className={`${link} cursor-pointer`}>{m.cookieSettings}</CookieSettingsButton>
            </li>
          </ul>
        </nav>
      </Container>
      <div className="border-t border-[#2a2a2a]">
        <Container className="flex flex-col gap-2 py-5 text-xs text-[#9a9a9a] sm:flex-row sm:items-center sm:justify-between">
          <p>{m.copyright(new Date().getFullYear(), site.legalName)}</p>
          <p>{m.claims}</p>
          <ThemeSwitch tone="onDark" className="self-start sm:self-auto" />
        </Container>
      </div>
    </footer>
  );
}
