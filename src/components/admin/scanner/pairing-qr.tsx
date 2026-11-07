import type { QrShape } from "@/lib/verein/membership-card";

/** Ruhezone um den QR-Code in Modulen: die Norm (ISO/IEC 18004) verlangt mindestens 4, damit Kameras den Code sicher finden. */
export const QUIET_ZONE = 4;

/** Kopplungs-QR-Code als SVG auf weissem Grund (in beiden Farbmodi lesbar). Der Inhalt enthält das Token: nur direkt nach dem Anlegen anzeigen. */
export function PairingQr({ qr, label }: { qr: QrShape; label: string }) {
  const full = qr.modules + 2 * QUIET_ZONE;
  return (
    <div className="mx-auto w-fit rounded-xl bg-[#ffffff] p-3 ring-1 ring-zinc-700">
      <svg viewBox={`${-QUIET_ZONE} ${-QUIET_ZONE} ${full} ${full}`} role="img" aria-label={label} className="block h-60 w-60 max-w-full sm:h-72 sm:w-72" shapeRendering="crispEdges">
        <rect x={-QUIET_ZONE} y={-QUIET_ZONE} width={full} height={full} fill="#ffffff" />
        <path d={qr.pathD} fill="#000000" />
      </svg>
    </div>
  );
}
