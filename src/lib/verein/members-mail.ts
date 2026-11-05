// Mails des Moduls Mitglieder im Marken-Layout der Website (sendVereinMail): Antrag eingegangen, Hinweis an den Vorstand,
// aufgenommen, abgelehnt, Austritt bestätigt. Links nur über links.ts (feste Basis-URL). Empfänger werden vorher geprüft.
// Die Mails nennen keine Fristen oder Beträge, die nicht aus den Einstellungen des Vereins stammen.
import "server-only";
import { formatDateCh } from "./dates";
import { memberPortalUrl, publicUrl } from "./links";
import type { ActionOutcome } from "./members-data";
import type { ExitPlan } from "./members-lib";
import { sendVereinMail } from "./mail";
import { getVereinSettings } from "./settings";
import { emailSchema } from "./validation";

export type MailReport = { sent: boolean; error?: string; skipped?: string };

async function deliver(to: string, build: () => Parameters<typeof sendVereinMail>[0]): Promise<MailReport> {
  const parsed = emailSchema.safeParse(to);
  if (!parsed.success) return { sent: false, skipped: "Keine gültige E-Mail-Adresse hinterlegt." };
  try {
    const res = await sendVereinMail({ ...build(), to: parsed.data });
    return res.ok ? { sent: true } : { sent: false, error: res.error };
  } catch (e) {
    console.error("[members-mail]", e instanceof Error ? e.name : "unbekannt");
    return { sent: false, error: "Die E-Mail konnte nicht versendet werden." };
  }
}

const greeting = (firstName: string) => (firstName.trim() ? `Hallo ${firstName.trim()}` : "Guten Tag");

/** Bestätigung an die Person, die den Antrag gestellt hat. */
export function sendApplicationReceived(m: { email: string; firstName: string; memberNumber: number }, typeName: string) {
  return deliver(m.email, () => ({
    to: m.email,
    subject: "Dein Beitrittsantrag ist eingegangen",
    heading: "Dein Antrag ist eingegangen",
    preheader: "Wir haben deinen Antrag erhalten.",
    paragraphs: [
      `${greeting(m.firstName)}`,
      "Danke für dein Interesse am Verein. Wir haben deinen Beitrittsantrag erhalten. Der Verein prüft ihn nach seinen Statuten und meldet sich bei dir.",
      "Bis dahin musst du nichts weiter tun. Falls du den Antrag nicht gestellt hast, kannst du diese Mail ignorieren oder uns kurz antworten.",
    ],
    details: [
      ["Antragsnummer", String(m.memberNumber)],
      ...(typeName ? ([["Mitgliedschaftsart", typeName]] as Array<[string, string]>) : []),
    ],
    footerNote: "Du erhältst diese Mail, weil mit deiner E-Mail-Adresse ein Beitrittsantrag gestellt wurde.",
  }));
}

/** Hinweis an die im Verein hinterlegte Adresse (Einstellung «Benachrichtigung bei Anträgen»). */
export async function sendApplicationNotice(m: { id: string; memberNumber: number; firstName: string; lastName: string; email: string }, typeName: string): Promise<MailReport> {
  const settings = await getVereinSettings();
  if (!settings.applyNotifyEmail) return { sent: false, skipped: "Keine Benachrichtigungsadresse eingestellt." };
  return deliver(settings.applyNotifyEmail, () => ({
    to: settings.applyNotifyEmail,
    subject: `Neuer Beitrittsantrag (Nr. ${m.memberNumber})`,
    heading: "Neuer Beitrittsantrag",
    preheader: `${m.firstName} ${m.lastName} möchte Mitglied werden.`,
    paragraphs: ["Über das Beitrittsformular ist ein neuer Antrag eingegangen. Er wartet auf die Prüfung durch den Vorstand."],
    details: [
      ["Name", `${m.firstName} ${m.lastName}`.trim()],
      ["E-Mail", m.email],
      ...(typeName ? ([["Mitgliedschaftsart", typeName]] as Array<[string, string]>) : []),
      ["Antragsnummer", String(m.memberNumber)],
    ],
    cta: { label: "Antrag ansehen", url: publicUrl(`/admin/members/${encodeURIComponent(m.id)}`) },
    signature: false,
    footerNote: "Interne Benachrichtigung des Vereins.",
  }));
}

export async function sendAccepted(m: { email: string; firstName: string; memberNumber: number }, typeName: string, linked: boolean) {
  const settings = await getVereinSettings();
  return deliver(m.email, () => ({
    to: m.email,
    subject: "Willkommen im Verein",
    heading: "Du bist jetzt Mitglied",
    preheader: "Dein Antrag wurde angenommen.",
    paragraphs: [
      `${greeting(m.firstName)}`,
      "Dein Beitrittsantrag wurde angenommen. Wir freuen uns, dich im Verein zu begrüssen.",
      ...(settings.welcomeMailText.trim() ? [settings.welcomeMailText.trim()] : []),
      linked
        ? "Dein Website-Konto ist mit deiner Mitgliedschaft verknüpft. Im Mitgliederbereich findest du deine Angaben und die Unterlagen des Vereins."
        : "Mit einem Konto auf der Website erhältst du Zugang zum Mitgliederbereich. Registriere dich dafür mit dieser E-Mail-Adresse und bestätige sie; die Verknüpfung mit deiner Mitgliedschaft erfolgt danach automatisch oder durch den Vorstand.",
    ],
    details: [
      ["Mitgliedernummer", String(m.memberNumber)],
      ...(typeName ? ([["Mitgliedschaftsart", typeName]] as Array<[string, string]>) : []),
    ],
    cta: linked ? { label: "Zum Mitgliederbereich", url: memberPortalUrl() } : { label: "Konto erstellen", url: publicUrl("/register") },
    footerNote: "Du erhältst diese Mail, weil dein Beitrittsantrag angenommen wurde.",
  }));
}

export function sendRejected(m: { email: string; firstName: string }) {
  return deliver(m.email, () => ({
    to: m.email,
    subject: "Dein Beitrittsantrag",
    heading: "Antwort auf deinen Beitrittsantrag",
    paragraphs: [
      `${greeting(m.firstName)}`,
      "Vielen Dank für dein Interesse am Verein. Leider können wir deinen Beitrittsantrag nicht annehmen.",
      "Wenn du Fragen dazu hast, antworte einfach auf diese Mail.",
    ],
    footerNote: "Du erhältst diese Mail, weil mit deiner E-Mail-Adresse ein Beitrittsantrag gestellt wurde.",
  }));
}

export function sendExitConfirmed(m: { email: string; firstName: string; memberNumber: number }, plan: ExitPlan) {
  return deliver(m.email, () => ({
    to: m.email,
    subject: "Bestätigung deines Austritts",
    heading: "Dein Austritt ist vorgemerkt",
    paragraphs: [
      `${greeting(m.firstName)}`,
      "Wir bestätigen den Eingang deiner Austrittserklärung. Deine Mitgliedschaft endet auf den unten genannten Termin; bis dahin bleiben deine Rechte und Pflichten als Mitglied bestehen. Massgebend sind die Statuten des Vereins.",
      "Hast du deine Meinung geändert oder stimmt der Termin nicht? Dann melde dich bitte beim Vorstand, indem du auf diese Mail antwortest.",
    ],
    details: [
      ["Mitgliedernummer", String(m.memberNumber)],
      ["Austrittserklärung vom", formatDateCh(plan.noticeAt)],
      ["Mitgliedschaft endet am", formatDateCh(plan.effective)],
    ],
    footerNote: "Du erhältst diese Mail, weil für deine Mitgliedschaft ein Austritt erfasst wurde.",
  }));
}

/** Hinweis an den Vorstand (Adresse aus den Vereinseinstellungen), wenn ein Mitglied im Portal den Austritt erklärt hat. */
export async function sendExitNotice(m: { id: string; memberNumber: number; firstName: string; lastName: string }, plan: ExitPlan): Promise<MailReport> {
  const settings = await getVereinSettings();
  if (!settings.applyNotifyEmail) return { sent: false, skipped: "Keine Benachrichtigungsadresse eingestellt." };
  return deliver(settings.applyNotifyEmail, () => ({
    to: settings.applyNotifyEmail,
    subject: `Austrittserklärung von Mitglied ${m.memberNumber}`,
    heading: "Austrittserklärung eingegangen",
    paragraphs: ["Ein Mitglied hat im Mitgliederbereich den Austritt erklärt. Der Termin wurde nach den Vereinseinstellungen berechnet; bitte prüfe ihn gemäss Statuten."],
    details: [
      ["Mitglied", `${m.firstName} ${m.lastName}`.trim()],
      ["Mitgliedernummer", String(m.memberNumber)],
      ["Erklärung vom", formatDateCh(plan.noticeAt)],
      ["Mitgliedschaft endet am", formatDateCh(plan.effective)],
    ],
    cta: { label: "Mitglied ansehen", url: publicUrl(`/admin/members/${encodeURIComponent(m.id)}`) },
    signature: false,
    footerNote: "Interne Benachrichtigung des Vereins.",
  }));
}

/** Mail zur ausgeführten Aktion (falls vorgesehen). Fehler beim Versand brechen die Aktion nie ab; das Ergebnis meldet sie. */
export async function mailAfterAction(outcome: ActionOutcome): Promise<MailReport | null> {
  switch (outcome.notify) {
    case "accepted":
      return sendAccepted(outcome.member, outcome.member.typeName, outcome.linked === true);
    case "rejected":
      return sendRejected(outcome.member);
    case "exit":
      return outcome.plan ? sendExitConfirmed(outcome.member, outcome.plan) : null;
    default:
      return null;
  }
}

