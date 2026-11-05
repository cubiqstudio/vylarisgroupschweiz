// Fachlogik der Beiträge und Rechnungen (rein, ohne Datenbank): Status, Teil- und Überzahlungen, Sammelrechnungslauf, Adressblock,
// Referenzwahl der QR-Rechnung, offene Posten und Altersgruppen. Die Datenbankzugriffe stehen in ./fees-data.ts.
import { daysBetween, toDateOnly, zurichParts } from "./dates";
import { openAmount, prorateAnnual, roundToFiveRappen, sumRappen } from "./money";
import { buildInvoiceQrReference, buildInvoiceScorReference, referenceTypeOf, type QrBillReferenceType } from "./qr-bill";
import { isQrIban, normalizeIban } from "./iban";
import type { InvoiceStatus } from "./constants";

export { openAmount };

/** Obergrenze für Rechnungs- und Zahlungsbeträge (CHF 20 Mio.): passt in eine 32-Bit-Ganzzahl der Datenbank (PostgreSQL). */
export const MAX_INVOICE_RAPPEN = 2_000_000_000;

// ---- Status und Zahlungen -------------------------------------------------------------------------------------------

export type InvoiceBalance = { totalRappen: number; paidRappen: number };

/** Offener Betrag und Überzahlung (jeweils >= 0). */
export function balanceOf(inv: InvoiceBalance): { openRappen: number; overpaidRappen: number } {
  return { openRappen: openAmount(inv.totalRappen, inv.paidRappen), overpaidRappen: Math.max(0, inv.paidRappen - inv.totalRappen) };
}

/**
 * Status nach einer Änderung der Zahlungen: Entwurf und storniert bleiben unverändert; offene Rechnungen sind bezahlt,
 * sobald die Zahlungen den Betrag decken (Überzahlung zählt als bezahlt), und umgekehrt wieder offen, wenn Zahlungen entfernt werden.
 */
export function settleStatus(status: InvoiceStatus, inv: InvoiceBalance): InvoiceStatus {
  if (status !== "OFFEN" && status !== "BEZAHLT") return status;
  return inv.totalRappen > 0 && inv.paidRappen >= inv.totalRappen ? "BEZAHLT" : "OFFEN";
}

/** Auf welche Rechnungen darf eine Zahlung gebucht werden? Meldung bei Nein, sonst null. */
export function paymentBlockedReason(status: string): string | null {
  if (status === "ENTWURF") return "Die Rechnung ist noch ein Entwurf. Versende sie zuerst.";
  if (status === "STORNIERT") return "Die Rechnung ist storniert. Auf stornierte Rechnungen werden keine Zahlungen gebucht.";
  return null;
}

/** Wirkung einer Zahlung auf eine Rechnung. */
export function applyPayment(
  inv: InvoiceBalance & { status: InvoiceStatus },
  amountRappen: number,
): { paidRappen: number; status: InvoiceStatus; openRappen: number; overpaidRappen: number; becamePaid: boolean } {
  const paidRappen = inv.paidRappen + amountRappen;
  const status = settleStatus(inv.status, { totalRappen: inv.totalRappen, paidRappen });
  return { paidRappen, status, ...balanceOf({ totalRappen: inv.totalRappen, paidRappen }), becamePaid: inv.status !== "BEZAHLT" && status === "BEZAHLT" };
}

/** Beschreibung des Zahlungsstands für Listen: «bezahlt», «Teilzahlung», «Überzahlung», «offen». */
export function paymentStateLabel(inv: InvoiceBalance & { status: string }): string {
  if (inv.status === "ENTWURF") return "Entwurf";
  if (inv.status === "STORNIERT") return "storniert";
  const { openRappen, overpaidRappen } = balanceOf(inv);
  if (overpaidRappen > 0) return "Überzahlung";
  if (inv.paidRappen > 0 && openRappen > 0) return "Teilzahlung";
  if (openRappen === 0) return "bezahlt";
  return "offen";
}

// ---- Positionen -----------------------------------------------------------------------------------------------------

export type ItemInput = { description: string; quantity: number; unitRappen: number };

/** Summe der Positionen (Menge × Einzelpreis). */
export function itemsTotal(items: readonly ItemInput[]): number {
  return sumRappen(items.map((i) => i.quantity * i.unitRappen));
}

// ---- Sammelrechnungslauf --------------------------------------------------------------------------------------------

export type RunMember = {
  id: string;
  status: string;
  joinedAt: Date | null;
  membershipTypeId: string | null;
};

export type RunOptions = {
  /** Im Eintrittsjahr nur die verbleibenden Monate verrechnen (Eintrittsmonat zählt voll). Aus: voller Jahresbeitrag. */
  prorate: boolean;
  /** Anteilige Beträge auf 5 Rappen runden (Schweizer Rundung). */
  roundToFive: boolean;
};

export type RunSkipReason = "NICHT_AKTIV" | "KEINE_ART" | "KEIN_BEITRAG" | "BEITRAG_NULL" | "BEREITS_RECHNUNG" | "EINTRITT_NACH_PERIODE";
export const RUN_SKIP_LABEL: Record<RunSkipReason, string> = {
  NICHT_AKTIV: "Kein aktives Mitglied",
  KEINE_ART: "Keine Mitgliedschaftsart zugeordnet",
  KEIN_BEITRAG: "Für die Mitgliedschaftsart ist kein Beitrag festgelegt",
  BEITRAG_NULL: "Beitrag beträgt 0.00",
  BEREITS_RECHNUNG: "Für dieses Beitragsjahr besteht schon eine Rechnung",
  EINTRITT_NACH_PERIODE: "Eintritt nach Ende des Beitragsjahres",
};

export type RunEntry = { memberId: string; membershipTypeId: string; amountRappen: number; fullAmountRappen: number; months: number | null };
export type RunSkip = { memberId: string; reason: RunSkipReason };

/**
 * Verbleibende Monate eines Beitragsjahres ab dem Eintritt: Der Eintrittsmonat zählt voll (0–12).
 * Tritt jemand vor dem Beginn des Beitragsjahres ein, sind es 12.
 */
export function monthsInPeriod(joinedAt: Date, periodStart: Date): number {
  const j = zurichParts(joinedAt);
  const s = zurichParts(periodStart);
  const elapsed = j.year * 12 + j.month - (s.year * 12 + s.month);
  return Math.max(0, Math.min(12, 12 - Math.max(0, elapsed)));
}

/**
 * Plant einen Rechnungslauf: welche Mitglieder bekommen welchen Betrag, wer wird übersprungen und warum.
 * `rates`: Beitrag je Mitgliedschaftsart (Rappen). `alreadyInvoiced`: Mitglieder mit einer Rechnung (nicht storniert) in diesem Beitragsjahr.
 */
export function planInvoiceRun(
  members: readonly RunMember[],
  rates: ReadonlyMap<string, number>,
  alreadyInvoiced: ReadonlySet<string>,
  period: { startsOn: Date; endsOn: Date },
  options: RunOptions,
): { entries: RunEntry[]; skipped: RunSkip[]; totalRappen: number } {
  const entries: RunEntry[] = [];
  const skipped: RunSkip[] = [];
  for (const m of members) {
    if (m.status !== "AKTIV") {
      skipped.push({ memberId: m.id, reason: "NICHT_AKTIV" });
      continue;
    }
    if (!m.membershipTypeId) {
      skipped.push({ memberId: m.id, reason: "KEINE_ART" });
      continue;
    }
    if (alreadyInvoiced.has(m.id)) {
      skipped.push({ memberId: m.id, reason: "BEREITS_RECHNUNG" });
      continue;
    }
    const rate = rates.get(m.membershipTypeId);
    if (rate === undefined) {
      skipped.push({ memberId: m.id, reason: "KEIN_BEITRAG" });
      continue;
    }
    if (m.joinedAt && toDateOnly(m.joinedAt).getTime() > toDateOnly(period.endsOn).getTime()) {
      skipped.push({ memberId: m.id, reason: "EINTRITT_NACH_PERIODE" });
      continue;
    }
    let amount = rate;
    let months: number | null = null;
    const joinedInPeriod = m.joinedAt && toDateOnly(m.joinedAt).getTime() > toDateOnly(period.startsOn).getTime();
    if (options.prorate && m.joinedAt && joinedInPeriod) {
      months = monthsInPeriod(m.joinedAt, period.startsOn);
      amount = prorateAnnual(rate, months);
      if (options.roundToFive) amount = roundToFiveRappen(amount);
    }
    if (amount <= 0) {
      skipped.push({ memberId: m.id, reason: "BEITRAG_NULL" });
      continue;
    }
    entries.push({ memberId: m.id, membershipTypeId: m.membershipTypeId, amountRappen: amount, fullAmountRappen: rate, months });
  }
  return { entries, skipped, totalRappen: sumRappen(entries.map((e) => e.amountRappen)) };
}

/** Text der Beitragsposition. */
export function feeItemDescription(label: string, year: number, months: number | null): string {
  const base = label.trim() || `Mitgliederbeitrag ${year}`;
  return months !== null && months < 12 ? `${base} (anteilig, ${months} ${months === 1 ? "Monat" : "Monate"})` : base;
}

// ---- Adresse und Empfänger ------------------------------------------------------------------------------------------

export type AddressSource = { street: string; houseNumber: string; zip: string; city: string; country: string };

/** Mehrzeilige Anschrift für die Rechnung: «Strasse Nr.», «PLZ Ort» und (nur bei Ausland) der Ländercode. */
export function addressBlockOf(m: AddressSource): string {
  const street = [m.street, m.houseNumber].map((s) => s.trim()).filter(Boolean).join(" ");
  const place = [m.zip, m.city].map((s) => s.trim()).filter(Boolean).join(" ");
  const country = m.country.trim().toUpperCase();
  return [street, place, country && country !== "CH" ? country : ""].filter(Boolean).join("\n");
}

export const recipientNameOf = (m: { firstName: string; lastName: string }): string => `${m.firstName.trim()} ${m.lastName.trim()}`.trim();

// ---- Referenz der QR-Rechnung ---------------------------------------------------------------------------------------

export type BillAccount = { account: string; referenceType: QrBillReferenceType; reference: string };

/**
 * Wählt Konto und Referenz der QR-Rechnung aus den Vereinseinstellungen:
 *  - QR-IBAN vorhanden → QR-Referenz (27 Stellen), sonst
 *  - normale IBAN → Creditor Reference (RF…).
 * Eine gespeicherte Referenz bleibt gültig, solange sie zum verfügbaren Konto passt (QR-Referenz ↔ QR-IBAN, RF ↔ IBAN).
 * null, wenn kein Konto hinterlegt ist.
 */
export function chooseBillAccount(
  settings: { iban: string; qrIban: string },
  invoice: { year: number; seq: number; paymentReference: string },
): BillAccount | null {
  const qrIban = normalizeIban(settings.qrIban);
  const iban = normalizeIban(settings.iban);
  const stored = invoice.paymentReference.replace(/\s/g, "");
  const storedType = stored ? referenceTypeOf(stored) : null;
  if (qrIban && isQrIban(qrIban)) {
    return { account: qrIban, referenceType: "QRR", reference: storedType === "QRR" ? stored : buildInvoiceQrReference(invoice.year, invoice.seq) };
  }
  if (iban) {
    return { account: iban, referenceType: "SCOR", reference: storedType === "SCOR" ? stored : buildInvoiceScorReference(invoice.year, invoice.seq) };
  }
  return null;
}

/** Zahlungsreferenz, die beim Erstellen einer Rechnung gespeichert wird (leer, wenn kein Konto hinterlegt ist). */
export function referenceForNewInvoice(settings: { iban: string; qrIban: string }, year: number, seq: number): string {
  return chooseBillAccount(settings, { year, seq, paymentReference: "" })?.reference ?? "";
}

// ---- Offene Posten --------------------------------------------------------------------------------------------------

export type OpenItem = { id: string; dueDate: Date; totalRappen: number; paidRappen: number; status: string };

export const AGING_BUCKETS = [
  { id: "NOT_DUE", label: "Noch nicht fällig" },
  { id: "D0_30", label: "1–30 Tage überfällig" },
  { id: "D31_60", label: "31–60 Tage überfällig" },
  { id: "D61_90", label: "61–90 Tage überfällig" },
  { id: "D90_PLUS", label: "Über 90 Tage überfällig" },
] as const;
export type AgingBucketId = (typeof AGING_BUCKETS)[number]["id"];

export function daysOverdue(dueDate: Date, today: Date): number {
  return Math.max(0, daysBetween(dueDate, today));
}

export function agingBucketOf(dueDate: Date, today: Date): AgingBucketId {
  const d = daysOverdue(dueDate, today);
  if (d <= 0) return "NOT_DUE";
  if (d <= 30) return "D0_30";
  if (d <= 60) return "D31_60";
  if (d <= 90) return "D61_90";
  return "D90_PLUS";
}

/** Offene Posten nach Altersgruppen: Anzahl und offener Betrag. Nur offene Rechnungen mit Restbetrag. */
export function agingSummary(items: readonly OpenItem[], today: Date): { buckets: Array<{ id: AgingBucketId; label: string; count: number; rappen: number }>; count: number; rappen: number; overdueRappen: number } {
  const buckets = AGING_BUCKETS.map((b) => ({ id: b.id, label: b.label as string, count: 0, rappen: 0 }));
  let count = 0;
  let rappen = 0;
  let overdueRappen = 0;
  for (const it of items) {
    if (it.status !== "OFFEN") continue;
    const open = openAmount(it.totalRappen, it.paidRappen);
    if (open <= 0) continue;
    const id = agingBucketOf(it.dueDate, today);
    const bucket = buckets.find((b) => b.id === id)!;
    bucket.count += 1;
    bucket.rappen += open;
    count += 1;
    rappen += open;
    if (id !== "NOT_DUE") overdueRappen += open;
  }
  return { buckets, count, rappen, overdueRappen };
}

/** Beitragsjahr: Zeitraum (Geschäftsjahr) und Bezeichnung. */
export function periodLabel(year: number, label: string): string {
  return label.trim() || `Mitgliederbeitrag ${year}`;
}
