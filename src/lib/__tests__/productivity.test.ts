import { describe, expect, it } from "vitest";
import { TaskPriority, TaskStatus } from "@prisma/client";
import { buildActivityWhere, buildTaskWhere, getNextOpenTaskForOpportunity, parseActivityFilters, parseTaskFilters } from "@/lib/productivity";

const user = { id: "user-1", tenantId: "tenant-1" };

describe("productivity helpers", () => {
  it("parses task filters and builds owner scoped queries", () => {
    const filters = parseTaskFilters({ q: "demo", owner: "me", status: "TODO", priority: "HIGH", due: "overdue", tag: "Scuole", project: "Scuole Roma" });
    expect(filters.owner).toBe("me");
    expect(filters.status).toBe(TaskStatus.TODO);
    expect(filters.priority).toBe(TaskPriority.HIGH);
    expect(filters.due).toBe("overdue");
    expect(filters.tag).toEqual(["Scuole"]);
    expect(filters.project).toEqual(["project:scuole-roma"]);

    const where = buildTaskWhere({ q: "demo", owner: "me", status: "TODO", priority: "HIGH", due: "overdue", tag: "Scuole", project: "Scuole Roma" }, user, new Date("2026-05-31T10:00:00Z"));
    expect(where.tenantId).toBe("tenant-1");
    expect(where.ownerId).toBe("user-1");
    expect(where.AND).toEqual([
      {
        OR: [
          { company: { is: { tags: { hasSome: ["Scuole", "project:scuole-roma"] } } } },
          { contact: { is: { tags: { hasSome: ["Scuole", "project:scuole-roma"] } } } },
          { lead: { is: { tags: { hasSome: ["Scuole", "project:scuole-roma"] } } } },
          { opportunity: { is: { company: { is: { tags: { hasSome: ["Scuole", "project:scuole-roma"] } } } } } },
          { opportunity: { is: { contact: { is: { tags: { hasSome: ["Scuole", "project:scuole-roma"] } } } } } },
          { opportunity: { is: { sourceLead: { is: { tags: { hasSome: ["Scuole", "project:scuole-roma"] } } } } } },
          { opportunity: { is: { sourceLead: { is: { company: { is: { tags: { hasSome: ["Scuole", "project:scuole-roma"] } } } } } } } },
        ],
      },
    ]);
  });

  it("parses activity filters and builds entity scoped queries", () => {
    const filters = parseActivityFilters({ q: "call", owner: "me", type: "CALL", entityType: "opportunity", entityId: "opp-1", tag: "Scuole", project: "Scuole Roma" });
    expect(filters.type).toBe("CALL");
    expect(filters.entityType).toBe("opportunity");
    expect(filters.project).toEqual(["project:scuole-roma"]);

    const where = buildActivityWhere({ q: "call", owner: "me", type: "CALL", entityType: "opportunity", entityId: "opp-1", tag: "Scuole", project: "Scuole Roma" }, user);
    expect(where.tenantId).toBe("tenant-1");
    expect(where.userId).toBe("user-1");
    expect(where.opportunityId).toBe("opp-1");
    expect(where.AND).toEqual([
      {
        OR: [
          { company: { is: { tags: { hasSome: ["Scuole", "project:scuole-roma"] } } } },
          { contact: { is: { tags: { hasSome: ["Scuole", "project:scuole-roma"] } } } },
          { lead: { is: { tags: { hasSome: ["Scuole", "project:scuole-roma"] } } } },
          { opportunity: { is: { company: { is: { tags: { hasSome: ["Scuole", "project:scuole-roma"] } } } } } },
          { opportunity: { is: { contact: { is: { tags: { hasSome: ["Scuole", "project:scuole-roma"] } } } } } },
          { opportunity: { is: { sourceLead: { is: { tags: { hasSome: ["Scuole", "project:scuole-roma"] } } } } } },
          { opportunity: { is: { sourceLead: { is: { company: { is: { tags: { hasSome: ["Scuole", "project:scuole-roma"] } } } } } } } },
        ],
      },
    ]);
  });

  it("selects the nearest open task as next action", async () => {
    const prismaMock = {
      task: {
        findMany: async () => [
          { id: "t1", title: "Follow up", dueAt: new Date("2026-06-02"), priority: TaskPriority.MEDIUM, owner: { name: "Alice" } },
          { id: "t2", title: "Call back", dueAt: new Date("2026-06-01"), priority: TaskPriority.LOW, owner: { name: "Bob" } },
          { id: "t3", title: "Urgent", dueAt: new Date("2026-06-01"), priority: TaskPriority.URGENT, owner: { name: "Claire" } },
        ],
      },
    } as unknown as Parameters<typeof getNextOpenTaskForOpportunity>[0];

    const task = await getNextOpenTaskForOpportunity(prismaMock, "tenant-1", "opp-1");
    expect(task?.id).toBe("t3");
  });
});
