import { LeadStatus } from "@prisma/client";
import { z } from "zod";

const emptyStringToNull = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
};

const optionalEmail = z.preprocess(emptyStringToNull, z.string().email().nullable().optional());
const optionalUrl = z.preprocess(emptyStringToNull, z.string().url().nullable().optional());
const optionalString = z.preprocess(emptyStringToNull, z.string().nullable().optional());
const optionalRelationId = z.preprocess(emptyStringToNull, z.string().min(1).nullable().optional());
const tags = z.preprocess(
  (value) => {
    if (value == null) return undefined;
    return typeof value === "string" ? value.split(",").map((tag) => tag.trim()).filter(Boolean) : value;
  },
  z.array(z.string()).default([]),
);
const optionalDecimal = z.preprocess((value) => (value === "" || value === null ? null : value), z.coerce.number().nonnegative().nullable().optional());
const optionalDate = z.preprocess((value) => (value === "" || value === null ? null : value), z.coerce.date().nullable().optional());

export const companySchema = z.object({
  name: z.string().trim().min(2, "Il nome azienda e obbligatorio"),
  industry: optionalString,
  website: optionalUrl,
  phone: optionalString,
  email: optionalEmail,
  address: optionalString,
  city: optionalString,
  country: optionalString,
  tags,
  notes: optionalString,
});

export const companyUpdateSchema = companySchema.partial();

export const contactSchema = z.object({
  firstName: z.string().trim().min(2, "Il nome e obbligatorio"),
  lastName: z.string().trim().min(2, "Il cognome e obbligatorio"),
  email: optionalEmail,
  phone: optionalString,
  jobTitle: optionalString,
  companyId: optionalRelationId,
  lifecycle: z.nativeEnum(LeadStatus).default(LeadStatus.NEW),
  tags,
  notes: optionalString,
});

export const contactUpdateSchema = contactSchema.partial();

export const leadSchema = z.object({
  title: z.string().trim().min(2, "Il titolo lead e obbligatorio"),
  source: optionalString,
  status: z.nativeEnum(LeadStatus).default(LeadStatus.NEW),
  score: z.coerce.number().int().min(0).max(100).default(0),
  estimatedValue: optionalDecimal,
  expectedCloseDate: optionalDate,
  companyId: optionalRelationId,
  contactId: optionalRelationId,
  tags,
  notes: optionalString,
});

export const leadUpdateSchema = leadSchema.partial();

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
