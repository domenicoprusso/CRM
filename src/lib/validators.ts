import { LeadStatus } from "@prisma/client";
import { z } from "zod";

const optionalEmail = z.preprocess((value) => (value === "" ? undefined : value), z.string().email().optional());
const optionalUrl = z.preprocess((value) => (value === "" ? undefined : value), z.string().url().optional());
const optionalString = z.preprocess((value) => (value === "" ? undefined : value), z.string().trim().optional());
const tags = z.preprocess(
  (value) => (typeof value === "string" ? value.split(",").map((tag) => tag.trim()).filter(Boolean) : value),
  z.array(z.string()).default([]),
);

export const companySchema = z.object({
  name: z.string().trim().min(2, "Il nome azienda è obbligatorio"),
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

export const contactSchema = z.object({
  firstName: z.string().trim().min(2, "Il nome è obbligatorio"),
  lastName: z.string().trim().min(2, "Il cognome è obbligatorio"),
  email: optionalEmail,
  phone: optionalString,
  jobTitle: optionalString,
  companyId: optionalString,
  lifecycle: z.nativeEnum(LeadStatus).default(LeadStatus.NEW),
  tags,
  notes: optionalString,
});

export const leadSchema = z.object({
  title: z.string().trim().min(2, "Il titolo lead è obbligatorio"),
  source: optionalString,
  status: z.nativeEnum(LeadStatus).default(LeadStatus.NEW),
  score: z.coerce.number().int().min(0).max(100).default(0),
  estimatedValue: z.preprocess((value) => (value === "" ? undefined : value), z.coerce.number().nonnegative().optional()),
  expectedCloseDate: z.preprocess((value) => (value === "" ? undefined : value), z.coerce.date().optional()),
  companyId: optionalString,
  contactId: optionalString,
  tags,
  notes: optionalString,
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
