import { VereinTabs } from "@/components/account/verein-tabs";
import { Container } from "@/components/ui/section";
import { getCurrentMember } from "@/lib/verein/guard";

export const dynamic = "force-dynamic";

/** Gemeinsamer Rahmen des Mitgliederportals: zweite Reiterebene, sobald das Konto mit einem Mitglied verknüpft ist. */
export default async function VereinPortalLayout({ children }: { children: React.ReactNode }) {
  const member = await getCurrentMember();
  return (
    <Container className="py-10 sm:py-14">
      {member && <VereinTabs />}
      {children}
    </Container>
  );
}
