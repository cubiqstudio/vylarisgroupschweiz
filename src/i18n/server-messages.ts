// Schweizer Schreibweise für Meldungen der REST-API.
// Die Routen und src/lib/validation.ts werfen deutsche Texte; die Standardtexte von Zod (z.locales.de) stammen aus
// einer deutschen Bibliothek und enthalten das Eszett sowie gerade bzw. tiefgestellte deutsche Anführungszeichen. `fail()` in src/lib/api.ts
// schickt jede Fehlermeldung durch `swissText`, damit die Antworten einheitlich Schweizer Hochdeutsch bleiben.
// Prüfung der Quellen und Zod-Meldungen: `npx tsx scripts/check-api-messages.mts`.

/** Eszett -> ss und deutsche bzw. gerade Anführungszeichen -> «…». Alles andere bleibt unverändert. */
export function swissText(message: string): string {
  if (!message) return message;
  return message
    .replace(/\u00df/g, "ss")
    .replace(/[\u201e\u201c\u201d]([^\u201e\u201c\u201d\n]*)[\u201c\u201d"]/g, "«$1»")
    .replace(/"([^"\n]*)"/g, "«$1»");
}

/** Wendet `swissText` auf die Werte eines `fields`-Objekts an. */
export function swissFields(fields: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, typeof v === "string" ? swissText(v) : v]));
}
