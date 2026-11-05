// Werte des Mitglieder-Formulars (ohne Client-Code, damit auch Server-Seiten sie nutzen können).
export type MemberFormValues = {
  salutation: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  street: string;
  houseNumber: string;
  zip: string;
  city: string;
  country: string;
  email: string;
  phone: string;
  communicationPref: string;
  membershipTypeId: string;
  boardNotes: string;
};

export const EMPTY_MEMBER: MemberFormValues = {
  salutation: "",
  firstName: "",
  lastName: "",
  birthDate: "",
  street: "",
  houseNumber: "",
  zip: "",
  city: "",
  country: "CH",
  email: "",
  phone: "",
  communicationPref: "EMAIL",
  membershipTypeId: "",
  boardNotes: "",
};

