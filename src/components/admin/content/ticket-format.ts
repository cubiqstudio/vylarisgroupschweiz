// Reine Darstellungs-Helfer für die Ticket-Oberflächen (ohne Server-/Client-Abhängigkeiten).

const rtf = new Intl.RelativeTimeFormat("de", { numeric: "auto" });

/** «vor 5 Minuten», «gestern» … Für sehr kurze Abstände «gerade eben». */
export function formatRelative(date: Date | string, now: Date = new Date()): string {
  const d = new Date(date);
  const diff = Math.round((d.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(diff);
  if (abs < 60) return "gerade eben";
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86_400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86_400 * 30) return rtf.format(Math.round(diff / 86_400), "day");
  if (abs < 86_400 * 365) return rtf.format(Math.round(diff / (86_400 * 30)), "month");
  return rtf.format(Math.round(diff / (86_400 * 365)), "year");
}

/** Ein bis zwei Initialen aus einem Namen. */
export function initials(name: string): string {
  const parts = name
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  const first = Array.from(parts[0])[0] ?? "?";
  const last = parts.length > 1 ? (Array.from(parts[parts.length - 1])[0] ?? "") : "";
  return (first + last).toLocaleUpperCase("de-CH");
}

/** Dezente Farbtöne für Initialen-Avatare (stabil je Name). */
const AVATAR_TONES = [
  "bg-emerald-400/15 text-emerald-300 ring-emerald-400/30",
  "bg-indigo-400/15 text-indigo-300 ring-indigo-400/30",
  "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  "bg-green-500/15 text-green-800 ring-green-600/30",
] as const;

export function avatarTone(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}

/** Einzeilige Vorschau einer Nachricht. */
export function previewText(message: string, max = 220): string {
  const flat = message.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}
