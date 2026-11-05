import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/account/auth-card";
import { LoginForm } from "@/components/account/login-form";
import { textLink } from "@/components/account/form-parts";
import { getMessages, getSite } from "@/i18n/server";
import { account } from "@/i18n/account";
import { getViewer } from "@/lib/auth";
import { isRegistrationAvailable, safeNextPath } from "@/lib/account";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSite();
  const m = await getMessages(account);
  return {
    title: m.meta.login.title,
    description: m.meta.login.description(site.name),
    robots: { index: false, follow: false },
    alternates: { canonical: "/login" },
  };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const sp = await searchParams;
  const rawNext = Array.isArray(sp.next) ? sp.next[0] : sp.next;
  const nextForAdmin = safeNextPath(rawNext, { allowAdmin: true });
  const nextForUser = safeNextPath(rawNext);

  const viewer = await getViewer();
  if (viewer) {
    redirect((viewer.kind === "admin" ? nextForAdmin : nextForUser) ?? (viewer.kind === "admin" ? "/admin" : "/account"));
  }

  const canRegister = await isRegistrationAvailable();
  const m = await getMessages(account);

  return (
    <AuthCard
      title={m.meta.login.title}
      description={m.login.description}
      footer={
        canRegister ? (
          <p>
            {m.login.noAccount}{" "}
            <Link href="/register" className={textLink}>
              {m.login.createAccount}
            </Link>
          </p>
        ) : undefined
      }
    >
      <LoginForm nextForUser={nextForUser} nextForAdmin={nextForAdmin} />
    </AuthCard>
  );
}
