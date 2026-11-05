import type { Metadata } from "next";
import { AuthCard } from "@/components/account/auth-card";
import { ResetForm } from "@/components/account/reset-form";
import { FormAlert } from "@/components/account/form-parts";
import { ButtonLink } from "@/components/ui/button";
import { getMessages } from "@/i18n/server";
import { account } from "@/i18n/account";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages(account);
  return {
    title: m.meta.reset.title,
    robots: { index: false, follow: false },
    // Der Token steht in der URL: keinen Referrer an externe Ziele weitergeben.
    referrer: "no-referrer",
  };
}

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const sp = await searchParams;
  const m = await getMessages(account);
  const token = (Array.isArray(sp.token) ? sp.token[0] : sp.token)?.trim() ?? "";

  return (
    <AuthCard title={m.reset.title} description={token ? m.reset.description : undefined}>
      {token ? (
        <ResetForm token={token} />
      ) : (
        <div className="space-y-4">
          <FormAlert>
            <p>{m.reset.incomplete}</p>
          </FormAlert>
          <ButtonLink href="/forgot-password" size="lg" className="w-full">
            {m.reset.requestNew}
          </ButtonLink>
        </div>
      )}
    </AuthCard>
  );
}
