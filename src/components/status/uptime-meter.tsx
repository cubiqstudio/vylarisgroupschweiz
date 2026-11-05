import { cn, formatUptime } from "@/lib/utils";
import { getLocale, getMessages } from "@/i18n/server";
import { status as messages } from "@/i18n/status";
import { STATUS_STYLE, type ComponentStatus } from "@/lib/constants";

/** Schlichte Prozent-Anzeige mit dünnem Balken (Breite = Uptime). Keine Historie. */
export async function UptimeMeter({
  value,
  status,
  label,
}: {
  value: number;
  status: string;
  label: string;
}) {
  const locale = await getLocale();
  const m = (await getMessages(messages)).uptime;
  const pct = Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
  const tone =
    status in STATUS_STYLE
      ? STATUS_STYLE[status as ComponentStatus].dot
      : STATUS_STYLE.OPERATIONAL.dot;
  return (
    <div className="w-full min-w-[7rem]">
      <p className="text-right text-sm font-medium tabular-nums text-zinc-200">
        {formatUptime(pct, locale)}
      </p>
      <div
        role="meter"
        aria-label={m.availability(label)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-valuetext={formatUptime(pct, locale)}
        className="mt-1.5 h-1 overflow-hidden rounded-full bg-zinc-800"
      >
        <div
          className={cn("h-full rounded-full", tone)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
