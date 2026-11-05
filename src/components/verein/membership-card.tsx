/* eslint-disable @next/next/no-img-element -- kleines statisches Logo, keine Bildoptimierung nötig */
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QrShape } from "@/lib/verein/membership-card";

export type MembershipCardProps = {
  clubName: string;
  memberName: string;
  memberNumber: number;
  typeName: string;
  sinceText: string;
  validityText: string;
  valid: boolean;
  qr: QrShape;
  /** Logo (V-Zeichen) für dunklen Untergrund; fehlt die Datei, erscheint ein Schild-Symbol */
  logoSrc: string | null;
  labels: { card: string; memberNo: string; type: string; verifyHint: string; qrAlt: string };
  className?: string;
};

/**
 * Digitaler Mitgliederausweis in Kartengrösse (Seitenverhältnis 85.6 × 54 mm). Die Karte hat in beiden Farbmodi denselben dunklen Grund;
 * der QR-Code sitzt auf weissem Grund, damit er sich zuverlässig lesen lässt. Beim Drucken bleiben die Farben erhalten.
 */
export function MembershipCard({ clubName, memberName, memberNumber, typeName, sinceText, validityText, valid, qr, logoSrc, labels, className }: MembershipCardProps) {
  return (
    <div
      className={cn(
        "membership-card relative aspect-[85.6/54] w-full max-w-[28rem] overflow-hidden rounded-2xl bg-[#0f1f4d] p-5 text-[#ffffff] shadow-lg shadow-slate-900/20 [print-color-adjust:exact] [-webkit-print-color-adjust:exact] sm:p-6",
        className,
      )}
      role="group"
      aria-label={`${labels.card}: ${memberName}, ${labels.memberNo} ${memberNumber}`}
    >
      <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-[#4256e0]/40 blur-2xl" />
      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {logoSrc ? <img src={logoSrc} alt="" aria-hidden="true" className="h-8 w-8 shrink-0 object-contain" /> : <ShieldCheck className="h-7 w-7 shrink-0 text-[#7dbaee]" aria-hidden />}
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-semibold">{clubName}</p>
              <p className="text-[11px] uppercase tracking-[0.14em] text-[#b8c7ee]">{labels.card}</p>
            </div>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset",
              valid ? "bg-[#16a34a]/25 text-[#bbf7d0] ring-[#4ade80]/50" : "bg-[#e11d48]/25 text-[#fecdd3] ring-[#fb7185]/50",
            )}
          >
            {valid ? "Gültig" : "Nicht gültig"}
          </span>
        </div>

        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="break-words text-lg font-semibold leading-tight sm:text-xl">{memberName}</p>
            <dl className="mt-2 space-y-0.5 text-[11px] text-[#d6def5] sm:text-xs">
              <div className="flex gap-1.5">
                <dt className="text-[#9fb0e0]">{labels.memberNo}</dt>
                <dd className="font-semibold tabular-nums">{memberNumber}</dd>
              </div>
              {typeName && (
                <div className="flex gap-1.5">
                  <dt className="text-[#9fb0e0]">{labels.type}</dt>
                  <dd>{typeName}</dd>
                </div>
              )}
              {sinceText && <div>{sinceText}</div>}
              <div>{validityText}</div>
            </dl>
          </div>
          <div className="shrink-0 text-center">
            <div className="rounded-lg bg-[#ffffff] p-1.5">
              <svg viewBox={`-1 -1 ${qr.modules + 2} ${qr.modules + 2}`} role="img" aria-label={labels.qrAlt} className="block h-20 w-20 sm:h-24 sm:w-24" shapeRendering="crispEdges">
                <rect x="-1" y="-1" width={qr.modules + 2} height={qr.modules + 2} fill="#ffffff" />
                <path d={qr.pathD} fill="#000000" />
              </svg>
            </div>
            <p className="mt-1 text-[9px] uppercase tracking-wide text-[#9fb0e0]">{labels.verifyHint}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
