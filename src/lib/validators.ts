import { ActivityType, LeadStatus, TaskPriority, TaskStatus } from "@prisma/client";
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
const taskEntityId = optionalRelationId;
export const importEntitySchema = z.enum(["companies", "contacts", "leads", "opportunities", "activities", "tasks"]);
export const importSourceSchema = z.string().trim().min(2);
export const importJobIdSchema = z.string().min(1);

export const companySchema = z.object({
  name: z.string().trim().min(2, "Il nome azienda e obbligatorio"),
  externalId: optionalString,
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
  externalId: optionalString,
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
  externalId: optionalString,
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

export const opportunitySchema = z.object({
  title: z.string().trim().min(2, "Il titolo opportunita e obbligatorio"),
  externalId: optionalString,
  stageId: optionalRelationId,
  value: z.coerce.number().nonnegative().default(0),
  probability: z.coerce.number().int().min(0).max(100).default(10),
  expectedCloseDate: optionalDate,
  companyId: optionalRelationId,
  contactId: optionalRelationId,
  sourceLeadId: optionalRelationId,
  notes: optionalString,
});

export const opportunityUpdateSchema = opportunitySchema.partial();

export const leadConversionSchema = z.object({
  leadId: z.string().min(1),
  title: z.string().trim().min(2, "Il titolo opportunita e obbligatorio"),
  stageId: optionalRelationId,
  value: z.preprocess((value) => (value === "" || value === null ? 0 : value), z.coerce.number().nonnegative()),
  probability: z.coerce.number().int().min(0).max(100).default(10),
  expectedCloseDate: optionalDate,
  notes: optionalString,
});

export const activitySchema = z
  .object({
    externalId: optionalString,
    type: z.nativeEnum(ActivityType).default(ActivityType.NOTE),
    subject: z.string().trim().min(2, "Il soggetto attivita e obbligatorio"),
    body: optionalString,
    occurredAt: optionalDate,
    companyId: taskEntityId,
    contactId: taskEntityId,
    leadId: taskEntityId,
    opportunityId: taskEntityId,
  });

export const activityUpdateSchema = z.object({
  type: z.nativeEnum(ActivityType).optional(),
  subject: z.string().trim().min(2, "Il soggetto attivita e obbligatorio").optional(),
  body: optionalString,
  occurredAt: optionalDate,
  companyId: taskEntityId,
  contactId: taskEntityId,
  leadId: taskEntityId,
  opportunityId: taskEntityId,
});

export const taskSchema = z.object({
  title: z.string().trim().min(2, "Il titolo task e obbligatorio"),
  externalId: optionalString,
  description: optionalString,
  ownerId: taskEntityId,
  status: z.nativeEnum(TaskStatus).default(TaskStatus.TODO),
  priority: z.nativeEnum(TaskPriority).default(TaskPriority.MEDIUM),
  dueAt: optionalDate,
  reminderAt: optionalDate,
  completedAt: optionalDate,
  companyId: taskEntityId,
  contactId: taskEntityId,
  leadId: taskEntityId,
  opportunityId: taskEntityId,
});

export const taskUpdateSchema = taskSchema.partial();

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Il nome e obbligatorio").max(80),
  email: z.string().trim().email().transform((email) => email.toLowerCase()),
  password: z.string().min(8).max(128),
});
