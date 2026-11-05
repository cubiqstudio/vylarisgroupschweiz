import { cn } from "@/lib/utils";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]![0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]![0] ?? "") : "";
  return (first + last).toUpperCase();
}

/** Rundes Profilbild; ohne Bild erscheinen die Initialen. */
export function Avatar({
  name,
  userId,
  hasImage,
  size = 40,
  className,
  version,
}: {
  name: string;
  userId?: string;
  hasImage?: boolean;
  size?: number;
  className?: string;
  version?: number;
}) {
  const style = { width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.38)) };
  if (hasImage && userId) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- dynamisch ausgeliefertes, kleines Profilbild
      <img
        src={`/api/avatar/${encodeURIComponent(userId)}${version ? `?v=${version}` : ""}`}
        alt=""
        width={size}
        height={size}
        style={style}
        className={cn("shrink-0 rounded-full object-cover ring-1 ring-zinc-800", className)}
      />
    );
  }
  return (
    <span
      aria-hidden
      style={style}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-emerald-400/15 font-semibold text-emerald-400 ring-1 ring-emerald-400/30", className)}
    >
      {initials(name)}
    </span>
  );
}
