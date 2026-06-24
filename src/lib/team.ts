import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type TeamUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  lastLoginAt: Date | null;
};

/** All active users for the tenant — used in owner dropdowns */
export async function getTeamUsers(
  prismaClient: PrismaClient | typeof prisma,
  tenantId: string,
): Promise<TeamUser[]> {
  return prismaClient.user.findMany({
    where: { tenantId, isActive: true },
    select: { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true },
    orderBy: { name: "asc" },
  });
}

/** All users including inactive — for /users admin page */
export async function getAllTeamUsers(
  prismaClient: PrismaClient | typeof prisma,
  tenantId: string,
): Promise<TeamUser[]> {
  return prismaClient.user.findMany({
    where: { tenantId },
    select: { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
}

async function fetchAllTags(
  prismaClient: PrismaClient | typeof prisma,
  tenantId: string,
): Promise<string[]> {
  const results = await prismaClient.$queryRaw<Array<{ tag: string }>>`
    SELECT DISTINCT unnest(tags) AS tag
    FROM (
      SELECT tags FROM "Company" WHERE "tenantId" = ${tenantId} AND array_length(tags, 1) > 0
      UNION ALL
      SELECT tags FROM "Contact" WHERE "tenantId" = ${tenantId} AND array_length(tags, 1) > 0
      UNION ALL
      SELECT tags FROM "Lead"    WHERE "tenantId" = ${tenantId} AND array_length(tags, 1) > 0
    ) t
    ORDER BY tag
  `;
  return results.map((r) => r.tag).filter(Boolean);
}

function tagsToProjects(tags: string[]): Array<{ slug: string; label: string }> {
  return tags
    .filter((t) => t.startsWith("project:"))
    .map((t) => ({
      slug: t.replace("project:", ""),
      label: t
        .replace("project:", "")
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" "),
    }));
}

/** All distinct tags split into free tags and project suggestions — single DB query */
export async function getTagsAndProjects(
  prismaClient: PrismaClient | typeof prisma,
  tenantId: string,
): Promise<{ tagSuggestions: string[]; projectSuggestions: Array<{ slug: string; label: string }> }> {
  const all = await fetchAllTags(prismaClient, tenantId);
  return {
    tagSuggestions: all.filter((t) => !t.startsWith("project:")),
    projectSuggestions: tagsToProjects(all),
  };
}

/** @deprecated Use getTagsAndProjects to avoid a second DB round-trip */
export async function getTagSuggestions(
  prismaClient: PrismaClient | typeof prisma,
  tenantId: string,
): Promise<string[]> {
  const tags = await fetchAllTags(prismaClient, tenantId);
  return tags.filter((t) => !t.startsWith("project:"));
}

/** @deprecated Use getTagsAndProjects to avoid a second DB round-trip */
export async function getProjectSuggestions(
  prismaClient: PrismaClient | typeof prisma,
  tenantId: string,
): Promise<Array<{ slug: string; label: string }>> {
  return tagsToProjects(await fetchAllTags(prismaClient, tenantId));
}

/** Human-readable label from a project tag */
export function projectLabel(tag: string): string {
  return tag
    .replace("project:", "")
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
