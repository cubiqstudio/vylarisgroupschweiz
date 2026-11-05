import { ArrowUpRight, Code2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { labelFor } from "@/i18n/labels";
import { services } from "@/i18n/services";
import { getLocale, getMessages } from "@/i18n/server";
import { localized } from "@/i18n";
import { formatUptime } from "@/lib/utils";

export type ServiceCardData = {
  id: string;
  name: string;
  nameEn: string | null;
  slug: string;
  tagline: string;
  taglineEn: string | null;
  description: string;
  descriptionEn: string | null;
  category: string;
  url: string;
  repoUrl: string | null;
  status: string;
  uptime: number;
  comingSoon: boolean;
};

export async function ServiceCard({ service }: { service: ServiceCardData }) {
  const locale = await getLocale();
  const m = (await getMessages(services)).card;
  const name = localized(service, "name", locale);
  const tagline = localized(service, "tagline", locale);
  const description = localized(service, "description", locale);
  const headingId = `service-${service.slug}-title`;
  return (
    <Card
      id={service.slug}
      className="flex w-full scroll-mt-24 flex-col p-6 transition-colors hover:border-zinc-700"
    >
      <article aria-labelledby={headingId} className="flex h-full flex-col">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge>{labelFor("category", service.category, locale)}</Badge>
          {service.comingSoon ? (
            <Badge className="text-emerald-400">{labelFor("badge", "comingSoon", locale)}</Badge>
          ) : (
            <StatusBadge
              status={service.status}
              label={labelFor("status", service.status, locale)}
            />
          )}
        </div>

        <h3
          id={headingId}
          className="mt-5 break-words text-xl font-semibold tracking-tight text-white"
        >
          {name}
        </h3>
        {tagline && (
          <p className="mt-1 text-sm font-medium text-emerald-400">{tagline}</p>
        )}
        <p className="mt-3 flex-1 break-words text-sm leading-relaxed text-zinc-400">
          {description}
        </p>

        {!service.comingSoon && (
          <p className="mt-5 text-xs text-zinc-500">
            {m.availability}{" "}
            <span className="font-medium tabular-nums text-zinc-300">
              {formatUptime(service.uptime, locale)}
            </span>
          </p>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          {!service.comingSoon && service.url && (
            <ButtonLink href={service.url} external size="md">
              {m.open}
              <ArrowUpRight className="h-4 w-4" aria-hidden />
              <span className="sr-only">{m.newTab}</span>
            </ButtonLink>
          )}
          {service.repoUrl && (
            <ButtonLink
              href={service.repoUrl}
              external
              variant="secondary"
              size="md"
            >
              <Code2 className="h-4 w-4" aria-hidden />
              {m.source}
              <span className="sr-only">{m.sourceOf(name)}</span>
            </ButtonLink>
          )}
        </div>
      </article>
    </Card>
  );
}
