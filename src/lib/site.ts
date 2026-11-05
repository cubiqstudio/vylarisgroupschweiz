// Stammdaten der Website. Anschrift, Telefon und weitere Rechtsangaben stehen nicht hier, sondern in den Admin-Einstellungen
// (Seed) bzw. der Umgebung, damit nichts doppelt gepflegt oder erfunden wird.
import { SITE } from "@/lib/sites";

const env = (k: string) => process.env[k]?.trim() || undefined;

export const site = {
  name: SITE.name,
  shortName: SITE.shortName,
  legalName: SITE.legalName,
  domain: SITE.domain,
  tagline: "Sicherheit muss nichts kosten.",
  description:
    "Die VylarisGroup ist ein nicht gewinnorientierter Verein aus der Schweiz: kostenlose Web-Tools und SaaS-Dienste, strikt auf Open Source oder eigene Lösungen gebaut, mit Privatsphäre als Grundsatz.",
  // Feste Basis-URL: SITE_URL aus der Umgebung, sonst die Vereinsdomain (in der Entwicklung localhost). Nie aus dem Host-Header der Anfrage.
  url: env("SITE_URL") ?? (process.env.NODE_ENV === "production" ? `https://${SITE.domain}` : "http://localhost:3000"),
  contactEmail: env("CONTACT_EMAIL"),
  leader: SITE.leader,
  board: SITE.board,
  /** Mitglieder des Vereins (Stand September 2026); die Vorstandsmitglieder stehen in board */
  members: 5,
  social: {
    x: "https://x.com/vylaris_schweiz",
    youtube: "https://youtube.com/@vylaris_schweiz",
    instagram: "https://instagram.com/vylaris_schweiz",
    discord: "https://discord.gg/2AMZtStBQa",
  },
} as const;

export const nav = [
  { href: "/services", label: "Dienste" },
  { href: "/preise", label: "Preise" },
  { href: "/status", label: "Status" },
  { href: "/about", label: "Über uns" },
  { href: "/blog", label: "Blog" },
  { href: "/contact", label: "Kontakt" },
  { href: "/allianz", label: "Allianz" },
] as const;
