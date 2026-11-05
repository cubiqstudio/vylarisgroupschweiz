import { randomInt } from "node:crypto";
import { db } from "@/lib/db";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // ohne 0/O/1/I

export function generateTicketNumber(): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return `VGE-${new Date().getFullYear()}-${s}`;
}

export async function uniqueTicketNumber(): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const n = generateTicketNumber();
    const exists = await db.contactTicket.findUnique({ where: { ticketNumber: n }, select: { id: true } });
    if (!exists) return n;
  }
  throw new Error("Konnte keine eindeutige Ticketnummer erzeugen.");
}
