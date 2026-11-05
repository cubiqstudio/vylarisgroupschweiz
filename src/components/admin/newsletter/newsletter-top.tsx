/* eslint-disable @next/next/no-img-element -- statische Markendatei (SVG/PNG/WebP), keine Bildoptimierung nötig */
import Link from "next/link";
import { Hourglass, Send, UserCheck, UserMinus } from "lucide-react";
import { db } from "@/lib/db";
import { findBrandAsset } from "@/lib/brand";
import { getNewsletterAvailability } from "@/lib/newsletter";
import { cn } from "@/lib/utils";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BrandMark } from "@/components/contact/brand-mark";
import { StatCard } from "@/components/admin/core/stat-card";
import { NewsletterToggle } from "./newsletter-toggle";

/**
 * Gemeinsamer Kopf der Newsletter-Übersichten: dunkles Banner mit dem V-Zeichen (Variante für dunkle Flächen),
 * Schalter, Kennzahlen und Tabs „Kampagnen | Abonnenten“.
 */
export async function NewsletterTop({ active }: { active: "campaigns" | "subscribers" }) {
  const [availability, grouped, campaignCount] = await Promise.all([
    getNewsletterAvailability(),
    db.newsletterSubscriber.groupBy({ by: ["status"], _count: { _all: true } }),
    db.newsletterCampaign.count(),
  ]);
  const by: Record<string, number> = {};
  for (const g of grouped) by[g.status] = g._count._all;
  const watermark = findBrandAsset("logo-mark-on-dark");

  const tabs = [
    { key: "campaigns" as const, label: "Kampagnen", href: "/admin/newsletter", count: campaignCount },
    { key: "subscribers" as const, label: "Abonnenten", href: "/admin/newsletter/subscribers", count: (by.ACTIVE ?? 0) + (by.PENDING ?? 0) + (by.UNSUBSCRIBED ?? 0) },
  ];

  return (
    <>
      <section className="relative mb-6 overflow-hidden rounded-3xl bg-ink px-5 py-6 text-surface shadow-lg shadow-slate-900/10 sm:px-8 sm:py-8">
        <div aria-hidden className="pointer-events-none absolute -left-16 -top-24 size-72 rounded-full bg-brand/40 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 right-1/4 size-72 rounded-full bg-brand-2/30 blur-3xl" />
        {watermark && (
          <img
            src={watermark}
            alt=""
            aria-hidden
            draggable={false}
            className="pointer-events-none absolute -bottom-10 -right-6 hidden size-64 select-none object-contain opacity-[0.08] sm:block"
          />
        )}
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <BrandMark tone="onDark" className="size-14 rounded-2xl sm:size-16" />
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-widest text-surface/60">Dashboard</p>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Newsletter</h1>
              <p className="mt-1 max-w-md text-sm leading-relaxed text-surface/70">
                Abonnenten verwalten, Kampagnen schreiben und mit Vorschau an alle bestätigten Adressen senden.
              </p>
            </div>
          </div>
          <ButtonLink href="/admin/newsletter/campaigns/new" variant="secondary" size="lg" className="shrink-0 self-start sm:self-center">
            <Send className="size-4" aria-hidden />
            Neue Kampagne
          </ButtonLink>
        </div>
      </section>

      <Card className="mb-6 p-4 sm:p-5">
        <NewsletterToggle enabled={availability.enabled} mailConfigured={availability.mailConfigured} />
      </Card>

      <section aria-label="Kennzahlen" className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Abonnenten" value={(by.ACTIVE ?? 0).toLocaleString("de-DE")} detail="Aktiv und bestätigt" href="/admin/newsletter/subscribers?status=ACTIVE" icon={<UserCheck className="size-[18px]" />} />
        <StatCard label="Ausstehend" value={(by.PENDING ?? 0).toLocaleString("de-DE")} detail="Warten auf Bestätigung" href="/admin/newsletter/subscribers?status=PENDING" icon={<Hourglass className="size-[18px]" />} />
        <StatCard label="Abgemeldet" value={(by.UNSUBSCRIBED ?? 0).toLocaleString("de-DE")} detail="Erhalten nichts mehr" href="/admin/newsletter/subscribers?status=UNSUBSCRIBED" icon={<UserMinus className="size-[18px]" />} />
        <StatCard label="Kampagnen" value={campaignCount.toLocaleString("de-DE")} detail="Entwürfe und versendete" href="/admin/newsletter" icon={<Send className="size-[18px]" />} />
      </section>

      <nav aria-label="Newsletter-Bereiche" className="-mx-1 mb-5 overflow-x-auto px-1 pb-1">
        <ul className="flex min-w-max gap-2">
          {tabs.map((t) => {
            const isActive = t.key === active;
            return (
              <li key={t.key}>
                <Link
                  href={t.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-full pl-4 pr-2 text-sm font-medium ring-1 ring-inset transition-colors",
                    isActive ? "bg-ink text-surface ring-ink" : "bg-surface text-zinc-400 ring-zinc-800 hover:bg-zinc-900 hover:text-zinc-100",
                  )}
                >
                  {t.label}
                  <span className={cn("min-w-6 rounded-full px-1.5 py-0.5 text-center text-xs tabular-nums", isActive ? "bg-surface/20 text-surface" : "bg-zinc-900 text-zinc-400")}>
                    {t.count}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
