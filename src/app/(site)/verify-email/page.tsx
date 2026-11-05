import type { Metadata } from "next";
import { AuthCard } from "@/components/account/auth-card";
import { VerifyForm } from "@/components/account/verify-form";
import { FormAlert } from "@/components/account/form-parts";
import { ResendVerification } from "@/components/account/resend-verification";
import { getMessages } from "@/i18n/server";
import { account } from "@/i18n/account";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages(account);
  return {
    title: m.meta.verify.title,
    robots: { index: false, follow: false },
    // Der Token steht in der URL: keinen Referrer an externe Ziele weitergeben.
    referrer: "no-referrer",
  };
}

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const sp = await searchParams;
  const m = await getMessages(account);
  const token = (Array.isArray(sp.token) ? sp.token[0] : sp.token)?.trim() ?? "";

  // Bewusst KEIN Verbrauch des Tokens beim Seitenaufruf (Mail-Scanner rufen Links ab): das passiert erst per Button (POST).
  return (
    <AuthCard title={m.verify.title}>
      {token ? (
        <VerifyForm token={token} />
      ) : (
        <div className="space-y-4">
          <FormAlert>
            <p>{m.verify.incomplete}</p>
          </FormAlert>
          <ResendVerification label={m.verify.requestNew} />
        </div>
      )}
    </AuthCard>
  );
}
