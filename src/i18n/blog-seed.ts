// Erster Blogbeitrag für den Seed (prisma/seed.ts). Bewusst ohne Importe, damit der Seed die Datei direkt einlesen kann.
// Der Beitrag fasst nur zusammen, was der Verein selbst über seine Gründung veröffentlicht hat.

export const FOUNDING_POST = {
  title: "In kleinen Schritten zum Ziel – Vereinsgründung",
  slug: "vereinsgruendung",
  excerpt:
    "Eine Vereinsgründung ist grundsätzlich kostenlos, verlangt aber Geduld und Sorgfalt: ein Rückblick auf Gründungsversammlung und Statuten der VylarisGroup.",
  author: "VylarisGroup",
  /** 5.9.2026, 8:00 Uhr (Sommerzeit in der Schweiz = 06:00 UTC) */
  publishedAt: "2026-09-05T06:00:00.000Z",
  content: `Die VylarisGroup hat klein angefangen: mit einem Homelab und einem Podcast. Inzwischen sind wir bei einem offiziellen Verein und einer eigenen Webseite angekommen. Dieser Beitrag blickt auf einen wichtigen Schritt auf diesem Weg zurück, die Vereinsgründung.

## Kostenlos, aber nicht ohne Aufwand

Einen Verein zu gründen ist grundsätzlich kostenlos. Das heisst allerdings nicht, dass es von selbst geht: Die Gründung hat uns einiges an Nerven und Verstand gekostet.

## Die Gründungsversammlung

Schwierig war vor allem die Gründungsversammlung. Wir haben alle andere Verpflichtungen und unterschiedliche Arbeitszeiten, deshalb brauchte es etwas Geduld, bis ein gemeinsamer Termin für alle möglich war.

## Die Statuten

Die Statuten müssen genau zum Verein passen. Eine Vorlage einfach anzupassen ist riskant, weil schnell etwas übernommen wird, das zu den eigenen Zielen gar nicht passt. Wir haben die Statuten deshalb sorgfältig auf uns zugeschnitten und vollständig fertiggestellt. Da ist viel Herzblut hineingeflossen.

## Wo wir heute stehen

Die VylarisGroup ist ein Verein und nicht gewinnorientiert. Stand September 2026 besteht er aus insgesamt fünf Mitgliedern, wovon drei im Vorstand tätig sind. Unsere Angebote bleiben für jedermann kostenlos, und wir setzen weiterhin strikt auf Open Source oder eigene Lösungen.

## Was wir daraus mitnehmen

Wer sich etwas vornimmt, kann es schaffen, auch in kleinen Schritten. Genau so haben wir die VylarisGroup möglich gemacht. Wenn du Fragen zum Verein hast oder mitmachen möchtest, schreib uns über das Kontaktformular.
`,
} as const;
