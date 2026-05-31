import type { Prisma } from "@prisma/client";
import { readParam, type SearchParamsInput } from "@/lib/crm-filters";
import { normalizeTagList, projectTagsFromValue } from "@/lib/tagging";

type CurrentUser = { id: string; tenantId: string };
export type OpportunityStatusFilter = "open" | "won" | "lost";

const contains = (value: string) => ({ contains: value, mode: "insensitive" as const });
function appendWhereAnd<T>(existing: T | T[] | undefined, clause: T) {
  return [...(Array.isArray(existing) ? existing : existing ? [existing] : []), clause];
}

export function parseOpportunityFilters(params: SearchParamsInput) {
  const status = readParam(params, "status");
  return {
    q: readParam(params, "q"),
    owner: readParam(params, "owner"),
    stageId: readParam(params, "stageId"),
    companyId: readParam(params, "companyId"),
    contactId: readParam(params, "contactId"),
    status: status === "open" || status === "won" || status === "lost" ? status : undefined,
    tag: normalizeTagList(readParam(params, "tag")),
    project: projectTagsFromValue(readParam(params, "project")),
  };
}

export function buildOpportunityWhere(params: SearchParamsInput, user: CurrentUser): Prisma.OpportunityWhereInput {
  const filters = parseOpportunityFilters(params);
  const where: Prisma.OpportunityWhereInput = { tenantId: user.tenantId };

  if (filters.owner === "me") where.ownerId = user.id;
  if (filters.stageId) where.stageId = filters.stageId;
  if (filters.companyId) where.companyId = filters.companyId;
  if (filters.contactId) where.contactId = filters.contactId;
  if (filters.tag.length > 0 || filters.project.length > 0) {
    const tags = [...filters.tag, ...filters.project];
    where.AND = appendWhereAnd(where.AND, {
      OR: [
        { company: { is: { tags: { hasSome: tags } } } },
        { contact: { is: { tags: { hasSome: tags } } } },
        { sourceLead: { is: { tags: { hasSome: tags } } } },
        { sourceLead: { is: { company: { is: { tags: { hasSome: tags } } } } } },
      ],
    } as Prisma.OpportunityWhereInput);
  }
  if (filters.status === "won") where.stage = { isWon: true };
  if (filters.status === "lost") where.stage = { isLost: true };
  if (filters.status === "open") where.stage = { isWon: false, isLost: false };
  if (filters.q) {
    where.OR = [
      { title: contains(filters.q) },
      { notes: contains(filters.q) },
      { company: { is: { name: contains(filters.q) } } },
      { contact: { is: { firstName: contains(filters.q) } } },
      { contact: { is: { lastName: contains(filters.q) } } },
    ];
  }

  return where;
}
