// Fachlogik der Kassa (rein, ohne Seiteneffekte, ohne Datenbank): Salden, Jahresrechnung, Monatsbilanz, Budgetvergleich,
// Buchungsregeln, Abschlussregeln und die Vorlage für den Kontenplan.
//
// Einfache Buchhaltung (Einnahmen-/Ausgabenrechnung mit Vermögensübersicht):
//  - Jede Buchung hat einen positiven Betrag. Die Richtung steht in `direction`:
//      EINNAHME  : Kategorie = Einnahmenkonto (Ertrag steigt), Gegenkonto = Vermögenskonto (Bestand steigt)
//      AUSGABE   : Kategorie = Ausgabenkonto (Aufwand steigt), Gegenkonto = Vermögenskonto (Bestand sinkt)
//      UMBUCHUNG : Kategorie = Vermögenskonto (Quelle, Bestand sinkt), Gegenkonto = Vermögenskonto (Ziel, Bestand steigt)
//  - Eine Gegenbuchung (Storno) übernimmt Richtung und Konten der Originalbuchung, hebt aber jede Wirkung auf (Vorzeichen -1).
//  - Das Ergebnis eines Geschäftsjahres ist Einnahmen minus Ausgaben und entspricht der Veränderung der Vermögenskonten, solange jede
//    Einnahme und Ausgabe ein Vermögenskonto trägt.
import { canAccess } from "./permissions";
import { fiscalYearRange, formatDateCh, zurichParts, type FiscalStart } from "./dates";

// ---- Typen -------------------------------------------------------------------------------------------------------------

export type LedgerAccount = {
  id: string;
  kind: string;
  number: string;
  name: string;
  openingBalanceRappen: number;
  active: boolean;
  sortOrder: number;
};

/** Eine Buchung in der Form, die die Rechnung braucht. `reversal` = Gegenbuchung (hebt eine andere Buchung auf). */
export type LedgerEntry = {
  fiscalYear: number;
  direction: string;
  amountRappen: number;
  categoryId: string;
  counterAccountId: string | null;
  reversal: boolean;
};
export type LedgerDatedEntry = LedgerEntry & { bookingDate: Date };

const byOrder = (a: LedgerAccount, b: LedgerAccount) => a.sortOrder - b.sortOrder || a.number.localeCompare(b.number, "de", { numeric: true });

// ---- Wirkung einer Buchung ----------------------------------------------------------------------------------------------

/** +1 für eine Buchung, -1 für eine Gegenbuchung. */
export const entrySign = (e: Pick<LedgerEntry, "reversal">): 1 | -1 => (e.reversal ? -1 : 1);

/**
 * Wirkung auf die Konten. Einnahmen- und Ausgabenkonten zählen den Ertrag bzw. Aufwand (positiv), Vermögenskonten die Veränderung
 * des Bestands.
 */
export function entryDeltas(e: LedgerEntry): Array<{ accountId: string; delta: number }> {
  const a = e.amountRappen * entrySign(e);
  const out: Array<{ accountId: string; delta: number }> = [];
  switch (e.direction) {
    case "EINNAHME":
      out.push({ accountId: e.categoryId, delta: a });
      if (e.counterAccountId) out.push({ accountId: e.counterAccountId, delta: a });
      break;
    case "AUSGABE":
      out.push({ accountId: e.categoryId, delta: a });
      if (e.counterAccountId) out.push({ accountId: e.counterAccountId, delta: -a });
      break;
    case "UMBUCHUNG":
      out.push({ accountId: e.categoryId, delta: -a });
      if (e.counterAccountId) out.push({ accountId: e.counterAccountId, delta: a });
      break;
    default:
      break;
  }
  return out;
}

/** Einfluss auf die Kasse in der Liste: Einnahme +, Ausgabe -, Umbuchung 0 (Gegenbuchung kehrt um). */
export function cashEffect(e: Pick<LedgerEntry, "direction" | "amountRappen" | "reversal">): number {
  const a = e.amountRappen * entrySign(e);
  return e.direction === "EINNAHME" ? a : e.direction === "AUSGABE" ? -a : 0;
}

/** Summe der Wirkungen je Konto. */
export function accountFlows(entries: readonly LedgerEntry[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const e of entries) for (const d of entryDeltas(e)) map.set(d.accountId, (map.get(d.accountId) ?? 0) + d.delta);
  return map;
}

// ---- Jahresrechnung -------------------------------------------------------------------------------------------------------

export type StatementRow = { account: LedgerAccount; amountRappen: number };
export type AssetRow = { account: LedgerAccount; startRappen: number; changeRappen: number; endRappen: number };

export type AnnualStatement = {
  year: number;
  income: StatementRow[];
  expense: StatementRow[];
  assets: AssetRow[];
  totalIncomeRappen: number;
  totalExpenseRappen: number;
  /** Einnahmen minus Ausgaben */
  resultRappen: number;
  assetStartRappen: number;
  assetChangeRappen: number;
  assetEndRappen: number;
  /** Ergebnis, das in keinem Vermögenskonto steckt (Einnahmen/Ausgaben ohne Gegenkonto). 0 = Rechnung geht auf. */
  unallocatedRappen: number;
};

const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

/**
 * Jahresrechnung für ein Geschäftsjahr. `entries` müssen alle Buchungen bis und mit `year` enthalten (frühere Jahre bestimmen den
 * Anfangsbestand; spätere Jahre werden ignoriert). Der Anfangsbestand eines Vermögenskontos ist sein Eröffnungsbestand plus alle
 * Veränderungen früherer Geschäftsjahre.
 */
export function buildAnnualStatement(accounts: readonly LedgerAccount[], entries: readonly LedgerEntry[], year: number): AnnualStatement {
  const before = accountFlows(entries.filter((e) => e.fiscalYear < year));
  const within = accountFlows(entries.filter((e) => e.fiscalYear === year));
  const sorted = [...accounts].sort(byOrder);

  const flowRows = (kind: string): StatementRow[] =>
    sorted
      .filter((a) => a.kind === kind)
      .map((account) => ({ account, amountRappen: within.get(account.id) ?? 0 }))
      .filter((r) => r.account.active || r.amountRappen !== 0);

  const income = flowRows("EINNAHMEN");
  const expense = flowRows("AUSGABEN");
  const assets: AssetRow[] = sorted
    .filter((a) => a.kind === "VERMOEGEN")
    .map((account) => {
      const startRappen = account.openingBalanceRappen + (before.get(account.id) ?? 0);
      const changeRappen = within.get(account.id) ?? 0;
      return { account, startRappen, changeRappen, endRappen: startRappen + changeRappen };
    })
    .filter((r) => r.account.active || r.startRappen !== 0 || r.changeRappen !== 0 || r.endRappen !== 0);

  const totalIncomeRappen = sum(income.map((r) => r.amountRappen));
  const totalExpenseRappen = sum(expense.map((r) => r.amountRappen));
  const resultRappen = totalIncomeRappen - totalExpenseRappen;
  const assetStartRappen = sum(assets.map((r) => r.startRappen));
  const assetChangeRappen = sum(assets.map((r) => r.changeRappen));
  return {
    year,
    income,
    expense,
    assets,
    totalIncomeRappen,
    totalExpenseRappen,
    resultRappen,
    assetStartRappen,
    assetChangeRappen,
    assetEndRappen: assetStartRappen + assetChangeRappen,
    unallocatedRappen: resultRappen - assetChangeRappen,
  };
}

// ---- Monatsbilanz -----------------------------------------------------------------------------------------------------------

export const MONTH_SHORT = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"] as const;
export const MONTH_LONG = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"] as const;

export type FiscalMonth = { index: number; key: string; calendarYear: number; month: number; label: string };

/** Die zwölf Monate des Geschäftsjahrs (Beginn gemäss Einstellung; das Jahr benennt den Beginn). */
export function fiscalMonths(year: number, start: FiscalStart): FiscalMonth[] {
  return Array.from({ length: 12 }, (_, index) => {
    const m0 = start.month - 1 + index;
    const calendarYear = year + Math.floor(m0 / 12);
    const month = (m0 % 12) + 1;
    return { index, key: `${calendarYear}-${String(month).padStart(2, "0")}`, calendarYear, month, label: MONTH_SHORT[month - 1]! };
  });
}

/**
 * Monatsnummer (0 bis 11) des Datums im Geschäftsjahr oder null, wenn es nicht hineinfällt. Ein «Monat» des Geschäftsjahres beginnt am
 * Beginntag (Beginn 15.7.: Monat 0 = 15.7. bis 14.8.), damit jede Buchung des Jahres genau einem Monat zugerechnet wird.
 */
export function monthIndexOf(date: Date, year: number, start: FiscalStart): number | null {
  const p = zurichParts(date);
  const idx = (p.year - year) * 12 + (p.month - start.month) - (p.day < start.day ? 1 : 0);
  return idx >= 0 && idx < 12 ? idx : null;
}

export type MonthRow = FiscalMonth & {
  incomeRappen: number;
  expenseRappen: number;
  resultRappen: number;
  /** Gesamtbestand aller Vermögenskonten am Monatsende */
  assetsEndRappen: number;
};

/**
 * Monatsbilanz eines Geschäftsjahres. `entries` enthält die Buchungen dieses Jahres (andere Jahre werden ignoriert).
 * `assetStartRappen` ist der Gesamtbestand der Vermögenskonten zu Jahresbeginn (aus der Jahresrechnung).
 */
export function monthlySeries(accounts: readonly LedgerAccount[], entries: readonly LedgerDatedEntry[], year: number, start: FiscalStart, assetStartRappen: number): MonthRow[] {
  const assetIds = new Set(accounts.filter((a) => a.kind === "VERMOEGEN").map((a) => a.id));
  const months = fiscalMonths(year, start);
  const rows: MonthRow[] = months.map((m) => ({ ...m, incomeRappen: 0, expenseRappen: 0, resultRappen: 0, assetsEndRappen: 0 }));
  const assetChange = new Array<number>(12).fill(0);
  for (const e of entries) {
    if (e.fiscalYear !== year) continue;
    const idx = monthIndexOf(e.bookingDate, year, start);
    if (idx === null) continue;
    const a = e.amountRappen * entrySign(e);
    const row = rows[idx]!;
    if (e.direction === "EINNAHME") row.incomeRappen += a;
    else if (e.direction === "AUSGABE") row.expenseRappen += a;
    for (const d of entryDeltas(e)) if (assetIds.has(d.accountId)) assetChange[idx] = (assetChange[idx] ?? 0) + d.delta;
  }
  let running = assetStartRappen;
  for (const row of rows) {
    row.resultRappen = row.incomeRappen - row.expenseRappen;
    running += assetChange[row.index] ?? 0;
    row.assetsEndRappen = running;
  }
  return rows;
}

// ---- Budget -----------------------------------------------------------------------------------------------------------------

export type BudgetLevel = "none" | "ok" | "warn" | "over";
export type BudgetRow = {
  account: LedgerAccount;
  /** null = kein Budget festgelegt */
  budgetRappen: number | null;
  actualRappen: number;
  /** Ausgaben: noch verfügbar (budget minus ist, negativ = überschritten). Einnahmen: ist minus Soll. */
  diffRappen: number | null;
  /** Ist in Prozent des Budgets (ganze Zahl) oder null ohne Budget */
  percent: number | null;
  level: BudgetLevel;
};

export type BudgetComparison = {
  year: number;
  income: BudgetRow[];
  expense: BudgetRow[];
  budgetIncomeRappen: number;
  budgetExpenseRappen: number;
  budgetResultRappen: number;
  actualIncomeRappen: number;
  actualExpenseRappen: number;
  actualResultRappen: number;
};

/** Warnschwelle: ab diesem Anteil des Ausgabenbudgets gilt eine Position als fast aufgebraucht. */
export const BUDGET_WARN_PERCENT = 90;

export function budgetLevel(kind: "EINNAHMEN" | "AUSGABEN", budgetRappen: number | null, actualRappen: number): BudgetLevel {
  if (budgetRappen === null) return "none";
  if (kind === "AUSGABEN") {
    if (actualRappen > budgetRappen) return "over";
    if (budgetRappen > 0 && (actualRappen * 100) / budgetRappen >= BUDGET_WARN_PERCENT) return "warn";
    return "ok";
  }
  return actualRappen >= budgetRappen ? "ok" : "warn";
}

/** Soll/Ist-Vergleich je Konto für ein Geschäftsjahr. `budgets` = Budgetzeilen des Jahres (categoryId → Betrag). */
export function budgetComparison(accounts: readonly LedgerAccount[], budgets: ReadonlyMap<string, number>, entries: readonly LedgerEntry[], year: number): BudgetComparison {
  const within = accountFlows(entries.filter((e) => e.fiscalYear === year));
  const sorted = [...accounts].sort(byOrder);
  const build = (kind: "EINNAHMEN" | "AUSGABEN"): BudgetRow[] =>
    sorted
      .filter((a) => a.kind === kind)
      .map((account) => {
        const budgetRappen = budgets.has(account.id) ? budgets.get(account.id)! : null;
        const actualRappen = within.get(account.id) ?? 0;
        const diffRappen = budgetRappen === null ? null : kind === "AUSGABEN" ? budgetRappen - actualRappen : actualRappen - budgetRappen;
        const percent = budgetRappen === null || budgetRappen === 0 ? null : Math.round((actualRappen * 100) / budgetRappen);
        return { account, budgetRappen, actualRappen, diffRappen, percent, level: budgetLevel(kind, budgetRappen, actualRappen) };
      })
      .filter((r) => r.account.active || r.budgetRappen !== null || r.actualRappen !== 0);
  const income = build("EINNAHMEN");
  const expense = build("AUSGABEN");
  const budgetIncomeRappen = sum(income.map((r) => r.budgetRappen ?? 0));
  const budgetExpenseRappen = sum(expense.map((r) => r.budgetRappen ?? 0));
  const actualIncomeRappen = sum(income.map((r) => r.actualRappen));
  const actualExpenseRappen = sum(expense.map((r) => r.actualRappen));
  return {
    year,
    income,
    expense,
    budgetIncomeRappen,
    budgetExpenseRappen,
    budgetResultRappen: budgetIncomeRappen - budgetExpenseRappen,
    actualIncomeRappen,
    actualExpenseRappen,
    actualResultRappen: actualIncomeRappen - actualExpenseRappen,
  };
}

// ---- Buchungsregeln ---------------------------------------------------------------------------------------------------------

export type AccountRef = { id: string; kind: string; active: boolean; name: string };
export type BookingProblem = { field: "categoryId" | "counterAccountId"; message: string };

/**
 * Passen die gewählten Konten zur Richtung? Neue oder geänderte Konten müssen aktiv sein (`checkActive`);
 * bleibt ein Konto bei einer Änderung unverändert, darf es inzwischen inaktiv sein.
 */
export function validateBookingAccounts(
  direction: string,
  category: AccountRef | null,
  counter: AccountRef | null,
  opts: { checkActive?: { category: boolean; counter: boolean } } = {},
): BookingProblem | null {
  const check = opts.checkActive ?? { category: true, counter: true };
  if (!category) return { field: "categoryId", message: "Bitte ein Konto wählen." };
  if (direction === "EINNAHME") {
    if (category.kind !== "EINNAHMEN") return { field: "categoryId", message: "Für eine Einnahme ist ein Einnahmenkonto nötig." };
  } else if (direction === "AUSGABE") {
    if (category.kind !== "AUSGABEN") return { field: "categoryId", message: "Für eine Ausgabe ist ein Ausgabenkonto nötig." };
  } else if (direction === "UMBUCHUNG") {
    if (category.kind !== "VERMOEGEN") return { field: "categoryId", message: "Eine Umbuchung geht von einem Vermögenskonto (Bank, Kasse) aus." };
  } else {
    return { field: "categoryId", message: "Unbekannte Buchungsart." };
  }
  if (!counter) {
    return {
      field: "counterAccountId",
      message: direction === "EINNAHME" ? "Bitte wählen, wohin das Geld gegangen ist (Bank, Kasse)." : direction === "AUSGABE" ? "Bitte wählen, von wo bezahlt wurde (Bank, Kasse)." : "Bitte das Zielkonto wählen.",
    };
  }
  if (counter.kind !== "VERMOEGEN") return { field: "counterAccountId", message: "Das Gegenkonto muss ein Vermögenskonto (Bank, Kasse) sein." };
  if (direction === "UMBUCHUNG" && counter.id === category.id) return { field: "counterAccountId", message: "Quelle und Ziel müssen verschieden sein." };
  if (check.category && !category.active) return { field: "categoryId", message: `Das Konto «${category.name}» ist nicht mehr aktiv.` };
  if (check.counter && !counter.active) return { field: "counterAccountId", message: `Das Konto «${counter.name}» ist nicht mehr aktiv.` };
  return null;
}

export type TransactionFacts = {
  source: string;
  /** Es existiert eine Gegenbuchung zu dieser Buchung. */
  reversed: boolean;
  /** Diese Buchung ist selbst eine Gegenbuchung. */
  isReversal: boolean;
  /** Das Geschäftsjahr der Buchung ist abgeschlossen. */
  locked: boolean;
};

export type TransactionState = "AKTIV" | "STORNIERT" | "STORNO";
export const TRANSACTION_STATE_LABEL: Record<TransactionState, string> = { AKTIV: "Gültig", STORNIERT: "Storniert", STORNO: "Gegenbuchung" };

export function transactionState(f: Pick<TransactionFacts, "reversed" | "isReversal">): TransactionState {
  return f.isReversal ? "STORNO" : f.reversed ? "STORNIERT" : "AKTIV";
}

/** Grund, warum eine Buchung nicht bearbeitet werden darf, oder null. */
export function editBlockReason(f: TransactionFacts): string | null {
  if (f.locked) return "Das Geschäftsjahr ist abgeschlossen. Korrigiere mit einer Gegenbuchung.";
  if (f.isReversal) return "Gegenbuchungen können nicht geändert werden.";
  if (f.reversed) return "Die Buchung wurde storniert und kann nicht mehr geändert werden.";
  if (f.source === "ZAHLUNG") return "Diese Buchung stammt aus einem Zahlungseingang unter «Beiträge». Korrigiere dort oder storniere die Buchung.";
  return null;
}

/** Grund, warum eine Buchung nicht storniert werden darf, oder null. (Abgeschlossene Jahre: die Gegenbuchung kommt ins offene Jahr.) */
export function reverseBlockReason(f: Pick<TransactionFacts, "reversed" | "isReversal">): string | null {
  if (f.isReversal) return "Eine Gegenbuchung kann nicht nochmals storniert werden. Erfasse bei Bedarf eine neue Buchung.";
  if (f.reversed) return "Die Buchung wurde bereits storniert.";
  return null;
}

/** Belege dürfen auch nach dem Abschluss ergänzt, aber nur im offenen Jahr entfernt werden. */
export function receiptRemoveBlockReason(locked: boolean): string | null {
  return locked ? "Das Geschäftsjahr ist abgeschlossen. Belege können nicht mehr entfernt werden." : null;
}

export const MAX_RECEIPTS_PER_TRANSACTION = 10;

/** Text der Gegenbuchung. */
export function reversalText(original: { voucherNo: string; text: string }, reason: string): string {
  const head = `Storno ${original.voucherNo || "Buchung"}`;
  const body = `${head}: ${original.text}`;
  const text = reason.trim() ? `${body} (${reason.trim()})` : body;
  return text.length > 200 ? `${text.slice(0, 199)}…` : text;
}

// ---- Rechte -----------------------------------------------------------------------------------------------------------------

export const canWriteLedger = (roles: readonly string[]): boolean => canAccess(roles, "ledger", "write");

/**
 * Geschäftsjahr abschliessen, wieder öffnen oder genehmigen: Kassier (Schreibrecht in der Kassa) und Präsident sowie Inhaber und
 * Administration. Revisor, Vize-Präsident und übrige Rollen nur lesen.
 */
export function canCloseFiscalYear(roles: readonly string[]): boolean {
  return canWriteLedger(roles) || roles.includes("PRAESIDENT");
}

// ---- Abschluss ---------------------------------------------------------------------------------------------------------------

/** Gründe, ein Geschäftsjahr nicht abzuschliessen (null = möglich). */
export function lockBlockReason(i: { year: number; fiscal: FiscalStart; today: Date; alreadyLocked: boolean; earlierOpenYears: readonly number[] }): string | null {
  if (i.alreadyLocked) return `Das Geschäftsjahr ${i.year} ist bereits abgeschlossen.`;
  const end = fiscalYearRange(i.year, i.fiscal).end;
  if (i.today.getTime() <= end.getTime()) return `Das Geschäftsjahr ${i.year} läuft noch bis ${formatDateCh(end)} und kann erst danach abgeschlossen werden.`;
  const earlier = [...i.earlierOpenYears].sort((a, b) => a - b);
  if (earlier.length > 0) return `Schliesse zuerst das ${earlier.length === 1 ? "Geschäftsjahr" : "die Geschäftsjahre"} ${earlier.join(", ")} ab: Ihr Endbestand ist der Anfangsbestand von ${i.year}.`;
  return null;
}

/** Gründe, ein abgeschlossenes Geschäftsjahr nicht wieder zu öffnen (null = möglich). */
export function unlockBlockReason(i: { year: number; locked: boolean; laterLockedYears: readonly number[] }): string | null {
  if (!i.locked) return `Das Geschäftsjahr ${i.year} ist nicht abgeschlossen.`;
  const later = [...i.laterLockedYears].sort((a, b) => a - b);
  if (later.length > 0) return `Öffne zuerst das ${later.length === 1 ? "Geschäftsjahr" : "die Geschäftsjahre"} ${later.join(", ")} wieder: Sie bauen auf dem Endbestand von ${i.year} auf.`;
  return null;
}

// ---- Vorlage Kontenplan ----------------------------------------------------------------------------------------------------

export type AccountTemplateItem = { kind: "EINNAHMEN" | "AUSGABEN" | "VERMOEGEN"; name: string };

/** Nur Struktur, keine Beträge und keine festen Kontonummern. Der Verein passt alles an. */
export const STANDARD_ACCOUNT_TEMPLATE: readonly AccountTemplateItem[] = [
  { kind: "EINNAHMEN", name: "Mitgliederbeiträge" },
  { kind: "EINNAHMEN", name: "Spenden" },
  { kind: "EINNAHMEN", name: "Anlässe" },
  { kind: "EINNAHMEN", name: "Sponsoring" },
  { kind: "EINNAHMEN", name: "Sonstige Einnahmen" },
  { kind: "AUSGABEN", name: "Hosting und Server" },
  { kind: "AUSGABEN", name: "Software und Lizenzen" },
  { kind: "AUSGABEN", name: "Anlässe" },
  { kind: "AUSGABEN", name: "Verwaltung" },
  { kind: "AUSGABEN", name: "Versicherungen" },
  { kind: "AUSGABEN", name: "Bankspesen" },
  { kind: "AUSGABEN", name: "Sonstige Ausgaben" },
  { kind: "VERMOEGEN", name: "Bankkonto" },
  { kind: "VERMOEGEN", name: "Kasse" },
];

const NUMBER_PREFIX: Record<AccountTemplateItem["kind"], string> = { EINNAHMEN: "E", AUSGABEN: "A", VERMOEGEN: "V" };

export type PlannedAccount = { kind: AccountTemplateItem["kind"]; number: string; name: string; sortOrder: number };

/**
 * Welche Konten der Vorlage fehlen noch? Vorhandene (gleiche Art, gleicher Name, ohne Beachtung der Gross-/Kleinschreibung) werden
 * übersprungen. Die Nummern («E01», «A01», «V01») sind lediglich frei gewählte Kürzel und lassen sich ändern.
 */
export function planStandardAccounts(existing: ReadonlyArray<{ kind: string; number: string; name: string; sortOrder?: number }>): PlannedAccount[] {
  const usedNumbers = new Set(existing.map((a) => a.number.toLowerCase()));
  const have = new Set(existing.map((a) => `${a.kind}|${a.name.trim().toLowerCase()}`));
  const maxSort = new Map<string, number>();
  for (const a of existing) maxSort.set(a.kind, Math.max(maxSort.get(a.kind) ?? 0, a.sortOrder ?? 0));
  const out: PlannedAccount[] = [];
  const counters = new Map<string, number>();
  for (const item of STANDARD_ACCOUNT_TEMPLATE) {
    if (have.has(`${item.kind}|${item.name.toLowerCase()}`)) continue;
    let n = counters.get(item.kind) ?? 0;
    let number: string;
    do {
      n += 1;
      number = `${NUMBER_PREFIX[item.kind]}${String(n).padStart(2, "0")}`;
    } while (usedNumbers.has(number.toLowerCase()));
    counters.set(item.kind, n);
    usedNumbers.add(number.toLowerCase());
    const sortOrder = (maxSort.get(item.kind) ?? 0) + 10;
    maxSort.set(item.kind, sortOrder);
    out.push({ kind: item.kind, number, name: item.name, sortOrder });
  }
  return out;
}

// ---- Geschäftsjahre in Auswahllisten -----------------------------------------------------------------------------------------

/** Auswahl der Jahre: alle bekannten Jahre plus das laufende, neueste zuerst, ohne Duplikate. */
export function yearChoices(known: Iterable<number>, current: number): number[] {
  const set = new Set<number>([current]);
  for (const y of known) if (Number.isInteger(y) && y >= 1900 && y <= 2200) set.add(y);
  return [...set].sort((a, b) => b - a);
}

/** «2026» oder, bei abweichendem Beginn, «2026/27». */
export function fiscalYearLabel(year: number, start: FiscalStart): string {
  if (start.month === 1 && start.day === 1) return String(year);
  return `${year}/${String(year + 1).slice(2)}`;
}

// ---- Diagramm ----------------------------------------------------------------------------------------------------------------

/**
 * Obergrenze für die Skala eines Diagramms: die nächste «runde» Zahl (1, 2, 2.5, 5 oder 10 mal Zehnerpotenz) in Rappen,
 * mindestens CHF 100. Beispiel: CHF 1’340.00 → CHF 2’000.00.
 */
export function niceCeiling(maxRappen: number): number {
  const francs = Math.max(100, Math.ceil(Math.max(0, maxRappen) / 100));
  const pow = Math.pow(10, Math.floor(Math.log10(francs)));
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (francs <= step * pow) return Math.round(step * pow) * 100;
  }
  return 10 * pow * 100;
}
