import { LeadStatus, type Prisma } from "@prisma/client";
import { normalizeTagList, projectTagsFromValue } from "@/lib/tagging";

export type SearchParamsInput = Record<string, string | string[] | undefined>;
type CurrentUser = { id: string; tenantId: string };

const contains = (value: string) => ({ contains: value, mode: "insensitive" as const });
const tagContains = (tags: string[]) => ({ hasSome: tags });
function appendWhereAnd<T>(existing: T | T[] | undefined, clause: T) {
  return [...(Array.isArray(existing) ? existing : existing ? [existing] : []), clause];
}

export function readParam(params: SearchParamsInput, key: string) {
  const value = params[key];
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

export function parseCompanyFilters(params: SearchParamsInput) {
  return {
    q: readParam(params, "q"),
    owner: readParam(params, "owner"),
    industry: readParam(params, "industry"),
    country: readParam(params, "country"),
    tag: normalizeTagList(readParam(params, "tag")),
    project: projectTagsFromValue(readParam(params, "project")),
  };
}

export function buildCompanyWhere(params: SearchParamsInput, user: CurrentUser): Prisma.CompanyWhereInput {
  const filters = parseCompanyFilters(params);
  const where: Prisma.CompanyWhereInput = { tenantId: user.tenantId };

  if (filters.owner === "me") where.ownerId = user.id;
  if (filters.industry) where.industry = contains(filters.industry);
  if (filters.country) where.country = contains(filters.country);
  if (filters.tag.length > 0) where.tags = tagContains(filters.tag);
  if (filters.project.length > 0) {
    where.AND = appendWhereAnd(where.AND, { tags: tagContains(filters.project) });
  }
  if (filters.q) {
    where.OR = [
      { name: contains(filters.q) },
      { industry: contains(filters.q) },
      { email: contains(filters.q) },
      { phone: contains(filters.q) },
      { city: contains(filters.q) },
      { country: contains(filters.q) },
      { notes: contains(filters.q) },
    ];
  }

  return where;
}

export function parseContactFilters(params: SearchParamsInput) {
  const lifecycle = readParam(params, "lifecycle");
  return {
    q: readParam(params, "q"),
    owner: readParam(params, "owner"),
    lifecycle: lifecycle && Object.values(LeadStatus).includes(lifecycle as LeadStatus) ? (lifecycle as LeadStatus) : undefined,
    companyId: readParam(params, "companyId"),
    tag: normalizeTagList(readParam(params, "tag")),
    project: projectTagsFromValue(readParam(params, "project")),
  };
}

export function buildContactWhere(params: SearchParamsInput, user: CurrentUser): Prisma.ContactWhereInput {
  const filters = parseContactFilters(params);
  const where: Prisma.ContactWhereInput = { tenantId: user.tenantId };

  if (filters.owner === "me") where.ownerId = user.id;
  if (filters.lifecycle) where.lifecycle = filters.lifecycle;
  if (filters.companyId) where.companyId = filters.companyId;
  if (filters.tag.length > 0) where.tags = tagContains(filters.tag);
  if (filters.project.length > 0) where.AND = appendWhereAnd(where.AND, { tags: tagContains(filters.project) });
  if (filters.q) {
    where.OR = [
      { firstName: contains(filters.q) },
      { lastName: contains(filters.q) },
      { email: contains(filters.q) },
      { phone: contains(filters.q) },
      { jobTitle: contains(filters.q) },
      { notes: contains(filters.q) },
      { company: { is: { name: contains(filters.q) } } },
    ];
  }

  return where;
}

export function parseLeadFilters(params: SearchParamsInput) {
  const status = readParam(params, "status");
  const scoreMin = Number(readParam(params, "scoreMin"));
  return {
    q: readParam(params, "q"),
    owner: readParam(params, "owner"),
    status: status && Object.values(LeadStatus).includes(status as LeadStatus) ? (status as LeadStatus) : undefined,
    companyId: readParam(params, "companyId"),
    contactId: readParam(params, "contactId"),
    scoreMin: Number.isFinite(scoreMin) && scoreMin >= 0 && scoreMin <= 100 ? scoreMin : undefined,
    tag: normalizeTagList(readParam(params, "tag")),
    project: projectTagsFromValue(readParam(params, "project")),
  };
}

export function buildLeadWhere(params: SearchParamsInput, user: CurrentUser): Prisma.LeadWhereInput {
  const filters = parseLeadFilters(params);
  const where: Prisma.LeadWhereInput = { tenantId: user.tenantId };

  if (filters.owner === "me") where.ownerId = user.id;
  if (filters.status) where.status = filters.status;
  if (filters.companyId) where.companyId = filters.companyId;
  if (filters.contactId) where.contactId = filters.contactId;
  if (filters.scoreMin !== undefined) where.score = { gte: filters.scoreMin };
  if (filters.tag.length > 0) where.tags = tagContains(filters.tag);
  if (filters.project.length > 0) where.AND = appendWhereAnd(where.AND, { tags: tagContains(filters.project) });
  if (filters.q) {
    where.OR = [
      { title: contains(filters.q) },
      { source: contains(filters.q) },
      { notes: contains(filters.q) },
      { company: { is: { name: contains(filters.q) } } },
      { contact: { is: { firstName: contains(filters.q) } } },
      { contact: { is: { lastName: contains(filters.q) } } },
    ];
  }

  return where;
}
