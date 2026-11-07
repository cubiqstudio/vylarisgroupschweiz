import type { QrShape } from "@/lib/verein/membership-card";

/** Kopplungs-QR-Code als SVG auf weissem Grund (in beiden Farbmodi lesbar). Der Inhalt enthält das Token: nur direkt nach dem Anlegen anzeigen. */
export function PairingQr({ qr, label }: { qr: QrShape; label: string }) {
  return (
    <div className="mx-auto w-fit rounded-xl bg-[#ffffff] p-3 ring-1 ring-zinc-700">
      <svg viewBox={`-1 -1 ${qr.modules + 2} ${qr.modules + 2}`} role="img" aria-label={label} className="block h-56 w-56 max-w-full sm:h-64 sm:w-64" shapeRendering="crispEdges">
        <rect x="-1" y="-1" width={qr.modules + 2} height={qr.modules + 2} fill="#ffffff" />
        <path d={qr.pathD} fill="#000000" />
      </svg>
    </div>
  );
}
