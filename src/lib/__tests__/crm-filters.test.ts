import { describe, expect, it } from "vitest";
import { buildCompanyWhere, buildContactWhere, buildLeadWhere, parseCompanyFilters, parseContactFilters, parseLeadFilters } from "@/lib/crm-filters";

const user = { id: "user-1", tenantId: "tenant-1" };

describe("CRM filters", () => {
  it("parses tag and project filters", () => {
    const filters = parseCompanyFilters({ tag: "Scuole;PNRR", project: "Scuole Roma" });
    expect(filters.tag).toEqual(["Scuole", "PNRR"]);
    expect(filters.project).toEqual(["project:scuole-roma"]);
    expect(parseContactFilters({ tag: "alpha", project: "Beta" }).project).toEqual(["project:beta"]);
    expect(parseLeadFilters({ tag: "alpha", project: "Beta" }).tag).toEqual(["alpha"]);
  });

  it("builds company where clauses with tag and project filters", () => {
    const where = buildCompanyWhere({ tag: "Scuole", project: "Scuole Roma", owner: "me", region: "Lombardia", province: "MI" }, user);

    expect(where.tenantId).toBe("tenant-1");
    expect(where.ownerId).toBe("user-1");
    expect(where.region).toEqual({ contains: "Lombardia", mode: "insensitive" });
    expect(where.province).toEqual({ contains: "MI", mode: "insensitive" });
    expect(where.tags).toEqual({ hasSome: ["Scuole"] });
    expect(where.AND).toEqual([{ tags: { hasSome: ["project:scuole-roma"] } }]);
  });

  it("builds contact and lead where clauses with tag/project filters", () => {
    const contactWhere = buildContactWhere({ tag: "Scuole", project: "Scuole Roma", owner: "me" }, user);
    const leadWhere = buildLeadWhere({ tag: "Scuole", project: "Scuole Roma", owner: "me" }, user);

    expect(contactWhere.AND).toEqual([{ tags: { hasSome: ["project:scuole-roma"] } }]);
    expect(leadWhere.AND).toEqual([{ tags: { hasSome: ["project:scuole-roma"] } }]);
  });
});
