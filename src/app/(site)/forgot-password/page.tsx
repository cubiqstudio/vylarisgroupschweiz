import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/account/auth-card";
import { ForgotForm } from "@/components/account/forgot-form";
import { textLink } from "@/components/account/form-parts";
import { getMessages } from "@/i18n/server";
import { account } from "@/i18n/account";
import { getViewer } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages(account);
  return {
    title: m.meta.forgot.title,
    robots: { index: false, follow: false },
    alternates: { canonical: "/forgot-password" },
  };
}

export default async function ForgotPasswordPage() {
  const viewer = await getViewer();
  if (viewer) redirect(viewer.kind === "admin" ? "/admin" : "/account");
  const m = await getMessages(account);

  return (
    <AuthCard
      title={m.forgot.title}
      description={m.forgot.description}
      footer={
        <p>
          {m.forgot.remembered}{" "}
          <Link href="/login" className={textLink}>
            {m.common.toLogin}
          </Link>
        </p>
      }
    >
      <ForgotForm />
    </AuthCard>
  );
}
