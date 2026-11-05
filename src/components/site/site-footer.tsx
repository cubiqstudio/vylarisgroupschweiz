import Link from "next/link";
import { Logo } from "@/components/site/logo";
import { CookieSettingsButton } from "@/components/consent/cookie-settings-button";
import { NewsletterBlock } from "@/components/newsletter/newsletter-block";
import { Container } from "@/components/ui/section";
import { ThemeSwitch } from "@/components/theme/theme-switch";
import { site as partnerSite } from "@/lib/site";
import { SITES } from "@/lib/sites";
import { getMessages, getSite } from "@/i18n/server";
import { shell } from "@/i18n/shell";

const link = "text-ondark-link transition-colors hover:text-[#ffffff]";

/** Dunkler Footer im Stil von vylaris.ch: Kurztext, „Entdecken“, „Konto & Recht“. Auf den Seiten ohne eigenen Betrieb (de, net) mit Hinweis auf den technischen Betrieb durch VylarisGroupEurope. */
export async function SiteFooter() {
  const site = await getSite();
  const m = (await getMessages(shell)).footer;
  const operator = SITES.eu;
  return (
    <footer className="mt-24 bg-ink text-[#d1d1d1]">
      <Container className="pt-10">
        <NewsletterBlock variant="footer" />
      </Container>
      <Container className="grid gap-10 py-14 md:grid-cols-3">
        <div>
          <Logo tone="onDark" />
          <p className="mt-4 max-w-sm text-sm leading-relaxed">{m.intro}</p>
          <p className="mt-4 text-sm">
            {m.handInHand}{" "}
            <a href={partnerSite.partner.url} target="_blank" rel="noopener noreferrer" className={link}>
              {m.partnerName} ({partnerSite.partner.domain})
            </a>
          </p>
          {site.key !== "eu" && (
            <p className="mt-3 text-xs text-[#9a9a9a]">
              {m.operationLabel}{" "}
              <a href={`https://${operator.domain}`} className="underline underline-offset-2 transition-colors hover:text-[#ffffff]">
                {operator.name} · {operator.domain}
              </a>
            </p>
          )}
        </div>
        <nav aria-label={m.exploreNav}>
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#ffffff]">{m.exploreTitle}</h2>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link className={link} href="/">{m.home}</Link></li>
            <li><Link className={link} href="/services">{m.services}</Link></li>
            <li><Link className={link} href="/status">{m.status}</Link></li>
            <li><Link className={link} href="/about">{m.aboutUs}</Link></li>
            <li><Link className={link} href="/blog">{m.blog}</Link></li>
          </ul>
        </nav>
        <nav aria-label={m.accountNav}>
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#ffffff]">{m.accountTitle}</h2>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link className={link} href="/contact">{m.contact}</Link></li>
            <li><Link className={link} href="/login">{m.signIn}</Link></li>
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
          <p>{m.copyright(new Date().getFullYear(), site.name)}</p>
          <p>{m.claims}</p>
          <ThemeSwitch tone="onDark" className="self-start sm:self-auto" />
        </Container>
      </div>
    </footer>
  );
}
