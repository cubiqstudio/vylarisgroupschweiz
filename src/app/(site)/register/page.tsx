import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/account/auth-card";
import { RegisterForm } from "@/components/account/register-form";
import { textLink } from "@/components/account/form-parts";
import { ButtonLink } from "@/components/ui/button";
import { getMessages, getSite } from "@/i18n/server";
import { account } from "@/i18n/account";
import { getViewer } from "@/lib/auth";
import { isRegistrationAvailable } from "@/lib/account";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSite();
  const m = await getMessages(account);
  return {
    title: m.meta.register.title,
    description: m.meta.register.description(site.name),
    robots: { index: false, follow: false },
    alternates: { canonical: "/register" },
  };
}

export default async function RegisterPage() {
  const viewer = await getViewer();
  if (viewer) redirect(viewer.kind === "admin" ? "/admin" : "/account");
  const m = await getMessages(account);

  if (!(await isRegistrationAvailable())) {
    return (
      <AuthCard title={m.register.closedTitle} description={m.register.closedDescription}>
        <div className="space-y-5">
          <p className="text-sm leading-relaxed text-zinc-400">{m.register.closedText}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <ButtonLink href="/login" className="sm:flex-1">
              {m.common.toLogin}
            </ButtonLink>
            <ButtonLink href="/contact" variant="secondary" className="sm:flex-1">
              {m.register.contact}
            </ButtonLink>
          </div>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={m.register.title}
      description={m.register.description}
      footer={
        <p>
          {m.register.haveAccount}{" "}
          <Link href="/login" className={textLink}>
            {m.common.signIn}
          </Link>
        </p>
      }
    >
      <RegisterForm />
    </AuthCard>
  );
}
