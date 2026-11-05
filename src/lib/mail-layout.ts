// Gemeinsames Marken-Layout für alle E-Mails (Tickets, Newsletter, Konto-Mails) + ein kleiner, sicherer
// Markdown-Konverter für Newsletter-Kampagnen.
//
// Anforderungen an das HTML: tabellenbasiert (Outlook/Gmail), 600 px, alles per Inline-CSS, keine externen
// Ressourcen außer dem V-Logo (absolute URL). Zusätzlich gibt es ein <style>-Fenster für mobile Ansicht und den
// Dunkelmodus (prefers-color-scheme sowie Outlook.com-Selektoren); dort wird auch das Logo getauscht
// (V-Zeichen für helle bzw. dunkle Flächen). Clients ohne Style-Unterstützung zeigen die helle Variante.
// Hinweis: Diese Datei ist bewusst frei von "server-only", damit sie sich auch in Skripten rendern lässt.
import { pick } from "@/i18n";
import { mail } from "@/i18n/mail";
import type { MailCtx } from "@/lib/mail-ctx";
import { site } from "@/lib/site";

// ---------------------------------------------------------------------------------------------
// Grundlagen
// ---------------------------------------------------------------------------------------------
const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ESCAPES[c]!);

/** Einzeiler für Betreff/Anrede/Namen: Zeilenumbrüche und Steuerzeichen entfernen (Header-Injection-Schutz). */
export const oneLine = (s: string) => s.replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, " ").replace(/ {2,}/g, " ").trim();

/** Kürzt Text auf `max` Zeichen (mit Auslassungspunkten), ohne ein Surrogatpaar zu zerreißen. */
export function truncate(s: string, max: number): string {
  const chars = Array.from(s);
  if (chars.length <= max) return s;
  return chars.slice(0, max).join("").replace(/\s+$/, "") + "…";
}

/** Nutzertext vor dem Kürzen normalisieren: einheitliche Zeilenenden, höchstens eine Leerzeile in Folge. */
export function normalizeText(s: string): string {
  return s.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

/** Nur http(s)-Adressen sind als Link erlaubt. Liefert die normalisierte Adresse oder null. */
export function safeHref(raw: string): string | null {
  const value = raw.trim();
  if (!value || /[\u0000-\u001f\u007f\s]/.test(value)) return null;
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Absolute URL des Logos (nur das „V“-Zeichen) auf der Domain des Empfängers. `dark` = Variante für dunkle Flächen. */
export function brandLogoUrl(variant: "light" | "dark" = "light", baseUrl: string = site.url): string {
  return `${baseUrl.replace(/\/+$/, "")}/images/logo-mark-on-${variant}.png`;
}

// ---------------------------------------------------------------------------------------------
// Farben & Schriften (Hex ist in HTML-Mails notwendig)
// ---------------------------------------------------------------------------------------------
const FONT = "'Poppins','Helvetica Neue',Helvetica,Arial,sans-serif";
const MONO = "'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace";
const C = {
  page: "#f5f9fe",
  card: "#ffffff",
  border: "#d3d9e4",
  info: "#eef2fa",
  head: "#010109",
  body: "#444444",
  muted: "#6C6C77",
  link: "#1e73be",
  ink: "#101010",
};

// Dunkelmodus: [Selektor, Eigenschaft, Wert]
const DARK: Array<[string, "color" | "background-color" | "border-color" | "border-top-color", string]> = [
  [".bg-page", "background-color", "#0d1420"],
  [".bg-card", "background-color", "#161f30"],
  [".bd-card", "border-color", "#2a3650"],
  [".bg-info", "background-color", "#1d2940"],
  [".bd-info", "border-color", "#34445f"],
  [".t-head", "color", "#f3f6fb"],
  [".t-body", "color", "#c8d0dd"],
  [".t-muted", "color", "#98a2b5"],
  [".t-link", "color", "#6db3f2"],
  [".btn-td", "background-color", "#ffffff"],
  [".btn-a", "color", "#101010"],
  [".hr-line", "border-top-color", "#2a3650"],
];

function styleBlock(): string {
  const media = DARK.map(([sel, prop, val]) => `${sel}{${prop}:${val}!important}`).join("");
  const ogsc = DARK.filter(([, p]) => p !== "background-color").map(([sel, prop, val]) => `[data-ogsc] ${sel}{${prop}:${val}!important}`).join("");
  const ogsb = DARK.filter(([, p]) => p === "background-color").map(([sel, prop, val]) => `[data-ogsb] ${sel}{${prop}:${val}!important}`).join("");
  return [
    ":root{color-scheme:light dark;supported-color-schemes:light dark}",
    "body{margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}",
    "table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}",
    "img{-ms-interpolation-mode:bicubic;border:0;outline:none;text-decoration:none}",
    "a{word-break:break-word}",
    "@media only screen and (max-width:620px){.outer{padding:12px 8px 24px!important}.container{width:100%!important}.px{padding-left:22px!important;padding-right:22px!important}.h1{font-size:22px!important;line-height:1.25!important}.hide-m{display:none!important}}",
    `@media (prefers-color-scheme:dark){${media}.logo-light{display:none!important;max-height:0!important;overflow:hidden!important}.logo-dark{display:block!important;max-height:none!important;overflow:visible!important;width:48px!important;height:auto!important}}`,
    ogsc,
    ogsb,
  ].join("\n");
}

// ---------------------------------------------------------------------------------------------
// Bausteine für Inhalte (alle Eingaben werden escaped)
// ---------------------------------------------------------------------------------------------
/** Absatz mit bereits sicherem (escaptem) HTML-Inhalt. */
export const mailParagraph = (innerHtml: string, opts: { muted?: boolean; small?: boolean } = {}) =>
  `<p class="${opts.muted ? "t-muted" : "t-body"}" style="margin:0 0 16px;font-family:${FONT};font-size:${opts.small ? 14 : 16}px;line-height:1.6;color:${opts.muted ? C.muted : C.body};">${innerHtml}</p>`;

/** Klartext → HTML: Leerzeilen trennen Absätze, einfache Zeilenumbrüche werden zu <br>. Alles wird escaped. */
export function paragraphsToHtml(text: string, opts: { muted?: boolean; small?: boolean } = {}): string {
  return normalizeText(text)
    .split(/\n{2,}/)
    .filter((p) => p.trim() !== "")
    .map((p) => mailParagraph(escapeHtml(p).replace(/\n/g, "<br>"), opts))
    .join("\n");
}

/** Hervorgehobene Zitat-Karte (z. B. Antwort des Teams oder ursprüngliche Nachricht). */
export function mailQuote(opts: { label?: string; text: string; emphasis?: boolean; muted?: boolean }): string {
  const size = opts.emphasis ? 16 : 15;
  const paragraphs = normalizeText(opts.text)
    .split(/\n{2,}/)
    .filter((p) => p.trim() !== "")
    .map(
      (p, i, all) =>
        `<p class="${opts.emphasis ? "t-head" : opts.muted ? "t-muted" : "t-body"}" style="margin:0 0 ${i === all.length - 1 ? 0 : 12}px;font-family:${FONT};font-size:${opts.muted ? 14 : size}px;line-height:1.6;color:${opts.emphasis ? C.head : opts.muted ? C.muted : C.body};">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`,
    )
    .join("");
  const label = opts.label
    ? `<p class="t-muted" style="margin:0 0 8px;font-family:${FONT};font-size:12px;line-height:1.4;letter-spacing:1px;text-transform:uppercase;font-weight:600;color:${C.muted};">${escapeHtml(opts.label)}</p>`
    : "";
  if (opts.muted) {
    return (
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="bd-card" style="margin:0 0 24px;border-left:4px solid ${C.border};">` +
      `<tr><td style="padding:2px 0 2px 16px;word-break:break-word;">${label}${paragraphs}</td></tr></table>`
    );
  }
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="bg-info bd-info" bgcolor="${C.info}" style="margin:0 0 24px;background:${C.info};border:1px solid ${C.border};border-left:4px solid ${C.link};border-radius:8px;">` +
    `<tr><td style="padding:16px 20px;word-break:break-word;">${label}${paragraphs}</td></tr></table>`
  );
}

/** Zeilen „Label: Wert“ als kleine Tabelle. */
export function mailDetails(rows: Array<[label: string, value: string]>): string {
  const tr = rows
    .filter(([, v]) => v.trim() !== "")
    .map(
      ([l, v]) =>
        `<tr><td class="t-muted" valign="top" style="padding:0 16px 8px 0;font-family:${FONT};font-size:14px;line-height:1.5;color:${C.muted};white-space:nowrap;">${escapeHtml(l)}</td>` +
        `<td class="t-head" valign="top" style="padding:0 0 8px;font-family:${FONT};font-size:14px;line-height:1.5;color:${C.head};word-break:break-word;">${escapeHtml(v)}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">${tr}</table>`;
}

/** Nummerierte Schritte („Was passiert jetzt?“). */
export function mailSteps(title: string, steps: string[]): string {
  const rows = steps
    .map(
      (s, i) =>
        `<tr><td valign="top" width="36" style="padding:0 0 12px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td class="btn-td" align="center" valign="middle" width="24" height="24" bgcolor="${C.ink}" style="width:24px;height:24px;border-radius:12px;background:${C.ink};font-family:${FONT};font-size:13px;font-weight:700;line-height:24px;color:#ffffff;"><span class="btn-a" style="color:#ffffff;">${i + 1}</span></td></tr></table></td>` +
        `<td class="t-body" valign="top" style="padding:0 0 12px;font-family:${FONT};font-size:15px;line-height:1.55;color:${C.body};">${escapeHtml(s)}</td></tr>`,
    )
    .join("");
  return (
    `<p class="t-head" style="margin:8px 0 12px;font-family:${FONT};font-size:17px;line-height:1.3;font-weight:600;color:${C.head};">${escapeHtml(title)}</p>` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px;">${rows}</table>`
  );
}

/** Fußzeile in Klartext (für die text/plain-Fassung). */
export function textFooter(opts: { brand: string; note?: string; unsubscribeUrl?: string }, ctx: MailCtx): string {
  const m = pick(mail, ctx.locale).layout;
  return [
    "--",
    `${oneLine(opts.brand)} · ${m.handInHand(m.partnerName)}`,
    ...(opts.note ? [opts.note] : []),
    ...(opts.unsubscribeUrl ? [m.unsubscribeText(opts.unsubscribeUrl)] : []),
  ].join("\n");
}

// ---------------------------------------------------------------------------------------------
// Das Layout
// ---------------------------------------------------------------------------------------------
export type MailLayoutOptions = {
  /** Versteckter Vorschautext */
  preheader?: string;
  heading: string;
  /** Bereits sicheres HTML (z. B. aus paragraphsToHtml) */
  introHtml?: string;
  bodyHtml: string;
  /** Hervorgehobene Karte, z. B. Ticket-ID */
  infoCard?: { label: string; value: string; hint?: string };
  /** Karte unter dem Inhalt statt darüber */
  infoCardAfterBody?: boolean;
  cta?: { label: string; url: string };
  secondaryNoteHtml?: string;
  /** Klartext-Hinweis in der Fußzeile (warum bekommst du diese Mail?) */
  footerNote?: string;
  /** Abmelde-Link (Newsletter) */
  unsubscribeUrl?: string;
  /** Markenname (Standard: Name der Empfängerseite) */
  brand?: string;
  /** Sprache, Marke und Basis-URL der Empfängerseite */
  ctx: MailCtx;
};

function infoCardHtml(c: NonNullable<MailLayoutOptions["infoCard"]>): string {
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="bg-info bd-info" bgcolor="${C.info}" style="margin:0 0 24px;background:${C.info};border:1px solid ${C.border};border-left:4px solid ${C.link};border-radius:8px;">` +
    `<tr><td style="padding:16px 20px;">` +
    `<p class="t-muted" style="margin:0 0 6px;font-family:${FONT};font-size:12px;line-height:1.4;letter-spacing:1px;text-transform:uppercase;font-weight:600;color:${C.muted};">${escapeHtml(c.label)}</p>` +
    `<p class="t-head" style="margin:0;font-family:${MONO};font-size:22px;line-height:1.3;font-weight:700;letter-spacing:1px;color:${C.head};word-break:break-all;">${escapeHtml(c.value)}</p>` +
    (c.hint ? `<p class="t-body" style="margin:8px 0 0;font-family:${FONT};font-size:14px;line-height:1.5;color:${C.body};">${escapeHtml(c.hint)}</p>` : "") +
    `</td></tr></table>`
  );
}

function ctaHtml(cta: { label: string; url: string }, ctx: MailCtx): string {
  const href = safeHref(cta.url);
  if (!href) return "";
  const h = escapeHtml(href);
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px;"><tr>` +
    `<td class="btn-td" align="center" bgcolor="${C.ink}" style="background:${C.ink};border-radius:6px;">` +
    `<a class="btn-a" href="${h}" target="_blank" style="display:inline-block;padding:15px 30px;font-family:${FONT};font-size:16px;font-weight:700;line-height:1;color:#ffffff;text-decoration:none;border-radius:6px;">${escapeHtml(cta.label)}&nbsp;&rarr;</a>` +
    `</td></tr></table>` +
    `<p class="t-muted" style="margin:0 0 20px;font-family:${FONT};font-size:13px;line-height:1.6;color:${C.muted};">${escapeHtml(pick(mail, ctx.locale).layout.buttonFallback)}<br><a class="t-link" href="${h}" style="color:${C.link};word-break:break-all;">${h}</a></p>`
  );
}

export function renderMailLayout(o: MailLayoutOptions): string {
  const { ctx } = o;
  const m = pick(mail, ctx.locale);
  const brand = oneLine(o.brand ?? ctx.site.name) || ctx.site.name;
  const alt = escapeHtml(brand);
  const pre = o.preheader ? oneLine(o.preheader) : "";
  const unsub = o.unsubscribeUrl ? safeHref(o.unsubscribeUrl) : null;
  const card = o.infoCard ? infoCardHtml(o.infoCard) : "";

  const preheader = pre
    ? `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;color:${C.page};">${escapeHtml(pre)}${"&nbsp;&zwnj;".repeat(40)}</div>`
    : "";

  const footerLines = [
    `<p class="t-muted" style="margin:0 0 6px;font-family:${FONT};font-size:12px;line-height:1.6;font-weight:600;color:${C.muted};">${escapeHtml(brand)} &middot; ${escapeHtml(m.layout.handInHand(m.layout.partnerName))}</p>`,
    `<p class="t-muted" style="margin:0 0 6px;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.muted};">${escapeHtml(o.footerNote ?? m.noReply)}</p>`,
    unsub
      ? `<p class="t-muted" style="margin:0;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.muted};"><a class="t-link" href="${escapeHtml(unsub)}" style="color:${C.link};text-decoration:underline;">${escapeHtml(m.layout.unsubscribe)}</a></p>`
      : "",
  ].join("");

  return `<!doctype html>
<html lang="${ctx.locale}" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(oneLine(o.heading))}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>
${styleBlock()}
</style>
</head>
<body class="bg-page" style="margin:0;padding:0;width:100%;background:${C.page};">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="bg-page" bgcolor="${C.page}" style="background:${C.page};">
<tr><td align="center" class="outer" style="padding:32px 12px 40px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="container" style="width:600px;max-width:100%;">
<tr><td>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="bg-card bd-card" bgcolor="${C.card}" style="background:${C.card};border:1px solid ${C.border};border-radius:12px;">
<tr><td height="6" style="height:6px;line-height:6px;font-size:6px;border-radius:12px 12px 0 0;background:${C.link};background-image:linear-gradient(90deg,#1e73be,#3d8bff);">&nbsp;</td></tr>
<tr><td class="px" style="padding:28px 40px 0;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td valign="middle" width="48" style="width:48px;">
<img class="logo-light" src="${escapeHtml(brandLogoUrl("light", ctx.baseUrl))}" width="48" height="48" alt="${alt}" style="display:block;width:48px;height:48px;border:0;">
<img class="logo-dark" src="${escapeHtml(brandLogoUrl("dark", ctx.baseUrl))}" width="48" height="48" alt="${alt}" style="display:none;max-height:0;overflow:hidden;mso-hide:all;width:48px;height:48px;border:0;">
</td>
<td valign="middle" style="padding-left:10px;"><span class="t-head" style="font-family:${FONT};font-size:18px;line-height:1.2;font-weight:600;letter-spacing:.2px;color:${C.head};">${alt}</span></td>
</tr></table>
</td></tr>
<tr><td class="px" style="padding:24px 40px 36px;">
<h1 class="h1 t-head" style="margin:0 0 14px;font-family:${FONT};font-size:24px;line-height:1.3;font-weight:600;color:${C.head};">${escapeHtml(oneLine(o.heading))}</h1>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;"><tr><td width="44" height="3" bgcolor="${C.link}" style="width:44px;height:3px;line-height:3px;font-size:3px;background:${C.link};border-radius:2px;">&nbsp;</td></tr></table>
${o.introHtml ?? ""}
${o.infoCardAfterBody ? "" : card}
${o.bodyHtml}
${o.infoCardAfterBody ? card : ""}
${o.cta ? ctaHtml(o.cta, ctx) : ""}
${o.secondaryNoteHtml ?? ""}
</td></tr>
</table>
</td></tr>
<tr><td align="center" class="px" style="padding:20px 24px 0;text-align:center;">
${footerLines}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------------------------
// Markdown → E-Mail-HTML und Klartext. Bewusst klein und sicher: kein rohes HTML, keine Bilder,
// Links nur http/https, alles wird escaped. (react-dom/server ist im App Router von Next nicht importierbar.)
// ---------------------------------------------------------------------------------------------
type Inline =
  | { t: "text"; v: string }
  | { t: "code"; v: string }
  | { t: "br" }
  | { t: "strong" | "em" | "del"; c: Inline[] }
  | { t: "link"; c: Inline[]; href: string };

type Align = "left" | "center" | "right" | null;
type Block =
  | { t: "p"; c: Inline[] }
  | { t: "h"; level: number; c: Inline[] }
  | { t: "list"; ordered: boolean; start: number; items: Array<{ task: boolean | null; blocks: Block[] }> }
  | { t: "quote"; c: Block[] }
  | { t: "hr" }
  | { t: "code"; v: string }
  | { t: "table"; head: Inline[][]; align: Align[]; rows: Inline[][][] };

const PUNCT = /[!-/:-@[-`{-~]/;
const MAX_INLINE_DEPTH = 6;
const MAX_BLOCK_DEPTH = 5;
const CLOSER_WINDOW = 1500;

function findClosingBackticks(src: string, from: number, run: number): number {
  let pos = from;
  for (;;) {
    const idx = src.indexOf("`", pos);
    if (idx < 0) return -1;
    let j = idx;
    while (src[j] === "`") j++;
    if (j - idx === run) return idx;
    pos = j;
  }
}

/** Sucht das passende "]" zu einem "[" an Position `open`. */
function findBracketEnd(src: string, open: number): number {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    if (ch === "\\") i++;
    else if (ch === "`") {
      let j = i;
      while (src[j] === "`") j++;
      const close = findClosingBackticks(src, j, j - i);
      if (close >= 0) i = close + (j - i) - 1;
      else i = j - 1;
    } else if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) return i;
    }
    if (i - open > 2000) return -1;
  }
  return -1;
}

/** Liest "(ziel "titel")" ab Position `at` (zeigt auf "("). */
function parseLinkTarget(src: string, at: number): { href: string; end: number } | null {
  let i = at + 1;
  while (src[i] === " " || src[i] === "\n") i++;
  let href = "";
  if (src[i] === "<") {
    const close = src.indexOf(">", i);
    if (close < 0 || src.slice(i, close).includes("\n")) return null;
    href = src.slice(i + 1, close);
    i = close + 1;
  } else {
    let depth = 0;
    const start = i;
    while (i < src.length) {
      const ch = src[i]!;
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (/\s/.test(ch)) break;
      if (ch === "(") depth++;
      else if (ch === ")") {
        if (depth === 0) break;
        depth--;
      }
      i++;
    }
    href = src.slice(start, i);
  }
  while (src[i] === " " || src[i] === "\n") i++;
  if (src[i] === '"' || src[i] === "'" || src[i] === "(") {
    const q = src[i] === "(" ? ")" : src[i]!;
    const close = src.indexOf(q, i + 1);
    if (close < 0) return null;
    i = close + 1;
    while (src[i] === " " || src[i] === "\n") i++;
  }
  if (src[i] !== ")") return null;
  return { href: href.replace(/\\([!-/:-@[-`{-~])/g, "$1"), end: i + 1 };
}

const isAlnum = (c: string | undefined) => !!c && /[\p{L}\p{N}]/u.test(c);
const isSpace = (c: string | undefined) => c === undefined || /\s/.test(c);

function parseInline(src: string, depth = 0, inLink = false): Inline[] {
  const out: Inline[] = [];
  let buf = "";
  const flush = () => {
    if (buf) out.push({ t: "text", v: buf });
    buf = "";
  };
  const n = src.length;
  let i = 0;

  while (i < n) {
    const ch = src[i]!;

    if (ch === "\\") {
      const nx = src[i + 1];
      if (nx === "\n") {
        buf = buf.replace(/ +$/, "");
        flush();
        out.push({ t: "br" });
        i += 2;
        continue;
      }
      if (nx !== undefined && PUNCT.test(nx)) {
        buf += nx;
        i += 2;
        continue;
      }
      buf += ch;
      i++;
      continue;
    }

    if (ch === "\n") {
      if (/ {2,}$/.test(buf)) {
        buf = buf.replace(/ +$/, "");
        flush();
        out.push({ t: "br" });
      } else {
        buf = buf.replace(/ +$/, "") + "\n";
      }
      i++;
      while (src[i] === " ") i++;
      continue;
    }

    if (ch === "`") {
      let j = i;
      while (src[j] === "`") j++;
      const run = j - i;
      const close = findClosingBackticks(src, j, run);
      if (close >= 0) {
        flush();
        let code = src.slice(j, close).replace(/\n/g, " ");
        if (code.length > 2 && code.startsWith(" ") && code.endsWith(" ") && code.trim() !== "") code = code.slice(1, -1);
        out.push({ t: "code", v: code });
        i = close + run;
        continue;
      }
      buf += "`".repeat(run);
      i = j;
      continue;
    }

    // Bilder werden nie eingebettet: nur der Alternativtext (verlinkt) bleibt übrig.
    const isImage = ch === "!" && src[i + 1] === "[";
    if ((ch === "[" || isImage) && depth < MAX_INLINE_DEPTH) {
      const open = isImage ? i + 1 : i;
      const close = findBracketEnd(src, open);
      if (close > 0 && src[close + 1] === "(") {
        const target = parseLinkTarget(src, close + 1);
        if (target) {
          const inner = src.slice(open + 1, close);
          const href = safeHref(target.href);
          flush();
          if (isImage) {
            const alt = inner.replace(/[*_~`[\]]/g, "").trim();
            if (href && alt && !inLink) out.push({ t: "link", c: [{ t: "text", v: alt }], href });
            else if (alt) out.push({ t: "text", v: alt });
          } else if (href && !inLink) {
            out.push({ t: "link", c: parseInline(inner, depth + 1, true), href });
          } else {
            out.push(...parseInline(inner, depth + 1, inLink));
          }
          i = target.end;
          continue;
        }
      }
    }

    if (ch === "<" && !inLink) {
      const m = /^<(https?:\/\/[^\s<>]+)>/i.exec(src.slice(i, i + 2100));
      if (m) {
        const href = safeHref(m[1]!);
        if (href) {
          flush();
          out.push({ t: "link", c: [{ t: "text", v: m[1]! }], href });
          i += m[0].length;
          continue;
        }
      }
    }

    if ((ch === "h" || ch === "H") && !inLink && !isAlnum(src[i - 1]) && /^https?:\/\//i.test(src.slice(i, i + 8))) {
      const m = /^[^\s<]+/.exec(src.slice(i, i + 2100));
      if (m) {
        let url = m[0];
        // Satzzeichen am Ende gehören nicht zur Adresse
        for (;;) {
          const last = url[url.length - 1]!;
          if (/[.,;:!?'"*_~]/.test(last)) url = url.slice(0, -1);
          else if (last === ")" && (url.match(/\(/g)?.length ?? 0) < (url.match(/\)/g)?.length ?? 0)) url = url.slice(0, -1);
          else break;
        }
        const href = safeHref(url);
        if (href) {
          flush();
          out.push({ t: "link", c: [{ t: "text", v: url }], href });
          i += url.length;
          continue;
        }
      }
    }

    if ((ch === "*" || ch === "_" || ch === "~") && depth < MAX_INLINE_DEPTH) {
      let j = i;
      while (src[j] === ch) j++;
      const run = j - i;
      const use = ch === "~" ? (run === 2 ? 2 : 0) : Math.min(run, 3);
      const canOpen = use > 0 && !isSpace(src[j]) && (ch !== "_" || !isAlnum(src[i - 1]));
      if (canOpen) {
        let k = j;
        let found = -1;
        const limit = Math.min(n, j + CLOSER_WINDOW);
        while (k < limit) {
          const c2 = src[k]!;
          if (c2 === "\\") {
            k += 2;
            continue;
          }
          if (c2 === ch) {
            let e = k;
            while (src[e] === ch) e++;
            const m = e - k;
            const okRun = use === 1 ? m === 1 : m >= use;
            if (okRun && !isSpace(src[k - 1]) && (ch !== "_" || !isAlnum(src[e]))) {
              found = k;
              break;
            }
            k = e;
            continue;
          }
          k++;
        }
        if (found > j) {
          flush();
          const children = parseInline(src.slice(j, found), depth + 1, inLink);
          if (ch === "~") out.push({ t: "del", c: children });
          else if (use === 3) out.push({ t: "strong", c: [{ t: "em", c: children }] });
          else out.push({ t: use === 2 ? "strong" : "em", c: children });
          i = found + use;
          continue;
        }
      }
      buf += src.slice(i, j);
      i = j;
      continue;
    }

    buf += ch;
    i++;
  }
  flush();
  return out;
}

// ---- Blockebene ----
const RE_FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const RE_HEADING = /^ {0,3}(#{1,6})[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/;
const RE_HR = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const RE_QUOTE = /^ {0,3}>/;
const RE_ITEM = /^( {0,3})([-+*]|\d{1,9}[.)])(?:([ \t]+)(.*))?$/;
const RE_DELIM = /^ {0,3}\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/;
const RE_SETEXT = /^ {0,3}(=+|-+)[ \t]*$/;

const indentOf = (s: string) => /^ */.exec(s)![0].length;

function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
  return s.split(/(?<!\\)\|/).map((c) => c.replace(/\\\|/g, "|").trim());
}

function startsBlock(line: string, nextLine: string | undefined, forParagraph: boolean): boolean {
  if (RE_FENCE.test(line) || RE_HEADING.test(line) || RE_HR.test(line) || RE_QUOTE.test(line)) return true;
  const m = RE_ITEM.exec(line);
  if (m && (m[4] ?? "").trim() !== "") {
    // Nur eine mit "1" beginnende Nummerierung darf einen Absatz unterbrechen
    if (!forParagraph || !/\d/.test(m[2]!) || /^0*1[.)]$/.test(m[2]!)) return true;
  }
  if (nextLine !== undefined && line.includes("|") && RE_DELIM.test(nextLine) && nextLine.includes("-") && (nextLine.includes("|") || line.trim().startsWith("|"))) return true;
  return false;
}

function parseBlocks(src: string, depth = 0): Block[] {
  const lines = src.split("\n");
  const out: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;
    if (/^\s*$/.test(line)) {
      i++;
      continue;
    }

    const fence = RE_FENCE.exec(line);
    if (fence && !(fence[1]![0] === "`" && fence[2]!.includes("`"))) {
      const ch = fence[1]![0]!;
      const len = fence[1]!.length;
      const closeRe = new RegExp(`^ {0,3}\\${ch}{${len},}[ \\t]*$`);
      const body: string[] = [];
      i++;
      while (i < lines.length && !closeRe.test(lines[i]!)) body.push(lines[i++]!);
      i++; // schließende Zeile
      out.push({ t: "code", v: body.join("\n") });
      continue;
    }

    const hd = RE_HEADING.exec(line);
    if (hd) {
      out.push({ t: "h", level: hd[1]!.length, c: parseInline(hd[2]!.trim()) });
      i++;
      continue;
    }

    if (RE_HR.test(line)) {
      out.push({ t: "hr" });
      i++;
      continue;
    }

    if (RE_QUOTE.test(line) && depth < MAX_BLOCK_DEPTH) {
      const inner: string[] = [];
      while (i < lines.length && RE_QUOTE.test(lines[i]!)) inner.push(lines[i++]!.replace(/^ {0,3}> ?/, ""));
      out.push({ t: "quote", c: parseBlocks(inner.join("\n"), depth + 1) });
      continue;
    }

    // Tabelle (GFM)
    if (line.includes("|") && i + 1 < lines.length && RE_DELIM.test(lines[i + 1]!) && lines[i + 1]!.includes("-")) {
      const head = splitRow(line);
      const delim = splitRow(lines[i + 1]!);
      if (head.length === delim.length && delim.every((d) => /^:?-+:?$/.test(d))) {
        const align: Align[] = delim.map((d) => (d.startsWith(":") && d.endsWith(":") ? "center" : d.endsWith(":") ? "right" : d.startsWith(":") ? "left" : null));
        i += 2;
        const rows: Inline[][][] = [];
        while (i < lines.length && lines[i]!.trim() !== "" && lines[i]!.includes("|") && rows.length < 200) {
          const cells = splitRow(lines[i++]!);
          rows.push(head.map((_, idx) => parseInline(cells[idx] ?? "")));
        }
        out.push({ t: "table", head: head.map((h) => parseInline(h)), align, rows });
        continue;
      }
    }

    const item = RE_ITEM.exec(line);
    if (item && depth < MAX_BLOCK_DEPTH) {
      const ordered = /\d/.test(item[2]!);
      const start = ordered ? Number.parseInt(item[2]!, 10) : 1;
      const items: Array<{ task: boolean | null; blocks: Block[] }> = [];
      while (i < lines.length) {
        const m = RE_ITEM.exec(lines[i]!);
        if (!m || /\d/.test(m[2]!) !== ordered) break;
        const markerWidth = m[1]!.length + m[2]!.length;
        const gap = (m[3] ?? "").replace(/\t/g, "    ").length;
        const contentIndent = markerWidth + (gap === 0 || gap > 4 ? 1 : gap);
        const content: string[] = [(m[4] ?? "").trimEnd()];
        i++;
        while (i < lines.length) {
          const l = lines[i]!;
          if (/^\s*$/.test(l)) {
            // Leerzeile: gehört zum Eintrag, wenn danach eingerückter Inhalt folgt
            let k = i;
            while (k < lines.length && /^\s*$/.test(lines[k]!)) k++;
            if (k < lines.length && indentOf(lines[k]!) >= contentIndent) {
              for (; i < k; i++) content.push("");
              continue;
            }
            break;
          }
          if (indentOf(l) >= contentIndent) {
            content.push(l.slice(contentIndent));
            i++;
            continue;
          }
          // Lazy-Fortsetzung eines Absatzes
          const prev = content[content.length - 1] ?? "";
          if (prev.trim() !== "" && !startsBlock(l.trimStart(), lines[i + 1], true) && !RE_ITEM.test(l)) {
            content.push(l.trim());
            i++;
            continue;
          }
          break;
        }
        const blocks = parseBlocks(content.join("\n"), depth + 1);
        let task: boolean | null = null;
        const first = blocks[0];
        if (first && first.t === "p") {
          const head = first.c[0];
          const tm = head && head.t === "text" ? /^\[([ xX])\]\s+/.exec(head.v) : null;
          if (tm && head && head.t === "text") {
            task = tm[1] !== " ";
            head.v = head.v.slice(tm[0].length);
          }
        }
        items.push({ task, blocks });
        // Leerzeilen zwischen Einträgen überspringen, solange ein weiterer Eintrag folgt
        let k = i;
        while (k < lines.length && /^\s*$/.test(lines[k]!)) k++;
        const nextItem = k < lines.length ? RE_ITEM.exec(lines[k]!) : null;
        if (nextItem && /\d/.test(nextItem[2]!) === ordered && indentOf(lines[k]!) < 4) i = k;
      }
      out.push({ t: "list", ordered, start, items });
      continue;
    }

    // Absatz (ggf. Setext-Überschrift)
    const para: string[] = [line.trimStart()];
    i++;
    let heading = 0;
    while (i < lines.length) {
      const l = lines[i]!;
      if (/^\s*$/.test(l)) break;
      const se = RE_SETEXT.exec(l);
      if (se) {
        heading = se[1]![0] === "=" ? 1 : 2;
        i++;
        break;
      }
      if (startsBlock(l, lines[i + 1], true)) break;
      para.push(l.trimStart());
      i++;
    }
    const text = para.join("\n").replace(/\s+$/, "");
    out.push(heading ? { t: "h", level: heading, c: parseInline(text.replace(/\n/g, " ")) } : { t: "p", c: parseInline(text) });
  }
  return out;
}

// ---- HTML-Renderer ----
const HEAD_SIZE = [0, 24, 21, 18, 16, 16, 16];

function inlineHtml(nodes: Inline[]): string {
  return nodes
    .map((n) => {
      switch (n.t) {
        case "text":
          return escapeHtml(n.v);
        case "br":
          return "<br>";
        case "code":
          return `<code class="bg-info t-head" style="padding:2px 5px;border-radius:4px;background:${C.info};font-family:${MONO};font-size:14px;color:${C.head};">${escapeHtml(n.v)}</code>`;
        case "strong":
          return `<strong class="t-head" style="font-weight:700;color:${C.head};">${inlineHtml(n.c)}</strong>`;
        case "em":
          return `<em>${inlineHtml(n.c)}</em>`;
        case "del":
          return `<span style="text-decoration:line-through;">${inlineHtml(n.c)}</span>`;
        case "link":
          return `<a class="t-link" href="${escapeHtml(n.href)}" target="_blank" style="color:${C.link};text-decoration:underline;">${inlineHtml(n.c)}</a>`;
      }
    })
    .join("");
}

function blockHtml(b: Block, tight = false): string {
  const mb = tight ? 6 : 16;
  switch (b.t) {
    case "p":
      return `<p class="t-body" style="margin:0 0 ${mb}px;font-family:${FONT};font-size:16px;line-height:1.6;color:${C.body};">${inlineHtml(b.c)}</p>`;
    case "h":
      return `<h2 class="t-head" style="margin:28px 0 12px;font-family:${FONT};font-size:${HEAD_SIZE[b.level]}px;line-height:1.3;font-weight:600;color:${C.head};">${inlineHtml(b.c)}</h2>`;
    case "hr":
      return `<hr class="hr-line" style="margin:24px 0;border:0;border-top:1px solid ${C.border};height:0;">`;
    case "code":
      return `<pre class="bg-info bd-info t-head" style="margin:0 0 ${mb}px;padding:12px 14px;border:1px solid ${C.border};border-radius:8px;background:${C.info};font-family:${MONO};font-size:13px;line-height:1.5;color:${C.head};white-space:pre-wrap;word-break:break-word;">${escapeHtml(b.v)}</pre>`;
    case "quote":
      return `<blockquote style="margin:0 0 ${mb}px;padding:2px 0 2px 16px;border-left:4px solid ${C.link};">${b.c.map((x) => blockHtml(x, tight)).join("")}</blockquote>`;
    case "list": {
      const tag = b.ordered ? "ol" : "ul";
      const startAttr = b.ordered && b.start !== 1 ? ` start="${b.start}"` : "";
      const items = b.items
        .map((it) => {
          const only = it.blocks.length === 1 && it.blocks[0]!.t === "p" ? it.blocks[0]! : null;
          const inner = only && only.t === "p" ? inlineHtml(only.c) : it.blocks.map((x) => blockHtml(x, true)).join("");
          const box = it.task === null ? "" : it.task ? "&#9745; " : "&#9744; ";
          return `<li class="t-body" style="margin:0 0 6px;font-family:${FONT};font-size:16px;line-height:1.6;color:${C.body};">${box}${inner}</li>`;
        })
        .join("");
      return `<${tag}${startAttr} style="margin:0 0 ${mb}px;padding:0 0 0 24px;">${items}</${tag}>`;
    }
    case "table": {
      const cell = (tag: "th" | "td", c: Inline[], a: Align) =>
        `<${tag} class="${tag === "th" ? "bg-info bd-card t-head" : "bd-card t-body"}" align="${a ?? "left"}" style="padding:8px 10px;border:1px solid ${C.border};${tag === "th" ? `background:${C.info};font-weight:600;color:${C.head};` : `color:${C.body};`}font-family:${FONT};font-size:15px;line-height:1.5;text-align:${a ?? "left"};">${inlineHtml(c)}</${tag}>`;
      const head = `<tr>${b.head.map((h, i) => cell("th", h, b.align[i] ?? null)).join("")}</tr>`;
      const rows = b.rows.map((r) => `<tr>${r.map((c, i) => cell("td", c, b.align[i] ?? null)).join("")}</tr>`).join("");
      return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 ${mb}px;width:100%;border-collapse:collapse;">${head}${rows}</table>`;
    }
  }
}

// ---- Text-Renderer ----
function inlineText(nodes: Inline[]): string {
  return nodes
    .map((n) => {
      switch (n.t) {
        case "text":
        case "code":
          return n.v;
        case "br":
          return "\n";
        case "strong":
        case "em":
        case "del":
          return inlineText(n.c);
        case "link": {
          const label = inlineText(n.c);
          return label === n.href || label === n.href.replace(/\/$/, "") ? n.href : `${label} (${n.href})`;
        }
      }
    })
    .join("");
}

function blockText(b: Block, indent = ""): string {
  const pad = (s: string) => s.split("\n").map((l) => (l ? indent + l : l)).join("\n");
  switch (b.t) {
    case "p":
      return pad(inlineText(b.c));
    case "h":
      return pad(b.level <= 2 ? inlineText(b.c).toUpperCase() : inlineText(b.c));
    case "hr":
      return pad("----------");
    case "code":
      return b.v.split("\n").map((l) => `${indent}    ${l}`).join("\n");
    case "quote":
      return b.c.map((x) => blockText(x)).join("\n\n").split("\n").map((l) => `${indent}> ${l}`.trimEnd()).join("\n");
    case "list":
      return b.items
        .map((it, idx) => {
          const marker = b.ordered ? `${b.start + idx}. ` : "- ";
          const box = it.task === null ? "" : it.task ? "[x] " : "[ ] ";
          const inner = it.blocks.map((x) => blockText(x)).join("\n");
          const lines = inner.split("\n");
          return lines.map((l, k) => (k === 0 ? `${indent}${marker}${box}${l}` : l ? `${indent}${" ".repeat(marker.length)}${l}` : l)).join("\n");
        })
        .join("\n");
    case "table":
      return [b.head, ...b.rows].map((r) => indent + r.map((c) => inlineText(c)).join(" | ")).join("\n");
  }
}

function plainOf(nodes: Inline[]) {
  return inlineText(nodes).replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Wandelt Markdown in E-Mail-HTML und eine Klartext-Fassung um. Rohes HTML im Markdown wird als Text
 * dargestellt (escaped), Bilder werden nicht eingebettet, Links nur http/https.
 * `dropLeadingHeading`: entfernt eine erste Überschrift, die dem übergebenen Text (z. B. dem Betreff) entspricht.
 */
export function markdownToEmail(markdown: string, opts: { dropLeadingHeading?: string } = {}): { html: string; text: string } {
  const src = normalizeText(markdown).replace(/\t/g, "    ");
  let blocks = parseBlocks(src);
  const first = blocks[0];
  if (opts.dropLeadingHeading && first && first.t === "h" && plainOf(first.c) === opts.dropLeadingHeading.replace(/\s+/g, " ").trim().toLowerCase()) {
    blocks = blocks.slice(1);
  }
  return {
    html: blocks.map((b) => blockHtml(b)).join("\n"),
    text: blocks.map((b) => blockText(b)).join("\n\n"),
  };
}
