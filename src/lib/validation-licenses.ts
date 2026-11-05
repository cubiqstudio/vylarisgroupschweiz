import { z } from "zod";

const slug = z.string().trim().min(1, "Produkt angeben.").max(60).regex(/^[a-z0-9-]+$/, "Ungültiges Produkt.");
const text = (max: number) => z.string().trim().max(max, `Maximal ${max} Zeichen.`);

// ---- Nutzer ----
export const keyRequestSchema = z.object({ product: slug, message: text(500).default("") });
export const businessRequestSchema = z.object({ companyName: z.string().trim().min(2, "Bitte gib den Firmennamen an.").max(120, "Maximal 120 Zeichen.") });

// ---- Prüf-API (streng: unbekannte Felder werden abgelehnt) ----
export const verifySchema = z
  .object({
    key: z.string().max(60),
    product: slug,
    instance: z.string().trim().min(1).max(200).optional(),
    nonce: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/, "Ungültiger Nonce."),
  })
  .strict();

// ---- Admin ----
export const productSchema = z.object({
  slug: slug,
  code: z.string().trim().toUpperCase().regex(/^[A-Z]{3,4}$/, "3–4 Großbuchstaben."),
  name: z.string().trim().min(2, "Name angeben.").max(80),
  nameEn: text(80).nullable().optional(),
  description: text(500).default(""),
  descriptionEn: text(500).nullable().optional(),
  businessOnly: z.boolean().default(false),
  allowAccountRequest: z.boolean().default(false),
  approvalMode: z.enum(["AUTO", "MANUAL"]).default("AUTO"),
  comingSoon: z.boolean().default(false),
  active: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(1000).default(0),
});

export const keyActionSchema = z.object({
  action: z.enum(["approve", "reject", "revoke", "reactivate", "reset-binding"]),
  adminNote: text(500).optional(),
});
export const webspaceActionSchema = z.object({ action: z.enum(["approve", "reject"]), adminNote: text(500).optional() });
export const businessActionSchema = z.object({ action: z.enum(["approve", "reject", "reset"]) });
export const apiClientCreateSchema = z.object({
  name: z.string().trim().min(2, "Name angeben.").max(80),
  productSlugs: z.array(slug).max(20).default([]),
});
export const apiClientPatchSchema = z.object({ name: z.string().trim().min(2).max(80).optional(), active: z.boolean().optional() });
