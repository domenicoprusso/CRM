import { randomUUID } from "node:crypto";
import { ActivityType, LeadStatus, TaskPriority, TaskStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureDefaultPipelineStages } from "@/lib/pipeline";
import { normalizeTagList, projectTagsFromValue, splitMultiValue } from "@/lib/tagging";
import { importEntitySchema } from "@/lib/validators";

export const importEntityLabels = {
  companies: "Aziende",
  contacts: "Contatti",
  leads: "Lead",
  opportunities: "Opportunita",
  activities: "Attivita",
  tasks: "Task",
} as const;

export type ImportEntity = keyof typeof importEntityLabels;
type RowState = "valid" | "duplicate" | "invalid";
type RowExecutionResult = "created" | "duplicate_existing" | "duplicate_in_file" | "invalid";

type ImportContext = {
  tenantId: string;
  userId: string;
  users: Array<{ id: string; email: string; name: string }>;
  companies: Array<{ id: string; externalId: string | null; name: string; email: string | null; website: string | null }>;
  contacts: Array<{ id: string; externalId: string | null; email: string | null; firstName: string; lastName: string; companyId: string | null }>;
  leads: Array<{ id: string; externalId: string | null; title: string; companyId: string | null; contactId: string | null }>;
  opportunities: Array<{ id: string; externalId: string | null; title: string; companyId: string | null; contactId: string | null; sourceLeadId: string | null }>;
  stages: Array<{ id: string; name: string; order: number; isWon: boolean; isLost: boolean; probability: number }>;
};

type PreviewRow = {
  rowNumber: number;
  rawData: Record<string, string>;
  normalizedData: Record<string, unknown>;
  errors: string[];
  importedEntity: string | null;
  importedEntityId: string | null;
};

type ImportRowExecutionMeta = {
  state?: RowState | "imported";
  dedupeKey?: string;
  duplicateOf?: string | null;
  executionResult?: RowExecutionResult;
};

type ParsedCsv = {
  delimiter: string;
  headers: string[];
  rows: string[][];
};

function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim();
}

function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseDelimitedLine(line: string, delimiter: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (inQuotes) {
      if (char === "\"") {
        if (next === "\"") {
          current += "\"";
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
      continue;
    }

    if (char === "\"") {
      inQuotes = true;
      continue;
    }

    if (char === delimiter) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

export function parseCsv(text: string): ParsedCsv {
  const cleaned = text.replace(/^\uFEFF/, "");
  const lines = cleaned.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const headerLine = lines[0] ?? "";
  const delimiter = [",", ";", "\t"].map((candidate) => ({ candidate, count: (headerLine.match(new RegExp(`\\${candidate}`, "g")) ?? []).length })).sort((a, b) => b.count - a.count)[0]?.candidate ?? ",";
  const rows = lines.map((line) => parseDelimitedLine(line, delimiter));

  return {
    delimiter,
    headers: rows.shift() ?? [],
    rows,
  };
}

function extractQuotedValues(line: string) {
  return [...line.matchAll(/"([^"]*)"/g)].map((match) => match[1]);
}

export function looksLikeTeamSystemCompanyExport(text: string) {
  const cleaned = text.replace(/^\uFEFF/, "");
  return cleaned.includes("IDAVATAR_COMPANY_ID") || cleaned.includes("Codice_x0020_azienda") || cleaned.split(/\r?\n/).some((line) => extractQuotedValues(line).length >= 50);
}

export function parseTeamSystemCompanyExport(text: string): ParsedCsv {
  const cleaned = text.replace(/^\uFEFF/, "");
  const lines = cleaned.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const startIndex = extractQuotedValues(lines[0] ?? "").length >= 50 ? 0 : 1;
  const dataLines = lines.slice(startIndex).filter((line) => extractQuotedValues(line).length > 0);
  const headers = ["externalId", "name", "industry", "website", "phone", "email", "address", "city", "country", "owner", "tags", "notes"];
  const rows = dataLines.map((line) => {
    const values = extractQuotedValues(line);
    const fieldAt = (position: number) => values[position - 1] ?? "";
    const phones = splitMultiValue(fieldAt(8));
    const emails = splitMultiValue(fieldAt(9));
    const projectTags = projectTagsFromValue(fieldAt(11));
    const structuredTags = normalizeTagList(fieldAt(36));
    const notes = [fieldAt(13), fieldAt(14)]
      .map((value) => value.trim())
      .filter(Boolean)
      .join(" | ");

    return [
      fieldAt(1),
      fieldAt(3),
      "",
      "",
      phones[0] ?? "",
      emails[0] ?? "",
      fieldAt(23),
      fieldAt(6),
      fieldAt(25),
      "",
      [...projectTags, ...structuredTags].join(","),
      notes,
    ];
  });

  return { delimiter: "teamsystem", headers, rows };
}

function buildRowObject(headers: string[], values: string[]) {
  return headers.reduce<Record<string, string>>((acc, header, index) => {
    acc[header] = values[index] ?? "";
    return acc;
  }, {});
}

function splitTags(value: string | null | undefined) {
  return normalizeText(value)
    .split(/[;,|]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function parseInteger(value: string | null | undefined, fallback = 0) {
  const text = normalizeText(value);
  if (!text) return fallback;
  const normalized = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseDecimal(value: string | null | undefined, fallback = 0) {
  const text = normalizeText(value);
  if (!text) return fallback;
  const normalized = text.includes(",") && text.includes(".") ? text.replace(/\./g, "").replace(",", ".") : text.replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseDate(value: string | null | undefined) {
  const text = normalizeText(value);
  if (!text) return null;
  const candidates = [text, text.replace(" ", "T"), text.includes("/") ? text.split("/").reverse().join("-") : text];
  for (const candidate of candidates) {
    const parsed = new Date(candidate);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day));
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  return null;
}

function toIsoOrNull(value: Date | null) {
  return value ? value.toISOString() : null;
}

function normalizeStatus(value: string | null | undefined, kind: "lead" | "task") {
  const text = normalizeText(value).toLowerCase();
  if (!text) return kind === "lead" ? LeadStatus.NEW : TaskStatus.TODO;
  if (kind === "lead") {
    if (["new", "nuovo", "aperto"].includes(text)) return LeadStatus.NEW;
    if (["contacted", "contattato"].includes(text)) return LeadStatus.CONTACTED;
    if (["qualified", "qualificato"].includes(text)) return LeadStatus.QUALIFIED;
    if (["nurturing", "coltivazione"].includes(text)) return LeadStatus.NURTURING;
    if (["converted", "convertito"].includes(text)) return LeadStatus.CONVERTED;
    if (["lost", "perso", "persa"].includes(text)) return LeadStatus.LOST;
    return LeadStatus.NEW;
  }

  if (["todo", "to_do", "da_fare"].includes(text)) return TaskStatus.TODO;
  if (["in_progress", "in_lavorazione", "working"].includes(text)) return TaskStatus.IN_PROGRESS;
  if (["done", "completato", "completed"].includes(text)) return TaskStatus.DONE;
  if (["cancelled", "canceled", "annullato"].includes(text)) return TaskStatus.CANCELLED;
  return TaskStatus.TODO;
}

function normalizePriority(value: string | null | undefined) {
  const text = normalizeText(value).toLowerCase();
  if (!text) return TaskPriority.MEDIUM;
  if (["low", "bassa"].includes(text)) return TaskPriority.LOW;
  if (["medium", "media"].includes(text)) return TaskPriority.MEDIUM;
  if (["high", "alta"].includes(text)) return TaskPriority.HIGH;
  if (["urgent", "urgente"].includes(text)) return TaskPriority.URGENT;
  return TaskPriority.MEDIUM;
}

function normalizeActivityType(value: string | null | undefined) {
  const text = normalizeText(value).toLowerCase();
  if (!text) return ActivityType.NOTE;
  if (["email", "mail"].includes(text)) return ActivityType.EMAIL;
  if (["call", "phone", "telefonata", "chiamata"].includes(text)) return ActivityType.CALL;
  if (["meeting", "incontro", "riunione"].includes(text)) return ActivityType.MEETING;
  if (["note", "nota"].includes(text)) return ActivityType.NOTE;
  if (["follow_up", "follow-up", "followup", "richiamo"].includes(text)) return ActivityType.FOLLOW_UP;
  if (["import", "importazione"].includes(text)) return ActivityType.IMPORT;
  return ActivityType.NOTE;
}

function toLookupKey(value: string | null | undefined) {
  return normalizeText(value).toLowerCase();
}

function buildFieldMapping(headers: string[], aliases: Record<string, string[]>) {
  const normalizedHeaders = headers.map((header) => ({ raw: header, normalized: normalizeHeader(header) }));
  return Object.fromEntries(
    Object.entries(aliases)
      .map(([field, candidates]) => {
        const match = normalizedHeaders.find((header) => candidates.map(normalizeHeader).includes(header.normalized));
        return match ? [field, match.raw] : undefined;
      })
      .filter(Boolean) as Array<[string, string]>,
  );
}

function readMappedValue(row: Record<string, string>, mapping: Record<string, string>, field: string) {
  const header = mapping[field];
  return header ? row[header] : "";
}

function getUserId(ctx: ImportContext, value: string | null | undefined) {
  const lookup = toLookupKey(value);
  if (!lookup) return null;
  return ctx.users.find((user) => toLookupKey(user.email) === lookup || toLookupKey(user.name) === lookup)?.id ?? null;
}

function getCompanyId(ctx: ImportContext, value: string | null | undefined) {
  const lookup = toLookupKey(value);
  if (!lookup) return null;
  return (
    ctx.companies.find((company) => toLookupKey(company.externalId) === lookup || toLookupKey(company.name) === lookup || toLookupKey(company.email) === lookup)?.id ?? null
  );
}

function getContactId(ctx: ImportContext, value: string | null | undefined) {
  const lookup = toLookupKey(value);
  if (!lookup) return null;
  return (
    ctx.contacts.find((contact) => toLookupKey(contact.externalId) === lookup || toLookupKey(contact.email) === lookup || toLookupKey(`${contact.firstName} ${contact.lastName}`) === lookup)?.id ?? null
  );
}

function getLeadId(ctx: ImportContext, value: string | null | undefined) {
  const lookup = toLookupKey(value);
  if (!lookup) return null;
  return ctx.leads.find((lead) => toLookupKey(lead.externalId) === lookup || toLookupKey(lead.title) === lookup)?.id ?? null;
}

function getOpportunityId(ctx: ImportContext, value: string | null | undefined) {
  const lookup = toLookupKey(value);
  if (!lookup) return null;
  return ctx.opportunities.find((opportunity) => toLookupKey(opportunity.externalId) === lookup || toLookupKey(opportunity.title) === lookup)?.id ?? null;
}

async function buildContext(prismaClient: typeof prisma, tenantId: string): Promise<ImportContext> {
  const [users, companies, contacts, leads, opportunities, stages] = await Promise.all([
    prismaClient.user.findMany({ where: { tenantId, isActive: true }, select: { id: true, email: true, name: true } }),
    prismaClient.company.findMany({ where: { tenantId }, select: { id: true, externalId: true, name: true, email: true, website: true } }),
    prismaClient.contact.findMany({ where: { tenantId }, select: { id: true, externalId: true, email: true, firstName: true, lastName: true, companyId: true } }),
    prismaClient.lead.findMany({ where: { tenantId }, select: { id: true, externalId: true, title: true, companyId: true, contactId: true } }),
    prismaClient.opportunity.findMany({ where: { tenantId }, select: { id: true, externalId: true, title: true, companyId: true, contactId: true, sourceLeadId: true } }),
    ensureDefaultPipelineStages(tenantId),
  ]);

  return {
    tenantId,
    userId: "",
    users,
    companies,
    contacts,
    leads,
    opportunities,
    stages: stages.map((stage) => ({
      id: stage.id,
      name: stage.name,
      order: stage.order,
      isWon: stage.isWon,
      isLost: stage.isLost,
      probability: stage.probability,
    })),
  };
}

function firstOpenStage(ctx: ImportContext) {
  return ctx.stages.find((stage) => !stage.isWon && !stage.isLost) ?? ctx.stages[0];
}

function wonStage(ctx: ImportContext) {
  return ctx.stages.find((stage) => stage.isWon);
}

function lostStage(ctx: ImportContext) {
  return ctx.stages.find((stage) => stage.isLost);
}

function dedupeState(existingId: string | null, seen: Set<string>, key: string) {
  if (existingId) return { state: "duplicate" as RowState, duplicateOf: existingId };
  if (seen.has(key)) return { state: "duplicate" as RowState, duplicateOf: key };
  seen.add(key);
  return { state: "valid" as RowState, duplicateOf: null };
}

function previewMeta(entity: ImportEntity, state: RowState, dedupeKey: string, duplicateOf: string | null) {
  return { entity, state, dedupeKey, duplicateOf };
}

function executionMeta(normalizedData: Record<string, unknown>, executionResult: RowExecutionResult) {
  const currentMeta = (normalizedData.meta ?? {}) as Record<string, unknown>;
  return {
    ...normalizedData,
    meta: {
      ...currentMeta,
      state: executionResult === "created" ? "imported" : executionResult === "invalid" ? "invalid" : "duplicate",
      executionResult,
    },
  };
}

function executionResultFromPreview(meta: ImportRowExecutionMeta): RowExecutionResult | null {
  if (meta.state === "invalid") return "invalid";
  if (meta.state === "duplicate") {
    return meta.duplicateOf && meta.dedupeKey && meta.duplicateOf === meta.dedupeKey ? "duplicate_in_file" : "duplicate_existing";
  }
  return null;
}

function companyAliases() {
  return {
    externalId: ["external_id", "externalid", "id_esterno", "source_id", "sourceid", "team_system_id"],
    name: ["name", "company", "ragione_sociale", "ragionesociale", "azienda"],
    industry: ["industry", "settore"],
    website: ["website", "sito_web", "sito", "url"],
    phone: ["phone", "telefono", "tel"],
    email: ["email", "mail"],
    address: ["address", "indirizzo"],
    city: ["city", "citta", "citta"],
    country: ["country", "paese", "nazione"],
    owner: ["owner", "responsabile", "sales_owner", "commerciale"],
    tags: ["tags", "tag"],
    notes: ["notes", "note"],
  };
}

function contactAliases() {
  return {
    externalId: ["external_id", "externalid", "id_esterno", "source_id", "sourceid"],
    companyExternalId: ["company_external_id", "company_source_id", "azienda_id", "companyid"],
    companyName: ["company_name", "azienda", "ragione_sociale"],
    firstName: ["first_name", "nome", "firstname"],
    lastName: ["last_name", "cognome", "lastname"],
    email: ["email", "mail"],
    phone: ["phone", "telefono", "tel"],
    jobTitle: ["job_title", "ruolo", "funzione", "position"],
    owner: ["owner", "responsabile", "sales_owner", "commerciale"],
    lifecycle: ["lifecycle", "stato", "status"],
    tags: ["tags", "tag"],
    notes: ["notes", "note"],
  };
}

function leadAliases() {
  return {
    externalId: ["external_id", "externalid", "id_esterno", "source_id", "sourceid"],
    companyExternalId: ["company_external_id", "company_source_id", "azienda_id", "companyid"],
    contactExternalId: ["contact_external_id", "contact_source_id", "contatto_id"],
    title: ["title", "titolo", "subject"],
    source: ["source", "fonte"],
    status: ["status", "stato"],
    score: ["score", "punteggio"],
    estimatedValue: ["estimated_value", "valore_stimato", "value_estimate"],
    expectedCloseDate: ["expected_close_date", "data_chiusura_prevista", "close_date"],
    owner: ["owner", "responsabile", "sales_owner", "commerciale"],
    tags: ["tags", "tag"],
    notes: ["notes", "note"],
  };
}

function opportunityAliases() {
  return {
    externalId: ["external_id", "externalid", "id_esterno", "source_id", "sourceid"],
    sourceLeadId: ["source_lead_id", "lead_source_id", "lead_id"],
    companyExternalId: ["company_external_id", "company_source_id", "azienda_id", "companyid"],
    contactExternalId: ["contact_external_id", "contact_source_id", "contatto_id"],
    status: ["status", "stato", "esito"],
    stage: ["stage", "fase", "pipeline_stage"],
    title: ["title", "titolo", "subject"],
    value: ["value", "valore", "amount"],
    probability: ["probability", "probabilita", "probability_percent"],
    expectedCloseDate: ["expected_close_date", "data_chiusura_prevista", "close_date"],
    owner: ["owner", "responsabile", "sales_owner", "commerciale"],
    notes: ["notes", "note"],
  };
}

function activityAliases() {
  return {
    externalId: ["external_id", "externalid", "id_esterno", "source_id", "sourceid"],
    companyExternalId: ["company_external_id", "company_source_id", "azienda_id", "companyid"],
    contactExternalId: ["contact_external_id", "contact_source_id", "contatto_id"],
    leadExternalId: ["lead_external_id", "lead_source_id", "leadid"],
    opportunityExternalId: ["opportunity_external_id", "opportunity_source_id", "opportunityid"],
    type: ["type", "tipo", "activity_type"],
    subject: ["subject", "oggetto", "titolo"],
    body: ["body", "descrizione", "notes"],
    occurredAt: ["occurred_at", "data_attivita", "activity_date", "date"],
    user: ["user", "owner", "responsabile", "utente"],
  };
}

function taskAliases() {
  return {
    externalId: ["external_id", "externalid", "id_esterno", "source_id", "sourceid"],
    companyExternalId: ["company_external_id", "company_source_id", "azienda_id", "companyid"],
    contactExternalId: ["contact_external_id", "contact_source_id", "contatto_id"],
    leadExternalId: ["lead_external_id", "lead_source_id", "leadid"],
    opportunityExternalId: ["opportunity_external_id", "opportunity_source_id", "opportunityid"],
    title: ["title", "titolo", "subject"],
    description: ["description", "descrizione", "notes"],
    status: ["status", "stato"],
    priority: ["priority", "priorita", "urgency"],
    dueAt: ["due_at", "scadenza", "due_date", "deadline"],
    reminderAt: ["reminder_at", "promemoria", "reminder_date"],
    completedAt: ["completed_at", "completato_il", "done_at"],
    owner: ["owner", "responsabile", "sales_owner", "commerciale"],
  };
}

function baseResult(rowNumber: number, rawData: Record<string, string>, normalizedData: Record<string, unknown>, errors: string[]): PreviewRow {
  return { rowNumber, rawData, normalizedData, errors, importedEntity: null, importedEntityId: null };
}

function importedEntityName(entity: ImportEntity) {
  switch (entity) {
    case "companies":
      return "company";
    case "contacts":
      return "contact";
    case "leads":
      return "lead";
    case "opportunities":
      return "opportunity";
    case "activities":
      return "activity";
    case "tasks":
      return "task";
  }
}

function companyDedupKey(row: Record<string, string | null | undefined>) {
  return [normalizeText(row.name).toLowerCase(), normalizeText(row.email).toLowerCase(), normalizeText(row.website).toLowerCase()].filter(Boolean).join("|");
}

function contactDedupKey(row: Record<string, string | null | undefined>) {
  return [normalizeText(row.email).toLowerCase(), normalizeText(row.firstName).toLowerCase(), normalizeText(row.lastName).toLowerCase(), normalizeText(row.companyExternalId).toLowerCase()].filter(Boolean).join("|");
}

function leadDedupKey(row: Record<string, string | null | undefined>) {
  return [normalizeText(row.externalId).toLowerCase(), normalizeText(row.title).toLowerCase(), normalizeText(row.companyExternalId).toLowerCase()].filter(Boolean).join("|");
}

function opportunityDedupKey(row: Record<string, string | null | undefined>) {
  return [normalizeText(row.externalId).toLowerCase(), normalizeText(row.sourceLeadId).toLowerCase(), normalizeText(row.title).toLowerCase(), normalizeText(row.companyExternalId).toLowerCase()].filter(Boolean).join("|");
}

function activityDedupKey(row: Record<string, string | null | undefined>) {
  return [normalizeText(row.externalId).toLowerCase(), normalizeText(row.subject).toLowerCase(), normalizeText(row.occurredAt).toLowerCase(), normalizeText(row.companyExternalId).toLowerCase(), normalizeText(row.contactExternalId).toLowerCase(), normalizeText(row.leadExternalId).toLowerCase(), normalizeText(row.opportunityExternalId).toLowerCase()].filter(Boolean).join("|");
}

function taskDedupKey(row: Record<string, string | null | undefined>) {
  return [normalizeText(row.externalId).toLowerCase(), normalizeText(row.title).toLowerCase(), normalizeText(row.dueAt).toLowerCase(), normalizeText(row.companyExternalId).toLowerCase(), normalizeText(row.contactExternalId).toLowerCase(), normalizeText(row.leadExternalId).toLowerCase(), normalizeText(row.opportunityExternalId).toLowerCase()].filter(Boolean).join("|");
}

function mapCompanyRow(row: Record<string, string>, mapping: Record<string, string>, ctx: ImportContext, seen: Set<string>, existingByExternalId: Map<string, string>, existingByKey: Map<string, string>) {
  const externalId = normalizeText(readMappedValue(row, mapping, "externalId")) || null;
  const name = normalizeText(readMappedValue(row, mapping, "name"));
  const owner = getUserId(ctx, readMappedValue(row, mapping, "owner"));
  const dedupeKey = externalId ? `ext:${toLookupKey(externalId)}` : `fallback:${companyDedupKey({ name, email: readMappedValue(row, mapping, "email"), website: readMappedValue(row, mapping, "website") })}`;
  const existingId = (externalId ? existingByExternalId.get(toLookupKey(externalId) ?? "") : existingByKey.get(dedupeKey)) ?? null;
  const { state, duplicateOf } = dedupeState(existingId, seen, dedupeKey);
  const errors: string[] = [];
  if (!name) errors.push("name_required");
  if (externalId && existingByExternalId.has(toLookupKey(externalId) ?? "")) {
    // keep duplicate state
  }
  const normalized = {
    externalId,
    name,
    industry: normalizeText(readMappedValue(row, mapping, "industry")) || null,
    website: normalizeText(readMappedValue(row, mapping, "website")) || null,
    phone: normalizeText(readMappedValue(row, mapping, "phone")) || null,
    email: normalizeText(readMappedValue(row, mapping, "email")) || null,
    address: normalizeText(readMappedValue(row, mapping, "address")) || null,
    city: normalizeText(readMappedValue(row, mapping, "city")) || null,
    country: normalizeText(readMappedValue(row, mapping, "country")) || null,
    ownerId: owner,
    tags: splitTags(readMappedValue(row, mapping, "tags")),
    notes: normalizeText(readMappedValue(row, mapping, "notes")) || null,
    meta: previewMeta("companies", state, dedupeKey, duplicateOf),
  };
  if (errors.length > 0) normalized.meta = previewMeta("companies", "invalid", dedupeKey, duplicateOf);
  return { normalized, errors, existingId };
}

function mapContactRow(row: Record<string, string>, mapping: Record<string, string>, ctx: ImportContext, seen: Set<string>, existingByExternalId: Map<string, string>, existingByKey: Map<string, string>) {
  const externalId = normalizeText(readMappedValue(row, mapping, "externalId")) || null;
  const firstName = normalizeText(readMappedValue(row, mapping, "firstName"));
  const lastName = normalizeText(readMappedValue(row, mapping, "lastName"));
  const companyId = getCompanyId(ctx, readMappedValue(row, mapping, "companyExternalId") || readMappedValue(row, mapping, "companyName"));
  const ownerId = getUserId(ctx, readMappedValue(row, mapping, "owner"));
  const email = normalizeText(readMappedValue(row, mapping, "email")) || null;
  const dedupeKey = externalId ? `ext:${toLookupKey(externalId)}` : `fallback:${contactDedupKey({ email: email ?? "", firstName, lastName, companyExternalId: companyId ?? "" })}`;
  const existingId = (externalId ? existingByExternalId.get(toLookupKey(externalId) ?? "") : existingByKey.get(dedupeKey)) ?? null;
  const { state, duplicateOf } = dedupeState(existingId, seen, dedupeKey);
  const errors: string[] = [];
  if (!firstName) errors.push("firstName_required");
  if (!lastName) errors.push("lastName_required");
  const normalized = {
    externalId,
    firstName,
    lastName,
    companyId,
    ownerId,
    email,
    phone: normalizeText(readMappedValue(row, mapping, "phone")) || null,
    jobTitle: normalizeText(readMappedValue(row, mapping, "jobTitle")) || null,
    lifecycle: normalizeStatus(readMappedValue(row, mapping, "lifecycle"), "lead"),
    tags: splitTags(readMappedValue(row, mapping, "tags")),
    notes: normalizeText(readMappedValue(row, mapping, "notes")) || null,
    meta: previewMeta("contacts", state, dedupeKey, duplicateOf),
  };
  if (errors.length > 0) normalized.meta = previewMeta("contacts", "invalid", dedupeKey, duplicateOf);
  return { normalized, errors, existingId };
}

function mapLeadRow(row: Record<string, string>, mapping: Record<string, string>, ctx: ImportContext, seen: Set<string>, existingByExternalId: Map<string, string>, existingByKey: Map<string, string>) {
  const externalId = normalizeText(readMappedValue(row, mapping, "externalId")) || null;
  const title = normalizeText(readMappedValue(row, mapping, "title"));
  const companyId = getCompanyId(ctx, readMappedValue(row, mapping, "companyExternalId"));
  const contactId = getContactId(ctx, readMappedValue(row, mapping, "contactExternalId"));
  const ownerId = getUserId(ctx, readMappedValue(row, mapping, "owner"));
  const dedupeKey = externalId ? `ext:${toLookupKey(externalId)}` : `fallback:${leadDedupKey({ externalId: "", title, companyExternalId: companyId ?? "" })}`;
  const existingId = (externalId ? existingByExternalId.get(toLookupKey(externalId) ?? "") : existingByKey.get(dedupeKey)) ?? null;
  const { state, duplicateOf } = dedupeState(existingId, seen, dedupeKey);
  const errors: string[] = [];
  if (!title) errors.push("title_required");
  const normalized = {
    externalId,
    title,
    source: normalizeText(readMappedValue(row, mapping, "source")) || null,
    status: normalizeStatus(readMappedValue(row, mapping, "status"), "lead"),
    score: parseInteger(readMappedValue(row, mapping, "score"), 0),
    estimatedValue: parseDecimal(readMappedValue(row, mapping, "estimatedValue"), 0),
    expectedCloseDate: toIsoOrNull(parseDate(readMappedValue(row, mapping, "expectedCloseDate"))),
    companyId,
    contactId,
    ownerId,
    tags: splitTags(readMappedValue(row, mapping, "tags")),
    notes: normalizeText(readMappedValue(row, mapping, "notes")) || null,
    meta: previewMeta("leads", state, dedupeKey, duplicateOf),
  };
  if (errors.length > 0) normalized.meta = previewMeta("leads", "invalid", dedupeKey, duplicateOf);
  return { normalized, errors, existingId };
}

function mapOpportunityRow(row: Record<string, string>, mapping: Record<string, string>, ctx: ImportContext, seen: Set<string>, existingByExternalId: Map<string, string>, existingByKey: Map<string, string>) {
  const externalId = normalizeText(readMappedValue(row, mapping, "externalId")) || null;
  const title = normalizeText(readMappedValue(row, mapping, "title"));
  const companyId = getCompanyId(ctx, readMappedValue(row, mapping, "companyExternalId"));
  const contactId = getContactId(ctx, readMappedValue(row, mapping, "contactExternalId"));
  const sourceLeadId = getLeadId(ctx, readMappedValue(row, mapping, "sourceLeadId"));
  const ownerId = getUserId(ctx, readMappedValue(row, mapping, "owner"));
  const stageName = normalizeText(readMappedValue(row, mapping, "stage"));
  const dedupeKey = externalId ? `ext:${toLookupKey(externalId)}` : `fallback:${opportunityDedupKey({ externalId: "", sourceLeadId: sourceLeadId ?? "", title, companyExternalId: companyId ?? "" })}`;
  const existingId = (externalId ? existingByExternalId.get(toLookupKey(externalId) ?? "") : existingByKey.get(dedupeKey)) ?? null;
  const { state, duplicateOf } = dedupeState(existingId, seen, dedupeKey);
  const errors: string[] = [];
  if (!title) errors.push("title_required");
  const stage =
    ctx.stages.find((candidate) => normalizeHeader(candidate.name) === normalizeHeader(stageName)) ??
    (readMappedValue(row, mapping, "status").toLowerCase().includes("won") ? wonStage(ctx) : readMappedValue(row, mapping, "status").toLowerCase().includes("lost") ? lostStage(ctx) : firstOpenStage(ctx));
  if (!stage) errors.push("stage_required");
  const normalized = {
    externalId,
    sourceLeadId,
    title,
    stageId: stage?.id ?? null,
    value: parseDecimal(readMappedValue(row, mapping, "value"), 0),
    probability: parseInteger(readMappedValue(row, mapping, "probability"), stage?.probability ?? 10),
    expectedCloseDate: toIsoOrNull(parseDate(readMappedValue(row, mapping, "expectedCloseDate"))),
    companyId,
    contactId,
    ownerId,
    notes: normalizeText(readMappedValue(row, mapping, "notes")) || null,
    meta: previewMeta("opportunities", state, dedupeKey, duplicateOf),
  };
  if (errors.length > 0) normalized.meta = previewMeta("opportunities", "invalid", dedupeKey, duplicateOf);
  return { normalized, errors, existingId };
}

function mapActivityRow(row: Record<string, string>, mapping: Record<string, string>, ctx: ImportContext, seen: Set<string>, existingByExternalId: Map<string, string>, existingByKey: Map<string, string>) {
  const externalId = normalizeText(readMappedValue(row, mapping, "externalId")) || null;
  const subject = normalizeText(readMappedValue(row, mapping, "subject"));
  const companyId = getCompanyId(ctx, readMappedValue(row, mapping, "companyExternalId"));
  const contactId = getContactId(ctx, readMappedValue(row, mapping, "contactExternalId"));
  const leadId = getLeadId(ctx, readMappedValue(row, mapping, "leadExternalId"));
  const opportunityId = getOpportunityId(ctx, readMappedValue(row, mapping, "opportunityExternalId"));
  const userId = getUserId(ctx, readMappedValue(row, mapping, "user")) ?? ctx.userId;
  const dedupeKey = externalId ? `ext:${toLookupKey(externalId)}` : `fallback:${activityDedupKey({ externalId: "", subject, occurredAt: readMappedValue(row, mapping, "occurredAt"), companyExternalId: companyId ?? "", contactExternalId: contactId ?? "", leadExternalId: leadId ?? "", opportunityExternalId: opportunityId ?? "" })}`;
  const existingId = (externalId ? existingByExternalId.get(toLookupKey(externalId) ?? "") : existingByKey.get(dedupeKey)) ?? null;
  const { state, duplicateOf } = dedupeState(existingId, seen, dedupeKey);
  const errors: string[] = [];
  if (!subject) errors.push("subject_required");
  const normalized = {
    externalId,
    type: normalizeActivityType(readMappedValue(row, mapping, "type")),
    subject,
    body: normalizeText(readMappedValue(row, mapping, "body")) || null,
    occurredAt: toIsoOrNull(parseDate(readMappedValue(row, mapping, "occurredAt")) ?? new Date()) ?? new Date().toISOString(),
    companyId,
    contactId,
    leadId,
    opportunityId,
    userId,
    meta: previewMeta("activities", state, dedupeKey, duplicateOf),
  };
  if (errors.length > 0) normalized.meta = previewMeta("activities", "invalid", dedupeKey, duplicateOf);
  return { normalized, errors, existingId };
}

function mapTaskRow(row: Record<string, string>, mapping: Record<string, string>, ctx: ImportContext, seen: Set<string>, existingByExternalId: Map<string, string>, existingByKey: Map<string, string>) {
  const externalId = normalizeText(readMappedValue(row, mapping, "externalId")) || null;
  const title = normalizeText(readMappedValue(row, mapping, "title"));
  const companyId = getCompanyId(ctx, readMappedValue(row, mapping, "companyExternalId"));
  const contactId = getContactId(ctx, readMappedValue(row, mapping, "contactExternalId"));
  const leadId = getLeadId(ctx, readMappedValue(row, mapping, "leadExternalId"));
  const opportunityId = getOpportunityId(ctx, readMappedValue(row, mapping, "opportunityExternalId"));
  const ownerId = getUserId(ctx, readMappedValue(row, mapping, "owner")) ?? ctx.userId;
  const dedupeKey = externalId ? `ext:${toLookupKey(externalId)}` : `fallback:${taskDedupKey({ externalId: "", title, dueAt: readMappedValue(row, mapping, "dueAt"), companyExternalId: companyId ?? "", contactExternalId: contactId ?? "", leadExternalId: leadId ?? "", opportunityExternalId: opportunityId ?? "" })}`;
  const existingId = (externalId ? existingByExternalId.get(toLookupKey(externalId) ?? "") : existingByKey.get(dedupeKey)) ?? null;
  const { state, duplicateOf } = dedupeState(existingId, seen, dedupeKey);
  const errors: string[] = [];
  if (!title) errors.push("title_required");
  if (!ownerId) errors.push("owner_required");
  const normalized = {
    externalId,
    title,
    description: normalizeText(readMappedValue(row, mapping, "description")) || null,
    status: normalizeStatus(readMappedValue(row, mapping, "status"), "task"),
    priority: normalizePriority(readMappedValue(row, mapping, "priority")),
    dueAt: toIsoOrNull(parseDate(readMappedValue(row, mapping, "dueAt"))),
    reminderAt: toIsoOrNull(parseDate(readMappedValue(row, mapping, "reminderAt"))),
    completedAt: toIsoOrNull(parseDate(readMappedValue(row, mapping, "completedAt"))),
    companyId,
    contactId,
    leadId,
    opportunityId,
    ownerId,
    meta: previewMeta("tasks", state, dedupeKey, duplicateOf),
  };
  if (errors.length > 0) normalized.meta = previewMeta("tasks", "invalid", dedupeKey, duplicateOf);
  return { normalized, errors, existingId };
}

function rowMapper(entity: ImportEntity) {
  switch (entity) {
    case "companies":
      return { aliases: companyAliases(), map: mapCompanyRow };
    case "contacts":
      return { aliases: contactAliases(), map: mapContactRow };
    case "leads":
      return { aliases: leadAliases(), map: mapLeadRow };
    case "opportunities":
      return { aliases: opportunityAliases(), map: mapOpportunityRow };
    case "activities":
      return { aliases: activityAliases(), map: mapActivityRow };
    case "tasks":
      return { aliases: taskAliases(), map: mapTaskRow };
    default:
      throw new Error("unsupported-import-entity");
  }
}

async function getExistingMaps(prismaClient: typeof prisma, tenantId: string, entity: ImportEntity) {
  switch (entity) {
    case "companies": {
      const companies = await prismaClient.company.findMany({ where: { tenantId }, select: { id: true, externalId: true, name: true, email: true, website: true } });
      const external = new Map<string, string>();
      const fallback = new Map<string, string>();
      for (const company of companies) {
        if (company.externalId) external.set(toLookupKey(company.externalId), company.id);
        fallback.set(`fallback:${companyDedupKey({ name: company.name, email: company.email, website: company.website })}`, company.id);
      }
      return { external, fallback };
    }
    case "contacts": {
      const contacts = await prismaClient.contact.findMany({ where: { tenantId }, select: { id: true, externalId: true, email: true, firstName: true, lastName: true, companyId: true } });
      const external = new Map<string, string>();
      const fallback = new Map<string, string>();
      for (const contact of contacts) {
        if (contact.externalId) external.set(toLookupKey(contact.externalId), contact.id);
        fallback.set(`fallback:${contactDedupKey({ email: contact.email ?? "", firstName: contact.firstName, lastName: contact.lastName, companyExternalId: contact.companyId ?? "" })}`, contact.id);
      }
      return { external, fallback };
    }
    case "leads": {
      const leads = await prismaClient.lead.findMany({ where: { tenantId }, select: { id: true, externalId: true, title: true, companyId: true } });
      const external = new Map<string, string>();
      const fallback = new Map<string, string>();
      for (const lead of leads) {
        if (lead.externalId) external.set(toLookupKey(lead.externalId), lead.id);
        fallback.set(`fallback:${leadDedupKey({ externalId: "", title: lead.title, companyExternalId: lead.companyId ?? "" })}`, lead.id);
      }
      return { external, fallback };
    }
    case "opportunities": {
      const opportunities = await prismaClient.opportunity.findMany({ where: { tenantId }, select: { id: true, externalId: true, title: true, companyId: true, sourceLeadId: true } });
      const external = new Map<string, string>();
      const fallback = new Map<string, string>();
      for (const opportunity of opportunities) {
        if (opportunity.externalId) external.set(toLookupKey(opportunity.externalId), opportunity.id);
        fallback.set(`fallback:${opportunityDedupKey({ externalId: "", sourceLeadId: opportunity.sourceLeadId ?? "", title: opportunity.title, companyExternalId: opportunity.companyId ?? "" })}`, opportunity.id);
      }
      return { external, fallback };
    }
    case "activities": {
      const activities = await prismaClient.activity.findMany({ where: { tenantId }, select: { id: true, externalId: true, subject: true, occurredAt: true, companyId: true, contactId: true, leadId: true, opportunityId: true } });
      const external = new Map<string, string>();
      const fallback = new Map<string, string>();
      for (const activity of activities) {
        if (activity.externalId) external.set(toLookupKey(activity.externalId), activity.id);
        fallback.set(`fallback:${activityDedupKey({ externalId: "", subject: activity.subject, occurredAt: activity.occurredAt.toISOString(), companyExternalId: activity.companyId ?? "", contactExternalId: activity.contactId ?? "", leadExternalId: activity.leadId ?? "", opportunityExternalId: activity.opportunityId ?? "" })}`, activity.id);
      }
      return { external, fallback };
    }
    case "tasks": {
      const tasks = await prismaClient.task.findMany({ where: { tenantId }, select: { id: true, externalId: true, title: true, dueAt: true, companyId: true, contactId: true, leadId: true, opportunityId: true } });
      const external = new Map<string, string>();
      const fallback = new Map<string, string>();
      for (const task of tasks) {
        if (task.externalId) external.set(toLookupKey(task.externalId), task.id);
        fallback.set(`fallback:${taskDedupKey({ externalId: "", title: task.title, dueAt: task.dueAt?.toISOString() ?? "", companyExternalId: task.companyId ?? "", contactExternalId: task.contactId ?? "", leadExternalId: task.leadId ?? "", opportunityExternalId: task.opportunityId ?? "" })}`, task.id);
      }
      return { external, fallback };
    }
  }
}

function buildNormalizedRow(entity: ImportEntity, row: Record<string, string>, mapping: Record<string, string>, ctx: ImportContext, seen: Set<string>, existingMaps: { external: Map<string, string>; fallback: Map<string, string> }) {
  switch (entity) {
    case "companies":
      return mapCompanyRow(row, mapping, ctx, seen, existingMaps.external, existingMaps.fallback);
    case "contacts":
      return mapContactRow(row, mapping, ctx, seen, existingMaps.external, existingMaps.fallback);
    case "leads":
      return mapLeadRow(row, mapping, ctx, seen, existingMaps.external, existingMaps.fallback);
    case "opportunities":
      return mapOpportunityRow(row, mapping, ctx, seen, existingMaps.external, existingMaps.fallback);
    case "activities":
      return mapActivityRow(row, mapping, ctx, seen, existingMaps.external, existingMaps.fallback);
    case "tasks":
      return mapTaskRow(row, mapping, ctx, seen, existingMaps.external, existingMaps.fallback);
  }
}

function entityCreateData(entity: ImportEntity, row: Record<string, unknown>, tenantId: string) {
  const asDate = (value: unknown) => (typeof value === "string" ? new Date(value) : value instanceof Date ? value : null);
  switch (entity) {
    case "companies":
      return {
        tenantId,
        externalId: row.externalId as string | null,
        name: row.name as string,
        industry: row.industry as string | null,
        website: row.website as string | null,
        phone: row.phone as string | null,
        email: row.email as string | null,
        address: row.address as string | null,
        city: row.city as string | null,
        country: row.country as string | null,
        ownerId: row.ownerId as string | null,
        tags: row.tags as string[],
        notes: row.notes as string | null,
      };
    case "contacts":
      return {
        tenantId,
        externalId: row.externalId as string | null,
        firstName: row.firstName as string,
        lastName: row.lastName as string,
        companyId: row.companyId as string | null,
        ownerId: row.ownerId as string | null,
        email: row.email as string | null,
        phone: row.phone as string | null,
        jobTitle: row.jobTitle as string | null,
        lifecycle: row.lifecycle as LeadStatus,
        tags: row.tags as string[],
        notes: row.notes as string | null,
      };
    case "leads":
      return {
        tenantId,
        externalId: row.externalId as string | null,
        title: row.title as string,
        source: row.source as string | null,
        status: row.status as LeadStatus,
        score: row.score as number,
        estimatedValue: row.estimatedValue !== undefined && row.estimatedValue !== null ? row.estimatedValue : null,
        expectedCloseDate: asDate(row.expectedCloseDate),
        companyId: row.companyId as string | null,
        contactId: row.contactId as string | null,
        ownerId: row.ownerId as string | null,
        tags: row.tags as string[],
        notes: row.notes as string | null,
      };
    case "opportunities":
      return {
        tenantId,
        externalId: row.externalId as string | null,
        sourceLeadId: row.sourceLeadId as string | null,
        title: row.title as string,
        stageId: row.stageId as string,
        value: row.value as number,
        probability: row.probability as number,
        expectedCloseDate: asDate(row.expectedCloseDate),
        companyId: row.companyId as string | null,
        contactId: row.contactId as string | null,
        ownerId: row.ownerId as string | null,
        notes: row.notes as string | null,
      };
    case "activities":
      return {
        tenantId,
        externalId: row.externalId as string | null,
        userId: row.userId as string,
        type: row.type as ActivityType,
        subject: row.subject as string,
        body: row.body as string | null,
        occurredAt: asDate(row.occurredAt) ?? new Date(),
        companyId: row.companyId as string | null,
        contactId: row.contactId as string | null,
        leadId: row.leadId as string | null,
        opportunityId: row.opportunityId as string | null,
      };
    case "tasks":
      return {
        tenantId,
        externalId: row.externalId as string | null,
        ownerId: row.ownerId as string,
        title: row.title as string,
        description: row.description as string | null,
        status: row.status as TaskStatus,
        priority: row.priority as TaskPriority,
        dueAt: asDate(row.dueAt),
        reminderAt: asDate(row.reminderAt),
        completedAt: asDate(row.completedAt),
        companyId: row.companyId as string | null,
        contactId: row.contactId as string | null,
        leadId: row.leadId as string | null,
        opportunityId: row.opportunityId as string | null,
      };
  }
}

function withDuplicateReport(rows: PreviewRow[]) {
  return {
    duplicates: rows
      .filter((row) => (row.normalizedData.meta as Record<string, unknown>).state === "duplicate")
      .map((row) => ({ rowNumber: row.rowNumber, duplicateOf: (row.normalizedData.meta as Record<string, unknown>).duplicateOf as string | null })),
    invalid: rows.filter((row) => (row.normalizedData.meta as Record<string, unknown>).state === "invalid").map((row) => ({ rowNumber: row.rowNumber, errors: row.errors })),
  };
}

export async function createImportPreview(prismaClient: typeof prisma, tenantId: string, userId: string, entityInput: string, source: string, fileName: string, csvText: string) {
  const entity = importEntitySchema.parse(entityInput);
  const useTeamSystemCompanyAdapter = entity === "companies" && /teamsystem/i.test(source) && looksLikeTeamSystemCompanyExport(csvText);
  const parsed = useTeamSystemCompanyAdapter ? parseTeamSystemCompanyExport(csvText) : parseCsv(csvText);
  if (parsed.headers.length === 0) throw new Error("csv-empty");
  const ctx = await buildContext(prismaClient, tenantId);
  ctx.userId = userId;

  const { aliases } = rowMapper(entity);
  const mapping = useTeamSystemCompanyAdapter
    ? {
        externalId: "externalId",
        name: "name",
        industry: "industry",
        website: "website",
        phone: "phone",
        email: "email",
        address: "address",
        city: "city",
        country: "country",
        owner: "owner",
        tags: "tags",
        notes: "notes",
      }
    : buildFieldMapping(parsed.headers, aliases);
  const existingMaps = await getExistingMaps(prismaClient, tenantId, entity);
  const seen = new Set<string>();

  const rows = parsed.rows.map((values, index) => {
    const rawData = buildRowObject(parsed.headers, values);
    const { normalized, errors, existingId } = buildNormalizedRow(entity, rawData, mapping, ctx, seen, existingMaps);
    const preview = baseResult(index + 2, rawData, normalized as Record<string, unknown>, errors);
    if ((normalized.meta as Record<string, unknown>).state === "duplicate") {
      preview.importedEntity = null;
      preview.importedEntityId = existingId;
    }
    return preview;
  });

  const rowsTotal = rows.length;
  const duplicates = rows.filter((row) => (row.normalizedData.meta as Record<string, unknown>).state === "duplicate").length;
  const invalid = rows.filter((row) => (row.normalizedData.meta as Record<string, unknown>).state === "invalid").length;
  const valid = rowsTotal - duplicates - invalid;
  const duplicateReport = withDuplicateReport(rows);
  const errorLog = { invalidRows: duplicateReport.invalid, validation: rows.filter((row) => row.errors.length > 0) };

  const job = await prismaClient.importJob.create({
    data: {
      tenantId,
      createdById: userId,
      source,
      fileName,
      status: "PREVIEWED",
      fieldMapping: { entity, mapping, delimiter: parsed.delimiter, headers: parsed.headers } as Prisma.InputJsonValue,
      duplicateReport: duplicateReport as Prisma.InputJsonValue,
      rowsTotal,
      rowsImported: 0,
      rollbackToken: null,
      errorLog: errorLog as Prisma.InputJsonValue,
      rows: {
        createMany: {
          data: rows.map((row) => ({
            rowNumber: row.rowNumber,
            rawData: row.rawData as Prisma.InputJsonValue,
            normalizedData: row.normalizedData as Prisma.InputJsonValue,
            importedEntity: row.importedEntity,
            importedEntityId: row.importedEntityId,
            errors: row.errors.length > 0 ? row.errors : null,
          })) as Prisma.ImportRowCreateManyImportJobInput[],
        },
      },
    },
    select: { id: true },
  });

  return { jobId: job.id, entity, rowsTotal, valid, invalid, duplicates };
}

function createOrSkipState(existingId: string | null, dedupeKey: string, seen: Set<string>) {
  if (existingId) return { duplicate: true, existingId };
  if (seen.has(dedupeKey)) return { duplicate: true, existingId: null };
  seen.add(dedupeKey);
  return { duplicate: false, existingId: null };
}

export async function executeImportJob(prismaClient: typeof prisma, tenantId: string, userId: string, importJobId: string) {
  const job = await prismaClient.importJob.findFirst({ where: { id: importJobId, tenantId }, include: { rows: { orderBy: { rowNumber: "asc" } } } });
  if (!job) throw new Error("import-job-not-found");
  if (job.status === "COMPLETED") return { importJobId, rowsImported: job.rowsImported, skipped: 0 };
  if (job.status === "ROLLED_BACK") throw new Error("import-job-rolled-back");

  const fieldMapping = job.fieldMapping as { entity: ImportEntity; mapping: Record<string, string> };
  const entity = importEntitySchema.parse(fieldMapping.entity);
  const ctx = await buildContext(prismaClient, tenantId);
  ctx.userId = userId;
  const existingMaps = await getExistingMaps(prismaClient, tenantId, entity);
  const seen = new Set<string>();
  let rowsImported = 0;
  let skipped = 0;
  const skippedRows: Array<{ rowNumber: number; reason: Exclude<RowExecutionResult, "created"> }> = [];

  for (const row of job.rows) {
    const normalized = row.normalizedData as Record<string, unknown>;
    const meta = (normalized.meta ?? {}) as ImportRowExecutionMeta;
    if (meta.state === "invalid" || meta.state === "duplicate") {
      skipped += 1;
      const reason = executionResultFromPreview(meta) ?? "invalid";
      skippedRows.push({ rowNumber: row.rowNumber, reason: reason === "created" ? "invalid" : reason });
      await prismaClient.importRow.updateMany({
        where: { id: row.id, importJob: { tenantId } },
        data: {
          importedEntity: null,
          importedEntityId: null,
          normalizedData: executionMeta(normalized, reason),
        },
      });
      continue;
    }

    const values = row.rawData as Record<string, string>;
    const { normalized: freshNormalized, errors, existingId } = buildNormalizedRow(entity, values, fieldMapping.mapping, ctx, seen, existingMaps);
    if (errors.length > 0 || (freshNormalized.meta as Record<string, unknown>).state === "invalid") {
      skipped += 1;
      skippedRows.push({ rowNumber: row.rowNumber, reason: "invalid" });
      await prismaClient.importRow.updateMany({
        where: { id: row.id, importJob: { tenantId } },
        data: {
          importedEntity: null,
          importedEntityId: null,
          normalizedData: executionMeta(freshNormalized, "invalid"),
        },
      });
      continue;
    }
    const dedupeKey = (freshNormalized.meta as Record<string, unknown>).dedupeKey as string;
    const state = createOrSkipState(existingId, dedupeKey, seen);
    if (state.duplicate) {
      skipped += 1;
      const reason: Exclude<RowExecutionResult, "created"> = existingId ? "duplicate_existing" : "duplicate_in_file";
      skippedRows.push({ rowNumber: row.rowNumber, reason });
      await prismaClient.importRow.updateMany({
        where: { id: row.id, importJob: { tenantId } },
        data: {
          importedEntity: null,
          importedEntityId: null,
          normalizedData: executionMeta(freshNormalized, reason),
        },
      });
      continue;
    }

    const created = await prismaClient.$transaction(async (tx) => {
      switch (entity) {
        case "companies":
          return tx.company.create({ data: entityCreateData(entity, freshNormalized, tenantId) as unknown as Prisma.CompanyCreateInput });
        case "contacts":
          return tx.contact.create({ data: entityCreateData(entity, freshNormalized, tenantId) as unknown as Prisma.ContactCreateInput });
        case "leads":
          return tx.lead.create({ data: entityCreateData(entity, freshNormalized, tenantId) as unknown as Prisma.LeadCreateInput });
        case "opportunities":
          return tx.opportunity.create({ data: entityCreateData(entity, freshNormalized, tenantId) as unknown as Prisma.OpportunityCreateInput });
        case "activities":
          return tx.activity.create({ data: entityCreateData(entity, freshNormalized, tenantId) as unknown as Prisma.ActivityCreateInput });
        case "tasks":
          return tx.task.create({ data: entityCreateData(entity, freshNormalized, tenantId) as unknown as Prisma.TaskCreateInput });
      }
    });

    rowsImported += 1;
    if (created.externalId) {
      existingMaps.external.set(toLookupKey(created.externalId), created.id);
    }
    await prismaClient.importRow.updateMany({
      where: { id: row.id, importJob: { tenantId } },
      data: {
        importedEntity: importedEntityName(entity),
        importedEntityId: created.id,
        normalizedData: executionMeta(freshNormalized, "created"),
      },
    });
  }

  const validRows = job.rows.filter((row) => ((row.normalizedData as Record<string, unknown>).meta as ImportRowExecutionMeta | undefined)?.state === "valid").length;
  const shouldFail = rowsImported === 0 && validRows > 0;
  const executionReport = {
    rowsImported,
    skipped,
    validRows,
    skippedRows,
  };
  const errorLogData = shouldFail
    ? ({
        message: "no-rows-imported",
        explanation: "Valid rows were present but no records were created during execute.",
        executionReport,
      } as Prisma.InputJsonValue)
    : job.errorLog
      ? (job.errorLog as Prisma.InputJsonValue)
      : undefined;

  await prismaClient.importJob.updateMany({
    where: { id: job.id, tenantId },
    data: {
      status: shouldFail ? "FAILED" : "COMPLETED",
      rowsImported,
      ...(errorLogData ? { errorLog: errorLogData } : {}),
      rollbackToken: randomUUID(),
    },
  });

  return { importJobId: job.id, rowsImported, skipped };
}

export async function rollbackImportJob(prismaClient: typeof prisma, tenantId: string, importJobId: string) {
  const job = await prismaClient.importJob.findFirst({ where: { id: importJobId, tenantId }, include: { rows: true } });
  if (!job) throw new Error("import-job-not-found");
  if (job.status === "ROLLED_BACK") return { importJobId, rolledBack: true, deleted: 0 };

  const rowsToDelete = job.rows.filter((row) => row.importedEntityId && row.importedEntity);
  const deletionOrder = ["task", "activity", "opportunity", "lead", "contact", "company"] as const;
  let deleted = 0;

  for (const entity of deletionOrder) {
    const rows = rowsToDelete.filter((row) => row.importedEntity === entity);
    for (const row of rows) {
      if (!row.importedEntityId) continue;
      switch (entity) {
        case "task":
          await prismaClient.task.deleteMany({ where: { tenantId, id: row.importedEntityId } });
          break;
        case "activity":
          await prismaClient.activity.deleteMany({ where: { tenantId, id: row.importedEntityId } });
          break;
        case "opportunity":
          await prismaClient.opportunity.deleteMany({ where: { tenantId, id: row.importedEntityId } });
          break;
        case "lead":
          await prismaClient.lead.deleteMany({ where: { tenantId, id: row.importedEntityId } });
          break;
        case "contact":
          await prismaClient.contact.deleteMany({ where: { tenantId, id: row.importedEntityId } });
          break;
        case "company":
          await prismaClient.company.deleteMany({ where: { tenantId, id: row.importedEntityId } });
          break;
      }
      deleted += 1;
    }
  }

  await prismaClient.importJob.updateMany({
    where: { id: job.id, tenantId },
    data: {
      status: "ROLLED_BACK",
      rollbackToken: job.rollbackToken ?? randomUUID(),
    },
  });

  return { importJobId: job.id, rolledBack: true, deleted };
}

export async function getImportJobDetail(prismaClient: typeof prisma, tenantId: string, importJobId: string) {
  return prismaClient.importJob.findFirst({
    where: { id: importJobId, tenantId },
    include: {
      rows: {
        orderBy: { rowNumber: "asc" },
      },
      tenant: true,
    },
  });
}

export async function listImportJobs(prismaClient: typeof prisma, tenantId: string) {
  return prismaClient.importJob.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    include: { rows: { select: { id: true } } },
    take: 20,
  });
}

export type ImportJobStatsLike = {
  rowsTotal: number;
  rowsImported: number;
  rows: Array<{ normalizedData: Record<string, unknown> }>;
} | null;

export function importJobStats(job: ImportJobStatsLike) {
  if (!job) return null;
  const rows = job.rows.map((row) => row.normalizedData as Record<string, unknown>);
  const rowState = (row: Record<string, unknown>) => {
    const state = (row.meta as { state?: RowState | "imported" } | undefined)?.state ?? "valid";
    return state === "imported" ? "valid" : (state as RowState);
  };
  const valid = rows.filter((row) => rowState(row) === "valid").length;
  const duplicate = rows.filter((row) => rowState(row) === "duplicate").length;
  const invalid = rows.filter((row) => rowState(row) === "invalid").length;
  return { total: job.rowsTotal, valid, duplicate, invalid, imported: job.rowsImported };
}

type ImportExecutionRowLike = { rowNumber: number; normalizedData: Record<string, unknown>; importedEntityId?: string | null; importedEntity?: string | null };
type ImportJobExecutionStatsLike = Omit<NonNullable<ImportJobStatsLike>, "rows"> & { rows: ImportExecutionRowLike[] };

export function importJobExecutionStats(job: ImportJobExecutionStatsLike) {
  if (!job) return null;
  const rows = job.rows.map((row) => {
    const meta = (row.normalizedData.meta as ImportRowExecutionMeta | undefined) ?? {};
    const result: RowExecutionResult | null =
      meta.executionResult ??
      (row.importedEntityId ? "created" : meta.state === "invalid" ? "invalid" : meta.state === "duplicate" ? executionResultFromPreview(meta) ?? "duplicate_existing" : null);
    return { rowNumber: row.rowNumber, result };
  });
  const created = rows.filter((row) => row.result === "created").length;
  const duplicateExisting = rows.filter((row) => row.result === "duplicate_existing").length;
  const duplicateInFile = rows.filter((row) => row.result === "duplicate_in_file").length;
  const invalid = rows.filter((row) => row.result === "invalid").length;
  const skipped = duplicateExisting + duplicateInFile + invalid;
  return {
    created,
    duplicateExisting,
    duplicateInFile,
    invalid,
    skipped,
    skippedRows: rows.filter((row) => row.result && row.result !== "created").map((row) => ({ rowNumber: row.rowNumber, reason: row.result as Exclude<RowExecutionResult, "created"> })),
  };
}
