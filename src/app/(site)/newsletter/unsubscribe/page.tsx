import type { Metadata } from "next";
import {
  InvalidUnsubscribe,
  UnsubscribeForm,
} from "@/components/newsletter/unsubscribe-form";
import { NewsletterShell } from "@/components/newsletter/newsletter-shell";
import { getMessages } from "@/i18n/server";
import { newsletter } from "@/i18n/newsletter";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages(newsletter);
  return {
    title: m.unsubscribe.meta,
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}

export default async function NewsletterUnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const m = await getMessages(newsletter);
  const sp = await searchParams;
  const token =
    (Array.isArray(sp.token) ? sp.token[0] : sp.token)?.trim() ?? "";

  // Abgemeldet wird erst per Button (POST), nicht schon beim Aufruf der Seite.
  return (
    <NewsletterShell
      eyebrow={m.unsubscribe.eyebrow}
      title={m.unsubscribe.title}
    >
      {token ? <UnsubscribeForm token={token} /> : <InvalidUnsubscribe />}
    </NewsletterShell>
  );
}
