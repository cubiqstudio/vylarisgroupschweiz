import type { Metadata } from "next";
import {
  ConfirmForm,
  InvalidConfirm,
} from "@/components/newsletter/confirm-form";
import { NewsletterShell } from "@/components/newsletter/newsletter-shell";
import { getMessages } from "@/i18n/server";
import { newsletter } from "@/i18n/newsletter";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages(newsletter);
  return {
    title: m.confirm.meta,
    robots: { index: false, follow: false },
    // Das Token steht in der URL: keinen Referrer an andere Seiten weitergeben.
    referrer: "no-referrer",
  };
}

export default async function NewsletterConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const m = await getMessages(newsletter);
  const sp = await searchParams;
  const token =
    (Array.isArray(sp.token) ? sp.token[0] : sp.token)?.trim() ?? "";

  // Kein Verbrauch des Tokens beim Seitenaufruf (Mail-Scanner rufen Links per GET ab): das passiert erst per Button (POST).
  return (
    <NewsletterShell eyebrow={m.confirm.eyebrow} title={m.confirm.title}>
      {token ? <ConfirmForm token={token} /> : <InvalidConfirm />}
    </NewsletterShell>
  );
}
