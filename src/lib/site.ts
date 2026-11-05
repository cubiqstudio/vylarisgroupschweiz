// Stammdaten der Website. Rechtliche Angaben kommen aus der Umgebung, damit nichts erfunden wird.

const env = (k: string) => process.env[k]?.trim() || undefined;

export const site = {
  name: "VylarisGroupEurope",
  shortName: "Vylaris Europe",
  tagline: "Europäische Privatsphäre. Ohne Paywall.",
  description:
    "VylarisGroupEurope ist die offizielle europäische Unternehmenssparte der VylarisGroup – kostenlose, quelloffene SaaS-Dienste auf eigener, DSGVO-konformer Infrastruktur.",
  url: env("SITE_URL") ?? "http://localhost:3000",
  contactEmail: env("CONTACT_EMAIL"),
  leader: {
    name: "Lucas Wilms",
    role: "Leitung VylarisGroupEurope",
    company: "CircleUp-Wilms Webhosting & IT-Services",
  },
  partner: {
    name: "VylarisGroup Schweiz",
    domain: "vylaris.ch",
    url: "https://vylaris.ch",
    members: 5,
    board: 3,
  },
} as const;

export const nav = [
  { href: "/services", label: "Dienste" },
  { href: "/status", label: "Status" },
  { href: "/about", label: "Über uns" },
  { href: "/blog", label: "Blog" },
  { href: "/contact", label: "Kontakt" },
] as const;
