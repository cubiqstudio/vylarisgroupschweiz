import { redirect } from "next/navigation";
import { Avatar } from "@/components/account/avatar";
import { AccountTabs, type AccountTab } from "@/components/account/account-tabs";
import { Container } from "@/components/ui/section";
import { getMessages } from "@/i18n/server";
import { account } from "@/i18n/account";
import { licenses } from "@/i18n/licenses";
import { getViewer } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/account");

  const m = await getMessages(account);
  const lic = await getMessages(licenses);
  const tabs: AccountTab[] = [{ href: "/account", label: m.area.tabOverview }];
  if (viewer.kind === "user") tabs.push({ href: "/account/settings", label: m.area.tabSettings });
  if (viewer.kind === "user") tabs.push({ href: "/account/licenses", label: lic.tab });
  if (viewer.isTeam) tabs.push({ href: "/account/team", label: m.area.tabTeam });
  // Ticket-Bearbeitung nur für Website-Konten im Team (Admins nutzen den Admin-Bereich); "Tickets" heißt in beiden Sprachen gleich.
  if (viewer.kind === "user" && viewer.isTeam) tabs.push({ href: "/account/team/tickets", label: "Tickets" });
  const role = viewer.kind === "admin" ? m.area.roleAdmin : viewer.isTeam ? m.area.roleTeam : m.area.roleUser;

  return (
    <>
      <div className="border-b border-zinc-800 bg-hero">
        <Container className="pt-10 sm:pt-12">
          <div className="flex items-center gap-4 sm:gap-5">
            <Avatar name={viewer.name} userId={viewer.id} hasImage={viewer.hasAvatar} size={72} />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">{role}</p>
              <h1 className="truncate text-2xl font-semibold tracking-tight text-white sm:text-3xl">{viewer.name}</h1>
              <p className="truncate text-sm text-zinc-400">{viewer.email}</p>
            </div>
          </div>
          <div className="mt-8">
            <AccountTabs tabs={tabs} />
          </div>
        </Container>
      </div>
      {children}
    </>
  );
}
