import { ExternalLink, GitBranch } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { buttonClass } from "@/components/ui/button";
import { pick } from "@/i18n";
import { home } from "@/i18n/home";
import { labelFor } from "@/i18n/labels";
import type { Locale } from "@/lib/sites";

export type HomeService = {
  id: string;
  name: string;
  tagline: string;
  category: string;
  url: string;
  repoUrl: string | null;
  status: string;
  comingSoon: boolean;
};

export function HomeServiceCard({ service, locale }: { service: HomeService; locale: Locale }) {
  const m = pick(home, locale).services.card;
  return (
    <Card className="flex h-full flex-col p-6 transition-colors hover:border-zinc-700">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge>{labelFor("category", service.category, locale)}</Badge>
        {service.comingSoon ? (
          <Badge className="text-emerald-400">{labelFor("badge", "comingSoon", locale)}</Badge>
        ) : (
          <StatusBadge status={service.status} label={labelFor("status", service.status, locale)} />
        )}
      </div>
      <h3 className="mt-5 text-lg font-semibold tracking-tight text-white">{service.name}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-zinc-400">
        {service.tagline || m.fallbackTagline}
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {!service.comingSoon && service.url && (
          <a
            href={service.url}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClass("secondary", "sm")}
          >
            {m.open}
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            <span className="sr-only">{m.newTabOf(service.name)}</span>
          </a>
        )}
        {service.repoUrl && (
          <a
            href={service.repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClass("ghost", "sm")}
          >
            <GitBranch className="h-3.5 w-3.5" aria-hidden />
            {m.source}
            <span className="sr-only">{m.sourceNewTab(service.name)}</span>
          </a>
        )}
      </div>
    </Card>
  );
}
