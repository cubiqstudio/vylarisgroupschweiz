import Link from "next/link";
import { Wrench, AlertTriangle, Activity } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, formatDateTime } from "@/lib/utils";
import type { Locale } from "@/i18n";
import { labelFor } from "@/i18n/labels";
import { getLocale, getMessages } from "@/i18n/server";
import { status as messages } from "@/i18n/status";

export type IncidentData = {
  id: string;
  title: string;
  body: string;
  severity: string;
  status: string;
  startedAt: Date;
  resolvedAt: Date | null;
  service: { name: string; slug: string } | null;
};

const SEVERITY_STYLE: Record<string, string> = {
  MINOR: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
  MAJOR: "bg-rose-500/10 text-rose-300 ring-rose-500/30",
  MAINTENANCE: "bg-indigo-500/10 text-indigo-300 ring-indigo-500/30",
};

export function formatDuration(from: Date, to: Date, locale: Locale): string {
  const m = messages[locale].incident;
  const mins = Math.max(
    0,
    Math.round((to.getTime() - from.getTime()) / 60_000),
  );
  if (mins < 1) return m.lessThanMinute;
  if (mins < 60) return m.min(mins);
  const h = Math.floor(mins / 60);
  if (h < 24) return m.hoursMin(h, mins % 60);
  return m.days(Math.floor(h / 24), h % 24);
}

function ServiceLink({ service }: { service: { name: string; slug: string } }) {
  return (
    <Link
      href={`/services#${service.slug}`}
      className="text-emerald-400 underline-offset-4 hover:underline"
    >
      {service.name}
    </Link>
  );
}

/** Aktive Meldung (Störung oder Wartung) mit vollem Text. */
export async function ActiveIncident({ incident }: { incident: IncidentData }) {
  const locale = await getLocale();
  const m = (await getMessages(messages)).incident;
  const Icon =
    incident.severity === "MAINTENANCE"
      ? Wrench
      : incident.severity === "MAJOR"
        ? AlertTriangle
        : Activity;
  const scheduled = incident.status === "SCHEDULED";
  return (
    <Card className="p-5 sm:p-6">
      <article>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
              SEVERITY_STYLE[incident.severity] ?? SEVERITY_STYLE.MINOR,
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {labelFor("severity", incident.severity, locale)}
          </span>
          <Badge>{labelFor("incidentStatus", incident.status, locale)}</Badge>
        </div>
        <h3 className="mt-3 text-lg font-semibold tracking-tight text-white">
          {incident.title}
        </h3>
        <p className="mt-2 whitespace-pre-line break-words text-sm leading-relaxed text-zinc-400">
          {incident.body}
        </p>
        <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
          <span>
            {scheduled ? m.scheduledFrom : m.since}:{" "}
            <time
              dateTime={incident.startedAt.toISOString()}
              className="text-zinc-300"
            >
              {formatDateTime(incident.startedAt, locale)}
            </time>
          </span>
          {incident.service && (
            <span>
              {m.affects}{" "}
              <ServiceLink service={incident.service} />
            </span>
          )}
        </p>
      </article>
    </Card>
  );
}

/** Kompakter Eintrag für behobene Vorfälle. */
export async function PastIncident({ incident }: { incident: IncidentData }) {
  const locale = await getLocale();
  const m = (await getMessages(messages)).incident;
  return (
    <li className="px-5 py-4 sm:px-6">
      <article>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-white">
            {incident.title}
          </h3>
          <Badge>{labelFor("severity", incident.severity, locale)}</Badge>
        </div>
        <p className="mt-1.5 whitespace-pre-line break-words text-sm leading-relaxed text-zinc-400">
          {incident.body}
        </p>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
          <span>
            <time dateTime={incident.startedAt.toISOString()}>
              {formatDateTime(incident.startedAt, locale)}
            </time>
          </span>
          {incident.resolvedAt && (
            <span>
              {m.duration}{" "}
              <span className="text-zinc-300">
                {formatDuration(
                  incident.startedAt,
                  incident.resolvedAt,
                  locale,
                )}
              </span>
            </span>
          )}
          {incident.service && (
            <span>
              {m.affected}{" "}
              <ServiceLink service={incident.service} />
            </span>
          )}
        </p>
      </article>
    </li>
  );
}
