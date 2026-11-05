import { handle, requireAdmin } from "@/lib/api";
import { createStandardAccounts } from "@/lib/verein/ledger-data";
import { adminOk } from "../../../../_lib/http";

export const dynamic = "force-dynamic";

/** Legt die Vorlage für kleine Vereine an (nur Struktur, keine Beträge). Bereits vorhandene Konten bleiben unberührt. */
export const POST = handle(async (req: Request) => {
  const admin = await requireAdmin(req);
  return adminOk(await createStandardAccounts(admin), 201);
});
