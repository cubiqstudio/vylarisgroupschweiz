// Fortlaufende Nummern ohne Race-Conditions. Die Nummer wird INNERHALB der Transaktion vergeben, die den Datensatz anlegt:
//
//   const member = await db.$transaction(async (tx) => {
//     const memberNumber = await nextMemberNumber(tx);
//     return tx.member.create({ data: { memberNumber, ... } });
//   });
//
// Der Zähler (Tabelle Counter) wird mit einem atomaren «increment» erhöht; die Zeile ist bis zum Ende der Transaktion gesperrt, parallele
// Vergaben warten. Schlägt die Transaktion fehl, wird auch der Zähler zurückgerollt: keine Lücken (wichtig für Rechnungsnummern).
import type { Prisma } from "@prisma/client";

/** Alles, was der Zähler braucht: ein Prisma-Client oder ein Transaktions-Client. */
export type CounterClient = Pick<Prisma.TransactionClient, "counter">;

export const MEMBER_COUNTER_KEY = "member";
export const invoiceCounterKey = (year: number) => `invoice:${year}`;
export const voucherCounterKey = (year: number) => `voucher:${year}`;

/** «2026-0001» */
export function formatInvoiceNumber(year: number, seq: number): string {
  return `${year}-${String(seq).padStart(4, "0")}`;
}

/** «B-2026-0001» (Belegnummer der Kasse) */
export function formatVoucherNumber(year: number, seq: number): string {
  return `B-${year}-${String(seq).padStart(4, "0")}`;
}

/** Zerlegt «2026-0001» in Jahr und laufende Nummer; null bei ungültigem Format. */
export function parseInvoiceNumber(value: string): { year: number; seq: number } | null {
  const m = /^(\d{4})-(\d{4,})$/.exec(value.trim());
  if (!m) return null;
  return { year: Number(m[1]), seq: Number(m[2]) };
}

function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: unknown }).code === "P2002";
}

/**
 * Erhöht den Zähler `key` atomar um 1 und liefert den neuen Wert (erste Vergabe = 1).
 * Legen zwei Transaktionen den Zähler gleichzeitig zum ersten Mal an, verliert eine mit einem Eindeutigkeitsfehler; dann wird einmal wiederholt.
 */
export async function nextSequence(client: CounterClient, key: string): Promise<number> {
  for (let attempt = 0; ; attempt++) {
    try {
      const row = await client.counter.upsert({
        where: { key },
        create: { key, value: 1 },
        update: { value: { increment: 1 } },
        select: { value: true },
      });
      return row.value;
    } catch (e) {
      if (attempt < 2 && isUniqueViolation(e)) continue;
      throw e;
    }
  }
}

/** Nächste Mitgliedernummer (fortlaufend, wird nie neu vergeben). */
export function nextMemberNumber(client: CounterClient): Promise<number> {
  return nextSequence(client, MEMBER_COUNTER_KEY);
}

/** Nächste Rechnungsnummer im Jahr: {number: "2026-0001", year, seq}. `year` = Jahr des Rechnungsdatums (Zürcher Zeit, siehe dates.ts). */
export async function nextInvoiceNumber(client: CounterClient, year: number): Promise<{ number: string; year: number; seq: number }> {
  const seq = await nextSequence(client, invoiceCounterKey(year));
  return { number: formatInvoiceNumber(year, seq), year, seq };
}

/** Nächste Belegnummer der Kasse im Jahr. */
export async function nextVoucherNumber(client: CounterClient, year: number): Promise<{ number: string; year: number; seq: number }> {
  const seq = await nextSequence(client, voucherCounterKey(year));
  return { number: formatVoucherNumber(year, seq), year, seq };
}
