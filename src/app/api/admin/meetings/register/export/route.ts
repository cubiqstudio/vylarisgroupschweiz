import { handle, requireAdmin } from "@/lib/api";
import { csvResponse } from "@/lib/verein/csv";
import { formatDateCh, todayZurich } from "@/lib/verein/dates";
import { parseRegisterFilters, registerForExport } from "@/lib/verein/meetings-data";
import { registerCsvRows, RESOLUTION_CSV_HEADERS } from "@/lib/verein/meetings-lib";

export const dynamic = "force-dynamic";

/** Beschlussregister als CSV (Semikolon, Excel) mit den Filtern der Liste. */
export const GET = handle(async (req: Request) => {
  await requireAdmin(req);
  const rows = await registerForExport(parseRegisterFilters(new URL(req.url).searchParams));
  return csvResponse(`Beschlussregister-${formatDateCh(todayZurich()).replaceAll(".", "-")}`, RESOLUTION_CSV_HEADERS, registerCsvRows(rows));
});
