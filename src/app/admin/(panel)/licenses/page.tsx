import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { PageTitle } from "@/components/admin/core/page-title";
import { ClientsTab } from "@/components/admin/licenses/clients-tab";
import { KeysTab } from "@/components/admin/licenses/keys-tab";
import { ProductsTab } from "@/components/admin/licenses/products-tab";
import { WebspaceTab } from "@/components/admin/licenses/webspace-tab";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Lizenzen" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const TABS = [
  { id: "keys", label: "Schlüssel" },
  { id: "webspace", label: "Webspace-Anträge" },
  { id: "products", label: "Produkte" },
  { id: "clients", label: "API-Zugänge" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default async function AdminLicensesPage({ searchParams }: Props) {
  await requireAdminPage();
  const sp = await searchParams;
  const raw = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab;
  const tab: TabId = TABS.some((t) => t.id === raw) ? (raw as TabId) : "keys";

  const [pendingKeys, pendingWebspace] = await Promise.all([
    db.licenseKey.count({ where: { status: "PENDING" } }),
    db.webspaceRequest.count({ where: { status: "PENDING" } }),
  ]);
  const counts: Partial<Record<TabId, number>> = { keys: pendingKeys, webspace: pendingWebspace };

  return (
    <div>
      <PageTitle
        title="Lizenzen"
        description="Lizenzschlüssel und Webspace-Anträge freigeben, Produkte pflegen und API-Zugänge für die Schlüsselprüfung verwalten. Firmenkunden gibst du unter Benutzer frei."
      />

      <nav aria-label="Lizenz-Bereiche" className="mb-6 flex gap-1 overflow-x-auto border-b border-zinc-800">
        {TABS.map((t) => {
          const active = t.id === tab;
          const count = counts[t.id] ?? 0;
          return (
            <Link
              key={t.id}
              href={`/admin/licenses?tab=${t.id}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                active ? "border-emerald-400 text-white" : "border-transparent text-zinc-400 hover:text-zinc-100",
              )}
            >
              {t.label}
              {count > 0 && (
                <span
                  className="min-w-5 rounded-full bg-amber-400 px-1.5 text-center text-xs font-semibold leading-5 text-zinc-950"
                  aria-label={`${count} wartend`}
                >
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {tab === "keys" && <KeysTab searchParams={sp} />}
      {tab === "webspace" && <WebspaceTab searchParams={sp} />}
      {tab === "products" && <ProductsTab />}
      {tab === "clients" && <ClientsTab />}
    </div>
  );
}
