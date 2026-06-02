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

/** Distinct free tags (non-project) across all taggable entities */
export async function getTagSuggestions(
  prismaClient: PrismaClient | typeof prisma,
  tenantId: string,
): Promise<string[]> {
  const results = await prismaClient.$queryRaw<Array<{ tag: string }>>`
    SELECT DISTINCT unnest(tags) AS tag
    FROM (
      SELECT tags FROM "Company" WHERE "tenantId" = ${tenantId}
      UNION ALL
      SELECT tags FROM "Contact" WHERE "tenantId" = ${tenantId}
      UNION ALL
      SELECT tags FROM "Lead"    WHERE "tenantId" = ${tenantId}
    ) t
    WHERE array_length(tags, 1) > 0
    ORDER BY tag
  `;
  return results
    .map((r) => r.tag)
    .filter((t) => t && !t.startsWith("project:"));
}

/** Distinct project slugs → human-readable labels */
export async function getProjectSuggestions(
  prismaClient: PrismaClient | typeof prisma,
  tenantId: string,
): Promise<Array<{ slug: string; label: string }>> {
  const results = await prismaClient.$queryRaw<Array<{ tag: string }>>`
    SELECT DISTINCT unnest(tags) AS tag
    FROM (
      SELECT tags FROM "Company" WHERE "tenantId" = ${tenantId}
      UNION ALL
      SELECT tags FROM "Contact" WHERE "tenantId" = ${tenantId}
      UNION ALL
      SELECT tags FROM "Lead"    WHERE "tenantId" = ${tenantId}
    ) t
    WHERE array_length(tags, 1) > 0
    ORDER BY tag
  `;
  return results
    .map((r) => r.tag)
    .filter((t) => t?.startsWith("project:"))
    .map((t) => ({
      slug: t.replace("project:", ""),
      label: t
        .replace("project:", "")
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" "),
    }));
}

/** Human-readable label from a project tag */
export function projectLabel(tag: string): string {
  return tag
    .replace("project:", "")
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
