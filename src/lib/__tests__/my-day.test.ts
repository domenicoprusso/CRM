import { describe, it, expect, vi } from "vitest";
import { getMyDaySnapshot, MY_DAY_LIMIT } from "@/lib/my-day";

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: "t1",
    title: "Task test",
    status: "TODO",
    priority: "MEDIUM",
    dueAt: null,
    reminderAt: null,
    company: null,
    contact: null,
    lead: null,
    opportunity: null,
    ...overrides,
  };
}

function makeOpportunity(overrides: Record<string, unknown> = {}) {
  return {
    id: "o1",
    title: "Opp test",
    value: { toString: () => "1000" },
    probability: 50,
    expectedCloseDate: null,
    company: null,
    stage: { id: "s1", name: "Proposta", isWon: false, isLost: false },
    ...overrides,
  };
}

function makeLead(overrides: Record<string, unknown> = {}) {
  return {
    id: "l1",
    title: "Lead test",
    score: 50,
    estimatedValue: null,
    source: null,
    company: null,
    contact: null,
    ...overrides,
  };
}


describe("getMyDaySnapshot", () => {
  it("returns empty snapshot when no data", async () => {
    const db = {
      task: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
      },
      opportunity: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
      },
      lead: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const snapshot = await getMyDaySnapshot(db as never, "tenant1", "user1");

    expect(snapshot.overdueTotal).toBe(0);
    expect(snapshot.overdueTasks).toHaveLength(0);
    expect(snapshot.dueTodayTotal).toBe(0);
    expect(snapshot.dueTodayTasks).toHaveLength(0);
    expect(snapshot.followupTodayTotal).toBe(0);
    expect(snapshot.followupTodayTasks).toHaveLength(0);
    expect(snapshot.opportunitiesWithoutNextActionTotal).toBe(0);
    expect(snapshot.opportunitiesWithoutNextAction).toHaveLength(0);
    expect(snapshot.newLeadsTotal).toBe(0);
    expect(snapshot.newLeads).toHaveLength(0);
  });

  it("returns today label in Italian", async () => {
    const db = {
      task: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
      opportunity: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
      lead: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
    };

    const fixedDate = new Date(2026, 5, 2); // 2 giugno 2026
    const snapshot = await getMyDaySnapshot(db as never, "tenant1", "user1", fixedDate);

    expect(snapshot.today).toContain("2026");
    expect(typeof snapshot.today).toBe("string");
    expect(snapshot.today.length).toBeGreaterThan(5);
  });

  it("maps overdue tasks correctly", async () => {
    const task = makeTask({ id: "t1", title: "Chiamata urgente", dueAt: new Date(2026, 4, 1) });
    const db = {
      task: {
        count: vi.fn().mockResolvedValue(1),
        findMany: vi.fn().mockResolvedValue([task]),
      },
      opportunity: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
      lead: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
    };

    const snapshot = await getMyDaySnapshot(db as never, "tenant1", "user1");

    expect(snapshot.overdueTotal).toBe(1);
    expect(snapshot.overdueTasks[0]).toMatchObject({ id: "t1", title: "Chiamata urgente" });
  });

  it("maps opportunities without next action correctly", async () => {
    const opp = makeOpportunity({ id: "o1", title: "Deal Comune Roma" });
    const db = {
      task: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
      opportunity: {
        count: vi.fn().mockResolvedValue(1),
        findMany: vi.fn().mockResolvedValue([opp]),
      },
      lead: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
    };

    const snapshot = await getMyDaySnapshot(db as never, "tenant1", "user1");

    expect(snapshot.opportunitiesWithoutNextActionTotal).toBe(1);
    expect(snapshot.opportunitiesWithoutNextAction[0]).toMatchObject({
      id: "o1",
      title: "Deal Comune Roma",
      value: "1000",
    });
  });

  it("maps new leads correctly", async () => {
    const lead = makeLead({ id: "l1", title: "Lead Scuola Milano", score: 80 });
    const db = {
      task: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
      opportunity: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
      lead: {
        count: vi.fn().mockResolvedValue(1),
        findMany: vi.fn().mockResolvedValue([lead]),
      },
    };

    const snapshot = await getMyDaySnapshot(db as never, "tenant1", "user1");

    expect(snapshot.newLeadsTotal).toBe(1);
    expect(snapshot.newLeads[0]).toMatchObject({ id: "l1", title: "Lead Scuola Milano", score: 80 });
  });

  it("MY_DAY_LIMIT is 10", () => {
    expect(MY_DAY_LIMIT).toBe(10);
  });

  it("queries task with ownerId filter", async () => {
    const taskCount = vi.fn().mockResolvedValue(0);
    const taskFindMany = vi.fn().mockResolvedValue([]);
    const db = {
      task: { count: taskCount, findMany: taskFindMany },
      opportunity: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
      lead: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
    };

    await getMyDaySnapshot(db as never, "tenant-abc", "user-xyz");

    const firstCountCall = taskCount.mock.calls[0][0];
    expect(firstCountCall.where.ownerId).toBe("user-xyz");
    expect(firstCountCall.where.tenantId).toBe("tenant-abc");
  });

  it("queries opportunity with ownerId filter", async () => {
    const oppCount = vi.fn().mockResolvedValue(0);
    const oppFindMany = vi.fn().mockResolvedValue([]);
    const db = {
      task: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
      opportunity: { count: oppCount, findMany: oppFindMany },
      lead: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
    };

    await getMyDaySnapshot(db as never, "tenant-abc", "user-xyz");

    const countCall = oppCount.mock.calls[0][0];
    expect(countCall.where.ownerId).toBe("user-xyz");
    expect(countCall.where.tenantId).toBe("tenant-abc");
  });

  it("queries lead with ownerId and status NEW filter", async () => {
    const leadCount = vi.fn().mockResolvedValue(0);
    const leadFindMany = vi.fn().mockResolvedValue([]);
    const db = {
      task: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
      opportunity: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
      lead: { count: leadCount, findMany: leadFindMany },
    };

    await getMyDaySnapshot(db as never, "tenant-abc", "user-xyz");

    const countCall = leadCount.mock.calls[0][0];
    expect(countCall.where.ownerId).toBe("user-xyz");
    expect(countCall.where.status).toBe("NEW");
  });
});
