/* eslint-disable @next/next/no-img-element -- kleines statisches Logo, keine Bildoptimierung nötig */
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { QR_QUIET_MODULES, qrViewBox, type QrShape } from "@/lib/verein/membership-card";

export type MembershipCardProps = {
  clubName: string;
  memberName: string;
  memberNumber: number;
  /** «Mitglied seit 5.11.2026»; leer, wenn kein Eintrittsdatum erfasst ist */
  sinceText: string;
  qr: QrShape;
  /** Logo (V-Zeichen) für dunklen Untergrund; fehlt die Datei, erscheint ein Schild-Symbol */
  logoSrc: string | null;
  labels: { card: string; memberNo: string; front: string; back: string; qrAlt: string };
  className?: string;
};

// Alle Masse der Karte sind Anteile der Kartenbreite (cqw: 1 cqw = 1 % der Breite, bei 85.6 mm also 0.856 mm), damit Bildschirm und
// Druck dieselbe Karte zeigen. Sicherheitszone: 5.5 cqw = 4.7 mm Rand (verlangt sind mindestens 4 mm).
const FACE =
  "membership-card relative block aspect-[85.6/54] w-full overflow-hidden rounded-[14px] text-[#ffffff] shadow-lg shadow-slate-900/25 [container-type:inline-size] [print-color-adjust:exact] [-webkit-print-color-adjust:exact]";
const FACE_BG = {
  backgroundColor: "#0f1f4d",
  backgroundImage: "radial-gradient(circle at 100% 0%, rgba(66, 86, 224, 0.5) 0%, rgba(66, 86, 224, 0) 55%), linear-gradient(135deg, #0f1f4d 0%, #14286b 100%)",
} as const;
const INNER = "absolute inset-0 flex p-[5.5cqw]";

/** Schriftgrösse des Namens: lange Namen werden kleiner, damit sie auf der Rückseite innerhalb der Sicherheitszone bleiben. */
const nameSize = (name: string): string => (name.length > 44 ? "text-[4.6cqw]" : name.length > 28 ? "text-[5.4cqw]" : "text-[6.6cqw]");

/**
 * Digitaler Mitgliederausweis mit Vorder- und Rückseite im Kartenformat (85.6 × 54 mm). Auf dem Bildschirm stehen beide Seiten
 * nebeneinander (schmal: untereinander) mit Beschriftung ausserhalb der Karte. Beim Drucken (Regeln: print-styles-card.tsx) entsteht
 * je Seite randlos eine Druckseite. Die Karte zeigt nie «gültig»: Der Gültigkeitshinweis gehört auf die Seite, nicht auf die Karte.
 * Der QR-Code sitzt auf einer weissen Kachel (24 mm) mit 4 Modulen Ruhezone, der Code selbst ist über 18 mm gross.
 */
export function MembershipCard({ clubName, memberName, memberNumber, sinceText, qr, logoSrc, labels, className }: MembershipCardProps) {
  return (
    <div
      className={cn("ausweis-print-root grid w-full grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-[repeat(2,minmax(0,28rem))]", className)}
      role="group"
      aria-label={`${labels.card}: ${memberName}, ${labels.memberNo} ${memberNumber}`}
    >
      <figure className="ausweis-face m-0 w-full max-w-[28rem]">
        <div className={cn(FACE, "membership-card-front")} style={FACE_BG}>
          <div className={cn(INNER, "flex-col justify-between")}>
            <div className="flex items-center gap-[2.5cqw]">
              {logoSrc ? (
                <img src={logoSrc} alt="" aria-hidden="true" className="h-[12cqw] w-[12cqw] shrink-0 object-contain" />
              ) : (
                <ShieldCheck className="h-[10cqw] w-[10cqw] shrink-0 text-[#7dbaee]" aria-hidden />
              )}
              <p className="min-w-0 text-[4.6cqw] font-semibold leading-tight">{clubName}</p>
            </div>
            <p className="mb-[1.2cqw] text-[8.4cqw] font-semibold leading-none tracking-tight">{labels.card}</p>
          </div>
        </div>
        <figcaption className="ausweis-hide-print mt-2 text-center text-xs font-medium text-zinc-500">{labels.front}</figcaption>
      </figure>

      <figure className="ausweis-face m-0 w-full max-w-[28rem]">
        <div className={cn(FACE, "membership-card-back")} style={FACE_BG}>
          <div className={cn(INNER, "items-center justify-between gap-[4cqw]")}>
            <div className="min-w-0 flex-1">
              <p className={cn("text-balance break-words font-semibold leading-[1.12] [hyphens:auto]", nameSize(memberName))} lang="de">
                {memberName}
              </p>
              <p className="mt-[3.5cqw] text-[4.4cqw] leading-snug text-[#d6def5]">
                {labels.memberNo} <span className="font-semibold tabular-nums text-[#ffffff]">{memberNumber}</span>
              </p>
              {sinceText && <p className="mt-[0.8cqw] text-[4.4cqw] leading-snug text-[#d6def5]">{sinceText}</p>}
            </div>
            <svg
              viewBox={qrViewBox(qr.modules)}
              role="img"
              aria-label={labels.qrAlt}
              className="ausweis-qr block h-[28cqw] w-[28cqw] shrink-0 rounded-[1.4cqw]"
              shapeRendering="crispEdges"
            >
              <rect x={-QR_QUIET_MODULES} y={-QR_QUIET_MODULES} width={qr.modules + 2 * QR_QUIET_MODULES} height={qr.modules + 2 * QR_QUIET_MODULES} fill="#ffffff" />
              <path d={qr.pathD} fill="#000000" />
            </svg>
          </div>
        </div>
        <figcaption className="ausweis-hide-print mt-2 text-center text-xs font-medium text-zinc-500">{labels.back}</figcaption>
      </figure>
    </div>
  );
}
