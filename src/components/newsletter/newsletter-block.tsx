import { isMailConfigured } from "@/lib/mailer";
import { getNewsletterEnabled } from "@/lib/settings";
import { NewsletterSignup } from "./newsletter-signup";
import { resolveMarkSrc } from "./mark-src";

/**
 * Newsletter-Anmeldung für Seiten und Footer. Erscheint nur, wenn der Newsletter im Dashboard eingeschaltet
 * UND ein Mailserver eingerichtet ist; bei jedem Fehler (z. B. DB nicht erreichbar) wird nichts gerendert.
 * Das V-Zeichen passt sich dem Untergrund an: "footer" (dunkel) nutzt die helle, "card" (hell) die dunkle Variante.
 */
export async function NewsletterBlock({ variant = "card", className }: { variant?: "footer" | "card"; className?: string }) {
  try {
    if (!(await getNewsletterEnabled()) || !(await isMailConfigured())) return null;
    const markSrc = resolveMarkSrc(variant === "footer" ? "dark" : "light");
    return <NewsletterSignup variant={variant} markSrc={markSrc} className={className} />;
  } catch {
    return null;
  }
}
