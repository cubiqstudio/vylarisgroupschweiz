// Transaktions- und Newsletter-Mails (Text + HTML, Deutsch) im gemeinsamen Marken-Layout (mail-layout.ts).
// Sprache, Marke und Links folgen dem MailCtx der Empfängerseite. Alle Nutzerdaten werden escaped,
// Betreffzeilen sind Einzeiler (kein Header-Injection-Risiko).
import { pick, type Locale } from "@/i18n";
import { labelFor, labels } from "@/i18n/labels";
import { mail } from "@/i18n/mail";
import { mailLicenses } from "@/i18n/mail-licenses";
import {
  escapeHtml,
  markdownToEmail,
  mailDetails,
  mailParagraph,
  mailQuote,
  mailSteps,
  normalizeText,
  oneLine,
  paragraphsToHtml,
  renderMailLayout,
  textFooter,
  truncate,
} from "@/lib/mail-layout";
import type { MailCtx } from "@/lib/mail-ctx";

export { escapeHtml };

export type MailContent = { subject: string; text: string; html: string };

const msg = (ctx: MailCtx) => pick(mail, ctx.locale);
const brandOf = (ctx: MailCtx) => oneLine(ctx.site.name);

const greetingFor = (ctx: MailCtx, name?: string | null) => msg(ctx).greeting(name ? oneLine(name) : "");

/** Betreff als Einzeiler und auf eine vernünftige Länge begrenzt. */
const subjectLine = (s: string, max = 140) => truncate(oneLine(s), max);

// ---------------------------------------------------------------------------------------------
// Konto-Mails
// ---------------------------------------------------------------------------------------------
type ActionMail = {
  subject: string;
  greeting: string;
  preheader: string;
  heading: string;
  paragraphs: string[];
  button: { label: string; url: string };
  notes: string[];
  footerNote?: string;
  /** zusätzlicher Absatz nach dem Button (nur Text) */
  after?: string[];
};

function actionMail(m: ActionMail, ctx: MailCtx): MailContent {
  const brand = brandOf(ctx);
  const footerNote = m.footerNote ?? msg(ctx).noReply;
  const intro = mailParagraph(escapeHtml(m.greeting));
  const body = m.paragraphs.map((p) => mailParagraph(escapeHtml(p))).join("\n");
  const after = (m.after ?? []).map((p) => mailParagraph(escapeHtml(p))).join("\n");
  const html = renderMailLayout({
    ctx,
    preheader: m.preheader,
    heading: m.heading,
    introHtml: intro,
    bodyHtml: body,
    cta: m.button,
    secondaryNoteHtml: after + m.notes.map((n) => mailParagraph(escapeHtml(n), { muted: true, small: true })).join("\n"),
    footerNote,
  });
  const text = [
    m.greeting,
    "",
    ...m.paragraphs.flatMap((p) => [p, ""]),
    `${m.button.label}:`,
    m.button.url,
    "",
    ...(m.after ?? []).flatMap((p) => [p, ""]),
    ...m.notes.flatMap((n) => [n, ""]),
    textFooter({ brand, note: footerNote }, ctx),
  ].join("\n");
  return { subject: m.subject, text, html };
}

export function verifyEmailMail(p: { name: string; link: string }, ctx: MailCtx): MailContent {
  const brand = brandOf(ctx);
  const t = msg(ctx).verify;
  return actionMail(
    {
      subject: subjectLine(t.subject(brand)),
      greeting: greetingFor(ctx, p.name),
      preheader: t.preheader,
      heading: t.heading,
      paragraphs: [t.body(brand)],
      button: { label: t.button, url: p.link },
      notes: t.notes,
    },
    ctx,
  );
}

export function resetPasswordMail(p: { name: string; link: string }, ctx: MailCtx): MailContent {
  const brand = brandOf(ctx);
  const t = msg(ctx).reset;
  return actionMail(
    {
      subject: subjectLine(t.subject(brand)),
      greeting: greetingFor(ctx, p.name),
      preheader: t.preheader,
      heading: t.heading,
      paragraphs: [t.body],
      button: { label: t.button, url: p.link },
      notes: t.notes,
    },
    ctx,
  );
}

export function accountExistsMail(p: { name?: string | null; loginUrl: string; forgotUrl: string }, ctx: MailCtx): MailContent {
  const brand = brandOf(ctx);
  const t = msg(ctx).exists;
  return actionMail(
    {
      subject: subjectLine(t.subject(brand)),
      greeting: greetingFor(ctx, p.name),
      preheader: t.preheader,
      heading: t.heading,
      paragraphs: [t.body(brand)],
      button: { label: t.button, url: p.loginUrl },
      after: [t.after(p.forgotUrl)],
      notes: t.notes,
    },
    ctx,
  );
}

// ---------------------------------------------------------------------------------------------
// Ticket-Mails
// ---------------------------------------------------------------------------------------------
export type TicketMailData = {
  ticketNumber: string;
  name: string;
  email: string;
  subject: string;
  category: string; // GENERAL | MEMBERSHIP | B2B_HOSTING | SECURITY_REPORT
  message: string;
  status: string; // OPEN | IN_PROGRESS | CLOSED
};

const categoryLabel = (c: string, locale: Locale) => labels[locale].ticketCategory[c] ?? labels[locale].ticketCategory.GENERAL!;
const statusLabel = (s: string, locale: Locale) => labelFor("ticketStatus", s, locale);

/** Optional: `canReply` = die Mail trägt eine Reply-To-Adresse, direktes Antworten ist also möglich. */
type ReplyHint = { canReply?: boolean };

export function ticketConfirmationMail(t: TicketMailData & ReplyHint, ctx: MailCtx): MailContent {
  const m = msg(ctx);
  const c = m.ticket.confirmation;
  const subject = subjectLine(c.subject(t.ticketNumber));
  const greeting = greetingFor(ctx, t.name);
  const ticketSubject = oneLine(t.subject);
  const summary = truncate(normalizeText(t.message), 400);
  const category = categoryLabel(t.category, ctx.locale);
  const steps = c.steps(oneLine(t.email));
  const footerNote = t.canReply ? c.footer : `${c.footer} ${m.noReply}`;

  const html = renderMailLayout({
    ctx,
    preheader: c.preheader(t.ticketNumber),
    heading: c.heading,
    introHtml: mailParagraph(escapeHtml(greeting)) + mailParagraph(escapeHtml(c.lead)),
    infoCard: { label: m.ticket.yourTicketId, value: t.ticketNumber, hint: c.idHint },
    bodyHtml:
      mailDetails([
        [m.ticket.subjectLabel, ticketSubject],
        [m.ticket.categoryLabel, category],
      ]) +
      mailQuote({ label: m.ticket.yourMessage, text: summary }) +
      mailSteps(c.stepsTitle, steps),
    secondaryNoteHtml: mailParagraph(escapeHtml(c.note), { muted: true, small: true }),
    footerNote,
  });

  const text = [
    greeting,
    "",
    c.lead,
    "",
    `${m.ticket.yourTicketId}: ${t.ticketNumber}`,
    c.idHint,
    "",
    `${m.ticket.subjectLabel}: ${ticketSubject}`,
    `${m.ticket.categoryLabel}: ${category}`,
    "",
    `${m.ticket.yourMessage}:`,
    summary,
    "",
    c.stepsTitle,
    ...steps.map((s, i) => `${i + 1}. ${s}`),
    "",
    c.note,
    "",
    textFooter({ brand: brandOf(ctx), note: footerNote }, ctx),
  ].join("\n");

  return { subject, text, html };
}

/**
 * Hinweis an das Team: `ctx` ist der Team-Kontext (adminMailCtx).
 */
export function ticketNotifyMail(t: TicketMailData & { adminUrl: string }, ctx: MailCtx): MailContent {
  const brand = brandOf(ctx);
  const n = pick(mail, "de").ticket;
  const ticketSubject = oneLine(t.subject);
  const subject = subjectLine(n.notify.subject(t.ticketNumber, ticketSubject));
  const sender = `${oneLine(t.name)} <${oneLine(t.email)}>`;
  const category = categoryLabel(t.category, "de");
  const message = truncate(normalizeText(t.message), 1500);
  const footerNote = n.notify.footer;

  const html = renderMailLayout({
    ctx,
    preheader: `${oneLine(t.name)}: ${ticketSubject}`,
    heading: n.notify.heading,
    infoCard: { label: n.ticketId, value: t.ticketNumber },
    bodyHtml:
      mailDetails([
        [n.notify.from, sender],
        [n.categoryLabel, category],
        [n.subjectLabel, ticketSubject],
      ]) + mailQuote({ label: n.notify.messageLabel, text: message }),
    cta: { label: n.notify.button, url: t.adminUrl },
    footerNote,
  });

  const text = [
    n.notify.heading,
    "",
    `${n.ticketId}: ${t.ticketNumber}`,
    `${n.notify.from}: ${sender}`,
    `${n.categoryLabel}: ${category}`,
    `${n.subjectLabel}: ${ticketSubject}`,
    "",
    message,
    "",
    `${n.notify.button}: ${t.adminUrl}`,
    "",
    textFooter({ brand, note: footerNote }, ctx),
  ].join("\n");

  return { subject, text, html };
}

export function ticketStatusMail(t: TicketMailData & ReplyHint, ctx: MailCtx): MailContent {
  const m = msg(ctx);
  const s = m.ticket.status;
  const known = t.status === "OPEN" || t.status === "IN_PROGRESS" || t.status === "CLOSED" ? s[t.status] : null;
  const label = oneLine(statusLabel(t.status, ctx.locale));
  const copy = known ?? { heading: s.other.heading, lead: s.other.lead(label), pre: s.other.pre };
  const ticketSubject = oneLine(t.subject);
  const subject = subjectLine(s.subject(t.ticketNumber, label));
  const greeting = greetingFor(ctx, t.name);
  const footerNote = `${m.ticket.contactFormNote}${t.canReply ? "" : ` ${m.noReply}`}`;

  const html = renderMailLayout({
    ctx,
    preheader: copy.pre,
    heading: copy.heading,
    introHtml: mailParagraph(escapeHtml(greeting)) + mailParagraph(escapeHtml(copy.lead)),
    infoCard: { label: m.ticket.ticketId, value: t.ticketNumber, hint: `${m.ticket.statusLabel}: ${label}` },
    bodyHtml: mailDetails([[m.ticket.subjectLabel, ticketSubject]]),
    secondaryNoteHtml: mailParagraph(escapeHtml(m.ticket.mentionId), { muted: true, small: true }),
    footerNote,
  });

  const text = [
    greeting,
    "",
    copy.lead,
    "",
    `${m.ticket.ticketId}: ${t.ticketNumber}`,
    `${m.ticket.statusLabel}: ${label}`,
    `${m.ticket.subjectLabel}: ${ticketSubject}`,
    "",
    m.ticket.mentionId,
    "",
    textFooter({ brand: brandOf(ctx), note: footerNote }, ctx),
  ].join("\n");

  return { subject, text, html };
}

export function ticketReplyMail(t: TicketMailData & { reply: string; author: string } & ReplyHint, ctx: MailCtx): MailContent {
  const m = msg(ctx);
  const r = m.ticket.reply;
  const brand = brandOf(ctx);
  const author = oneLine(t.author) || brand;
  const ticketSubject = oneLine(t.subject);
  const subject = subjectLine(r.subject(t.ticketNumber, ticketSubject));
  const greeting = greetingFor(ctx, t.name);
  const reply = normalizeText(t.reply);
  const original = truncate(normalizeText(t.message), 300);
  const lead = r.lead(author);
  const hint = t.canReply ? r.hintCanReply : r.hintNoReply;
  const footerNote = `${m.ticket.contactFormNote}${t.canReply ? "" : ` ${m.noReply}`}`;

  const html = renderMailLayout({
    ctx,
    preheader: truncate(oneLine(reply), 110),
    heading: r.heading,
    introHtml: mailParagraph(escapeHtml(greeting)) + mailParagraph(escapeHtml(lead)),
    bodyHtml: mailQuote({ text: reply, emphasis: true }) + mailQuote({ label: m.ticket.originalMessage, text: original, muted: true }),
    infoCard: { label: m.ticket.ticketId, value: t.ticketNumber, hint: ticketSubject },
    infoCardAfterBody: true,
    secondaryNoteHtml: mailParagraph(escapeHtml(hint), { muted: true, small: true }),
    footerNote,
  });

  const text = [
    greeting,
    "",
    lead,
    "",
    ...reply.split("\n").map((l) => (l ? `> ${l}` : ">")),
    "",
    `${m.ticket.ticketId}: ${t.ticketNumber}`,
    `${m.ticket.subjectLabel}: ${ticketSubject}`,
    "",
    `${m.ticket.originalMessage}:`,
    ...original.split("\n").map((l) => (l ? `> ${l}` : ">")),
    "",
    hint,
    "",
    textFooter({ brand, note: footerNote }, ctx),
  ].join("\n");

  return { subject, text, html };
}

// ---------------------------------------------------------------------------------------------
// Newsletter
// ---------------------------------------------------------------------------------------------
export function newsletterConfirmMail(p: { name: string; confirmUrl: string; unsubscribeUrl: string }, ctx: MailCtx): MailContent {
  const brand = brandOf(ctx);
  const n = msg(ctx).newsletter;
  const greeting = greetingFor(ctx, p.name);
  const lead = n.confirmLead(brand);
  const notes = n.confirmNotes;
  const footerNote = n.confirmFooter(brand);

  const html = renderMailLayout({
    ctx,
    preheader: n.confirmPreheader,
    heading: n.confirmHeading,
    introHtml: mailParagraph(escapeHtml(greeting)),
    bodyHtml: mailParagraph(escapeHtml(lead)),
    cta: { label: n.confirmButton, url: p.confirmUrl },
    secondaryNoteHtml: notes.map((x) => mailParagraph(escapeHtml(x), { muted: true, small: true })).join("\n"),
    footerNote,
    unsubscribeUrl: p.unsubscribeUrl,
  });

  const text = [
    greeting,
    "",
    lead,
    "",
    `${n.confirmButton}:`,
    p.confirmUrl,
    "",
    ...notes.flatMap((x) => [x, ""]),
    textFooter({ brand, note: footerNote, unsubscribeUrl: p.unsubscribeUrl }, ctx),
  ].join("\n");

  return { subject: n.confirmSubject, text, html };
}

export function newsletterCampaignMail(p: { subject: string; preheader: string; markdown: string; name: string; unsubscribeUrl: string }, ctx: MailCtx): MailContent {
  const brand = brandOf(ctx);
  const m = msg(ctx);
  const subject = subjectLine(p.subject, 200) || m.newsletter.campaignFallbackSubject(brand);
  const name = oneLine(p.name ?? "");
  const md = markdownToEmail(p.markdown, { dropLeadingHeading: subject });
  const footerNote = m.newsletter.campaignFooter(brand);
  const greeting = name ? m.greeting(name) : "";

  const html = renderMailLayout({
    ctx,
    preheader: p.preheader,
    heading: subject,
    introHtml: greeting ? paragraphsToHtml(greeting) : "",
    bodyHtml: md.html,
    footerNote,
    unsubscribeUrl: p.unsubscribeUrl,
  });

  const text = [subject, "=".repeat(Math.min(subject.length, 72)), "", ...(greeting ? [greeting, ""] : []), md.text, "", textFooter({ brand, note: footerNote, unsubscribeUrl: p.unsubscribeUrl }, ctx)].join("\n");

  return { subject, text, html };
}

// ---------------------------------------------------------------------------------------------
// Lizenzen, Webspace-Konten und Firmenkunden
// ---------------------------------------------------------------------------------------------
export type LicenseDecisionKind = "keyApproved" | "keyRejected" | "keyRevoked" | "webspaceApproved" | "webspaceRejected" | "businessApproved" | "businessRejected";

/**
 * Entscheidung zu einem Antrag an die Person (Sprache und Marke der Seite, bei der sich das Konto angelegt hat).
 * Der Lizenzschlüssel steht bewusst nie in der Mail: `accountUrl` führt ins Konto (/account/licenses der Domain).
 * `adminNote` = Hinweis des Teams, wird als Zitat angezeigt (escaped).
 */
export function licenseDecisionMail(
  p: { kind: LicenseDecisionKind; name?: string | null; product?: string; company?: string | null; adminNote?: string | null; accountUrl: string },
  ctx: MailCtx,
): MailContent {
  const brand = brandOf(ctx);
  const l = pick(mailLicenses, ctx.locale);
  const c = l.decision[p.kind];
  const product = oneLine(p.product ?? "");
  const company = truncate(oneLine(p.company ?? ""), 120);
  const what = p.kind.startsWith("business") ? company : product;
  const note = truncate(normalizeText(p.adminNote ?? ""), 1000);
  const subject = subjectLine(c.subject(what));
  const greeting = greetingFor(ctx, p.name);
  const lead = c.lead(what);
  const footerNote = `${l.footer(brand)} ${msg(ctx).noReply}`;
  const details: Array<[string, string]> = p.kind.startsWith("business") ? [[l.companyLabel, company]] : [[l.productLabel, product]];

  const html = renderMailLayout({
    ctx,
    preheader: c.preheader,
    heading: c.heading,
    introHtml: mailParagraph(escapeHtml(greeting)) + mailParagraph(escapeHtml(lead)),
    bodyHtml: mailDetails(details) + (note ? mailQuote({ label: l.noteLabel, text: note }) : "") + mailParagraph(escapeHtml(c.extra)),
    cta: { label: c.button, url: p.accountUrl },
    footerNote,
  });

  const text = [
    greeting,
    "",
    lead,
    "",
    ...details.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`),
    ...(note ? ["", `${l.noteLabel}:`, ...note.split("\n").map((x) => (x ? `> ${x}` : ">"))] : []),
    "",
    c.extra,
    "",
    `${c.button}:`,
    p.accountUrl,
    "",
    textFooter({ brand, note: footerNote }, ctx),
  ].join("\n");

  return { subject, text, html };
}

/**
 * Hinweis an das Team über einen neuen Antrag (`ctx` = adminMailCtx).
 * Enthält nur das Nötige: Name, E-Mail, Produkt bzw. Firma und die gekürzte Nachricht.
 */
export function licenseTeamMail(
  p: { kind: "key" | "webspace" | "business"; userName: string; userEmail: string; product?: string; company?: string | null; message?: string | null; adminUrl: string },
  ctx: MailCtx,
): MailContent {
  const brand = brandOf(ctx);
  const t = pick(mailLicenses, "de").team;
  const product = oneLine(p.product ?? "");
  const company = truncate(oneLine(p.company ?? ""), 120);
  const sender = `${truncate(oneLine(p.userName), 100)} <${oneLine(p.userEmail)}>`;
  const message = truncate(normalizeText(p.message ?? ""), 300);
  const subject = subjectLine(p.kind === "business" ? t.subject.business(company) : t.subject[p.kind](product));
  const labels = pick(mailLicenses, "de");
  const details: Array<[string, string]> = [
    [t.from, sender],
    ...(p.kind === "business" ? [[labels.companyLabel, company] as [string, string]] : [[labels.productLabel, product] as [string, string]]),
  ];

  const html = renderMailLayout({
    ctx,
    preheader: `${oneLine(p.userName)}: ${p.kind === "business" ? company : product}`,
    heading: t.heading[p.kind],
    bodyHtml: mailDetails(details) + (message ? mailQuote({ label: t.messageLabel, text: message }) : ""),
    cta: { label: t.button[p.kind], url: p.adminUrl },
    footerNote: t.footer,
  });

  const text = [
    t.heading[p.kind],
    "",
    ...details.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`),
    ...(message ? ["", `${t.messageLabel}:`, message] : []),
    "",
    `${t.button[p.kind]}: ${p.adminUrl}`,
    "",
    textFooter({ brand, note: t.footer }, ctx),
  ].join("\n");

  return { subject, text, html };
}
