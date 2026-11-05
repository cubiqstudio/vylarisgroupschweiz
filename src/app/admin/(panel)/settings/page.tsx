import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth";
import { getLegal } from "@/lib/legal";
import { isMailConfigured } from "@/lib/mailer";
import { getLegalSettings, getMailSettingsPublic, getRegistrationEnabled } from "@/lib/settings";
import { Card } from "@/components/ui/card";
import { PageTitle } from "@/components/admin/core/page-title";
import { LegalForm } from "@/components/admin/settings/legal-form";
import { MailForm } from "@/components/admin/settings/mail-form";
import { RegistrationForm } from "@/components/admin/settings/registration-form";
import { SettingsNav } from "@/components/admin/settings/settings-nav";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Einstellungen" };

function Section({ id, title, description, children }: { id: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-6">
      <Card className="p-5 sm:p-6">
        <h2 id={`${id}-title`} className="text-base font-semibold text-white">
          {title}
        </h2>
        <p className="mt-1 mb-5 max-w-2xl text-sm text-zinc-400">{description}</p>
        {children}
      </Card>
    </section>
  );
}

export default async function AdminSettingsPage() {
  const admin = await requireAdminPage();
  const [legal, legalState, mail, registrationEnabled, mailConfigured] = await Promise.all([
    getLegalSettings(),
    getLegal(),
    getMailSettingsPublic(),
    getRegistrationEnabled(),
    isMailConfigured(),
  ]);

  return (
    <>
      <PageTitle
        title="Einstellungen"
        description="Impressum-Daten, E-Mail-Versand und Registrierung der Website. Änderungen gelten sofort."
      />
      <SettingsNav />

      <div className="grid max-w-4xl gap-6">
        <Section
          id="rechtliches"
          title="Rechtliches / Impressum"
          description="Anbieterangaben (Impressum) nach UWG sowie Angaben des Vereins. Vorbelegt mit den Angaben aus der Installation."
        >
          <LegalForm initial={legal} isComplete={legalState.isComplete} />
        </Section>

        <Section
          id="email"
          title="E-Mail (SMTP)"
          description="Über diesen Mailserver verschickt die Website Bestätigungs-E-Mails und Passwort-Reset-Links."
        >
          <MailForm initial={mail} configured={mailConfigured} adminEmail={admin.email} />
        </Section>

        <Section
          id="registrierung"
          title="Registrierung"
          description="Lege fest, ob sich Besucher ein Konto auf der Website anlegen dürfen."
        >
          <RegistrationForm enabled={registrationEnabled} mailConfigured={mailConfigured} />
        </Section>
      </div>
    </>
  );
}
