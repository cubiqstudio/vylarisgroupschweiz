import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { fiscalYearLabel } from "@/lib/verein/ledger-lib";
import type { FiscalStart } from "@/lib/verein/dates";

/** Auswahl des Geschäftsjahres als GET-Formular (funktioniert ohne JavaScript). */
export function YearPicker({ action, years, selected, fiscal, extra }: { action: string; years: number[]; selected: number; fiscal: FiscalStart; extra?: Record<string, string> }) {
  return (
    <form method="get" action={action} className="mb-6 flex flex-wrap items-end gap-2" aria-label="Geschäftsjahr wählen">
      {Object.entries(extra ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <div>
        <label htmlFor="year-pick" className="mb-1.5 block text-sm font-medium text-zinc-300">
          Geschäftsjahr
        </label>
        <Select id="year-pick" name="year" defaultValue={String(selected)} className="w-40">
          {years.map((y) => (
            <option key={y} value={y}>
              {fiscalYearLabel(y, fiscal)}
            </option>
          ))}
        </Select>
      </div>
      <Button type="submit" variant="secondary">
        Anzeigen
      </Button>
    </form>
  );
}
