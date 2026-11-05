import { formatChf } from "@/lib/verein/money";
import { niceCeiling, type MonthRow } from "@/lib/verein/ledger-lib";

const W = 720;
const H = 260;
const PAD = { top: 16, right: 12, bottom: 30, left: 56 };

const francs = (rappen: number) => formatChf(Math.round(rappen / 100) * 100).replace(/\.00$/, "");

/**
 * Monatsbilanz als schlichtes SVG: je Monat ein Balken für Einnahmen und einer für Ausgaben. Die genauen Werte stehen
 * zusätzlich in der Tabelle darunter (die Grafik ist für Screenreader mit einer Beschreibung versehen).
 */
export function MonthChart({ months, print = false }: { months: MonthRow[]; print?: boolean }) {
  const max = niceCeiling(Math.max(0, ...months.flatMap((m) => [m.incomeRappen, m.expenseRappen])));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const slot = innerW / months.length;
  const barW = Math.min(16, slot / 2 - 2);
  const y = (v: number) => PAD.top + innerH - (Math.max(0, v) / max) * innerH;
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const totalIn = months.reduce((a, m) => a + m.incomeRappen, 0);
  const totalOut = months.reduce((a, m) => a + m.expenseRappen, 0);
  const axis = print ? "text-zinc-600" : "text-zinc-500";
  const grid = print ? "stroke-zinc-300" : "stroke-zinc-800";
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Monatsbilanz: Einnahmen insgesamt CHF ${formatChf(totalIn)}, Ausgaben insgesamt CHF ${formatChf(totalOut)}. Die Werte je Monat stehen in der Tabelle.`}>
        {ticks.map((t) => {
          const v = max * t;
          return (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} className={grid} strokeWidth={1} />
              <text x={PAD.left - 6} y={y(v) + 4} textAnchor="end" className={`fill-current text-[10px] ${axis}`}>
                {francs(v)}
              </text>
            </g>
          );
        })}
        {months.map((m, i) => {
          const x0 = PAD.left + i * slot + slot / 2;
          return (
            <g key={m.key}>
              <rect x={x0 - barW - 1} y={y(m.incomeRappen)} width={barW} height={PAD.top + innerH - y(m.incomeRappen)} className="fill-emerald-500" rx={2}>
                <title>{`${m.label}: Einnahmen CHF ${formatChf(m.incomeRappen)}`}</title>
              </rect>
              <rect x={x0 + 1} y={y(m.expenseRappen)} width={barW} height={PAD.top + innerH - y(m.expenseRappen)} className="fill-rose-500" rx={2}>
                <title>{`${m.label}: Ausgaben CHF ${formatChf(m.expenseRappen)}`}</title>
              </rect>
              <text x={x0} y={H - 10} textAnchor="middle" className={`fill-current text-[11px] ${axis}`}>
                {m.label}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className={`mt-2 flex flex-wrap items-center gap-4 text-xs ${print ? "text-zinc-600" : "text-zinc-400"}`}>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" aria-hidden />
          Einnahmen
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-rose-500" aria-hidden />
          Ausgaben
        </span>
        <span>Beträge in CHF</span>
      </figcaption>
    </figure>
  );
}
