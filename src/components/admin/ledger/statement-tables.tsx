import { cn } from "@/lib/utils";
import { formatChf } from "@/lib/verein/money";
import type { AnnualStatement, MonthRow } from "@/lib/verein/ledger-lib";

type Variant = "screen" | "print";

const styles = {
  screen: {
    table: "w-full min-w-[28rem] text-left text-sm",
    head: "border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-500",
    body: "divide-y divide-zinc-800",
    foot: "border-t border-zinc-700 font-semibold text-white",
    muted: "text-zinc-500",
    h: "text-sm font-semibold text-white",
    warn: "text-amber-300",
  },
  print: {
    table: "w-full text-left text-[11px]",
    head: "border-b border-black text-[10px] uppercase tracking-wide text-zinc-600",
    body: "divide-y divide-zinc-300",
    foot: "border-t border-black font-semibold",
    muted: "text-zinc-600",
    h: "text-xs font-semibold uppercase tracking-wide",
    warn: "text-black",
  },
} as const;

const cell = "px-3 py-1.5";
const num = "px-3 py-1.5 text-right tabular-nums whitespace-nowrap";

function Wrap({ variant, label, children }: { variant: Variant; label: string; children: React.ReactNode }) {
  return variant === "screen" ? (
    <div className="overflow-x-auto" role="region" aria-label={label} tabIndex={0}>
      {children}
    </div>
  ) : (
    <div>{children}</div>
  );
}

/** Einnahmen und Ausgaben je Konto mit Summen und Ergebnis. */
export function ResultTables({ s, variant = "screen" }: { s: AnnualStatement; variant?: Variant }) {
  const c = styles[variant];
  const section = (title: string, rows: AnnualStatement["income"], total: number, totalLabel: string) => (
    <Wrap variant={variant} label={title}>
      <table className={c.table}>
        <caption className="sr-only">{title}</caption>
        <thead className={c.head}>
          <tr>
            <th scope="col" className={cn(cell, "w-24 font-medium")}>
              Konto
            </th>
            <th scope="col" className={cn(cell, "font-medium")}>
              Bezeichnung
            </th>
            <th scope="col" className={cn(num, "font-medium")}>
              CHF
            </th>
          </tr>
        </thead>
        <tbody className={c.body}>
          {rows.length === 0 && (
            <tr>
              <td colSpan={3} className={cn(cell, c.muted)}>
                Keine Konten.
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.account.id}>
              <td className={cn(cell, c.muted)}>{r.account.number}</td>
              <td className={cell}>
                {r.account.name}
                {!r.account.active && <span className={cn("ml-2 text-xs", c.muted)}>(inaktiv)</span>}
              </td>
              <td className={num}>{formatChf(r.amountRappen)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className={c.foot}>
          <tr>
            <th scope="row" colSpan={2} className={cn(cell, "text-left")}>
              {totalLabel}
            </th>
            <td className={num}>{formatChf(total)}</td>
          </tr>
        </tfoot>
      </table>
    </Wrap>
  );
  return (
    <div className={variant === "screen" ? "grid grid-cols-1 gap-6 lg:grid-cols-2" : "grid grid-cols-2 gap-6"}>
      <div className="min-w-0">
        <h3 className={cn("mb-2", c.h)}>Einnahmen</h3>
        {section("Einnahmen nach Konto", s.income, s.totalIncomeRappen, "Total Einnahmen")}
      </div>
      <div className="min-w-0">
        <h3 className={cn("mb-2", c.h)}>Ausgaben</h3>
        {section("Ausgaben nach Konto", s.expense, s.totalExpenseRappen, "Total Ausgaben")}
      </div>
    </div>
  );
}

/** Vermögensübersicht: Bestand je Vermögenskonto am Anfang und am Ende des Geschäftsjahres. */
export function AssetTable({ s, variant = "screen" }: { s: AnnualStatement; variant?: Variant }) {
  const c = styles[variant];
  return (
    <Wrap variant={variant} label="Vermögensübersicht">
      <table className={c.table}>
        <caption className="sr-only">Vermögensübersicht: Bestand am Anfang, Veränderung und Bestand am Ende</caption>
        <thead className={c.head}>
          <tr>
            <th scope="col" className={cn(cell, "w-24 font-medium")}>
              Konto
            </th>
            <th scope="col" className={cn(cell, "font-medium")}>
              Bezeichnung
            </th>
            <th scope="col" className={cn(num, "font-medium")}>
              Anfang CHF
            </th>
            <th scope="col" className={cn(num, "font-medium")}>
              Veränderung CHF
            </th>
            <th scope="col" className={cn(num, "font-medium")}>
              Ende CHF
            </th>
          </tr>
        </thead>
        <tbody className={c.body}>
          {s.assets.length === 0 && (
            <tr>
              <td colSpan={5} className={cn(cell, c.muted)}>
                Keine Vermögenskonten (Bank, Kasse) angelegt.
              </td>
            </tr>
          )}
          {s.assets.map((r) => (
            <tr key={r.account.id}>
              <td className={cn(cell, c.muted)}>{r.account.number}</td>
              <td className={cell}>
                {r.account.name}
                {!r.account.active && <span className={cn("ml-2 text-xs", c.muted)}>(inaktiv)</span>}
              </td>
              <td className={num}>{formatChf(r.startRappen)}</td>
              <td className={num}>{formatChf(r.changeRappen)}</td>
              <td className={num}>{formatChf(r.endRappen)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className={c.foot}>
          <tr>
            <th scope="row" colSpan={2} className={cn(cell, "text-left")}>
              Total Vermögen
            </th>
            <td className={num}>{formatChf(s.assetStartRappen)}</td>
            <td className={num}>{formatChf(s.assetChangeRappen)}</td>
            <td className={num}>{formatChf(s.assetEndRappen)}</td>
          </tr>
        </tfoot>
      </table>
    </Wrap>
  );
}

/** Ergebniszeile: Ertrags- bzw. Aufwandüberschuss. */
export function ResultLine({ s, variant = "screen" }: { s: AnnualStatement; variant?: Variant }) {
  const c = styles[variant];
  const surplus = s.resultRappen >= 0;
  return (
    <div className={cn("flex flex-wrap items-baseline justify-between gap-2 rounded-xl px-4 py-3", variant === "screen" ? "border border-zinc-800 bg-surface" : "border border-black")}>
      <span className={variant === "screen" ? "font-medium text-white" : "font-semibold"}>{surplus ? "Ertragsüberschuss (Gewinn)" : "Aufwandüberschuss (Verlust)"}</span>
      <span className={cn("text-lg font-semibold tabular-nums", variant === "screen" && (surplus ? "text-emerald-400" : "text-rose-400"))}>CHF {formatChf(s.resultRappen)}</span>
      {s.unallocatedRappen !== 0 && (
        <p className={cn("w-full text-xs", c.warn)}>
          Hinweis: CHF {formatChf(s.unallocatedRappen)} des Ergebnisses stecken in Buchungen ohne Vermögenskonto. Vermögen und Ergebnis stimmen deshalb nicht überein.
        </p>
      )}
    </div>
  );
}

/** Monatsbilanz als Tabelle (ergänzt die Grafik). */
export function MonthTable({ months, variant = "screen" }: { months: MonthRow[]; variant?: Variant }) {
  const c = styles[variant];
  return (
    <Wrap variant={variant} label="Monatsbilanz">
      <table className={c.table}>
        <caption className="sr-only">Monatsbilanz mit Einnahmen, Ausgaben, Ergebnis und Vermögen am Monatsende</caption>
        <thead className={c.head}>
          <tr>
            <th scope="col" className={cn(cell, "font-medium")}>
              Monat
            </th>
            <th scope="col" className={cn(num, "font-medium")}>
              Einnahmen
            </th>
            <th scope="col" className={cn(num, "font-medium")}>
              Ausgaben
            </th>
            <th scope="col" className={cn(num, "font-medium")}>
              Ergebnis
            </th>
            <th scope="col" className={cn(num, "font-medium")}>
              Vermögen Ende
            </th>
          </tr>
        </thead>
        <tbody className={c.body}>
          {months.map((m) => (
            <tr key={m.key}>
              <th scope="row" className={cn(cell, "text-left font-normal")}>
                {m.label} {m.calendarYear}
              </th>
              <td className={num}>{formatChf(m.incomeRappen)}</td>
              <td className={num}>{formatChf(m.expenseRappen)}</td>
              <td className={num}>{formatChf(m.resultRappen)}</td>
              <td className={num}>{formatChf(m.assetsEndRappen)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Wrap>
  );
}

export const ACCOUNTING_NOTE =
  "Diese Kassa bildet eine einfache Buchhaltung ab: Einnahmen, Ausgaben und Vermögenslage (Art. 69a ZGB). Vereine, die im Handelsregister eingetragen sind oder bestimmte Grössen überschreiten, können weitergehenden Pflichten nach Art. 957 ff. OR unterliegen. Es gelten die Statuten; im Zweifel klärt der Verein dies mit seiner Revisionsstelle oder einer Treuhandstelle.";
