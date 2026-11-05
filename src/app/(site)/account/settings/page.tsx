import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/account/logout-button";
import { ProfileForm } from "@/components/account/profile-form";
import { PasswordForm } from "@/components/account/password-form";
import { DeleteAccount } from "@/components/account/delete-account";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/section";
import { getMessages, getSite } from "@/i18n/server";
import { account } from "@/i18n/account";
import { getViewer, requireUserPage } from "@/lib/auth";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages(account);
  return {
    title: m.meta.settings.title,
    robots: { index: false, follow: false },
  };
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card className="p-6 sm:p-8">
      <h2 className="text-lg font-semibold tracking-tight text-white">{title}</h2>
      {description && <p className="mt-1 text-sm leading-relaxed text-zinc-400">{description}</p>}
      <div className="mt-6">{children}</div>
    </Card>
  );
}

export default async function AccountSettingsPage() {
  const site = await getSite();
  const m = await getMessages(account);
  const viewer = await getViewer();
  if (viewer?.kind === "admin") redirect("/admin/account");
  const user = await requireUserPage();

  return (
    <Container className="py-10 sm:py-14">
      <div className="mx-auto max-w-2xl space-y-6">
        <Section title={m.settings.profile}>
          <ProfileForm name={user.name} email={user.email} memberSince={formatDate(user.createdAt, site.locale)} />
        </Section>
        <Section title={m.settings.passwordTitle} description={m.settings.passwordText}>
          <PasswordForm />
        </Section>
        <Section title={m.settings.logoutTitle} description={m.settings.logoutText}>
          <LogoutButton />
        </Section>
        <Section title={m.settings.deleteTitle} description={m.settings.deleteText}>
          <DeleteAccount />
        </Section>
      </div>
    </Container>
  );
}
