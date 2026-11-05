import "server-only";
import { getLegalSettings } from "@/lib/settings";
import { site } from "@/lib/site";

/** Rechtliche Pflichtangaben: Admin-Einstellungen, sonst Umgebungsvariablen. Fällt bei DB-Fehlern auf Env zurück. */
export async function getLegal() {
  let l;
  try {
    l = await getLegalSettings();
  } catch {
    const e = (k: string) => process.env[k]?.trim() || "";
    l = {
      responsible: "Lucas Wilms",
      street: e("LEGAL_STREET"),
      zipCity: e("LEGAL_ZIP_CITY"),
      country: e("LEGAL_COUNTRY") || "Deutschland",
      phone: e("LEGAL_PHONE"),
      register: e("LEGAL_REGISTER"),
      vatId: e("LEGAL_VAT_ID"),
      email: e("CONTACT_EMAIL"),
      smallBusiness: false,
      noRegister: false,
      hideRegister: false,
      hideVat: false,
    };
  }
  return {
    responsible: l.responsible || site.leader.name,
    street: l.street || undefined,
    zipCity: l.zipCity || undefined,
    country: l.country || "Deutschland",
    phone: l.phone || undefined,
    register: l.register || undefined,
    vatId: l.vatId || undefined,
    email: l.email || undefined,
    /** Kleinunternehmer (§ 19 UStG): keine USt-IdNr. im Impressum */
    smallBusiness: l.smallBusiness,
    /** Kein Handelsregister-/Registereintrag */
    noRegister: l.noRegister,
    /** Zeilen im Impressum ausblenden (kein Hinweis, kein "Angabe ergänzen") */
    hideRegister: l.hideRegister,
    hideVat: l.hideVat,
    isComplete: Boolean(l.street && l.zipCity && l.email),
  };
}
