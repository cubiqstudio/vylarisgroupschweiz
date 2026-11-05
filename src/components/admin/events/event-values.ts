// Werte des Anlass-Formulars (ohne Client-Code, damit auch Server-Seiten sie nutzen können).
export type EventFormValues = {
  title: string;
  description: string;
  location: string;
  /** «JJJJ-MM-TTTHH:mm» (Zürcher Zeit) */
  startsAt: string;
  endsAt: string;
  capacity: string;
  registrationDeadline: string;
  /** public_members = öffentlich sichtbar, Anmeldung nur Mitglieder; public_guests = auch Gäste; members = nur im Portal */
  visibility: "members" | "public_members" | "public_guests";
};

export const EMPTY_EVENT: EventFormValues = {
  title: "",
  description: "",
  location: "",
  startsAt: "",
  endsAt: "",
  capacity: "",
  registrationDeadline: "",
  visibility: "members",
};

export const flagsOf = (v: EventFormValues["visibility"]) => ({ isPublic: v !== "members", membersOnly: v !== "public_guests" });
export const visibilityOf = (isPublic: boolean, membersOnly: boolean): EventFormValues["visibility"] => (!isPublic ? "members" : membersOnly ? "public_members" : "public_guests");

