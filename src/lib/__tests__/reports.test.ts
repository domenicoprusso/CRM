import { describe, expect, it } from "vitest";
import { buildConversionMetrics, buildCountRows, buildForecastRows, buildPipelineRows, buildTaskRows, buildWonLostMetrics, parseReportFilters, toCsv } from "@/lib/reports";

describe("report helpers", () => {
  it("parses report filters with sane defaults", () => {
    const now = new Date("2026-05-31T10:00:00Z");
    const filters = parseReportFilters({}, now);

    expect(filters.from.getFullYear()).toBe(2026);
    expect(filters.from.getMonth()).toBe(4);
    expect(filters.from.getDate()).toBe(1);
    expect(filters.ownerId).toBeUndefined();
    expect(filters.tag).toEqual([]);
    expect(filters.project).toEqual([]);
  });

  it("parses report tag and project filters", () => {
    const filters = parseReportFilters({ tag: "Scuole;PNRR", project: "Scuole Roma" }, new Date("2026-05-31T10:00:00Z"));

    expect(filters.tag).toEqual(["Scuole", "PNRR"]);
    expect(filters.project).toEqual(["project:scuole-roma"]);
  });

  it("builds pipeline and forecast rows", () => {
    const stages = [
      { id: "s1", name: "Qualifica", order: 10, color: "#2563eb", isWon: false, isLost: false },
      { id: "s2", name: "Proposta", order: 20, color: "#7c3aed", isWon: false, isLost: false },
    ];
    const openOpps = [
      { stageId: "s1", value: "1000.00", probability: 20 },
      { stageId: "s2", value: "2000.00", probability: 50 },
      { stageId: "s2", value: "3000.00", probability: 50 },
    ];

    const pipelineRows = buildPipelineRows(stages, openOpps);
    const forecastRows = buildForecastRows([
      { ownerId: "u1", owner: { id: "u1", name: "Alice" }, value: "1000.00", probability: 20 },
      { ownerId: "u1", owner: { id: "u1", name: "Alice" }, value: "2000.00", probability: 50 },
      { ownerId: "u2", owner: { id: "u2", name: "Bob" }, value: "3000.00", probability: 50 },
    ]);

    expect(pipelineRows[0].count).toBe(1);
    expect(pipelineRows[1].value).toBe(5000);
    expect(forecastRows[0].ownerName).toBe("Bob");
    expect(forecastRows[0].weightedValue).toBe(1500);
  });

  it("computes conversion and won/lost metrics", () => {
    expect(buildConversionMetrics(20, 5)).toEqual({
      leadsCreated: 20,
      opportunitiesCreatedFromLeads: 5,
      conversionRate: 0.25,
    });
    expect(buildConversionMetrics(2, 3).conversionRate).toBe(1);

    expect(buildWonLostMetrics(8, 2)).toEqual({
      closedWon: 8,
      closedLost: 2,
      wonRate: 0.8,
      lostRate: 0.2,
    });
  });

  it("builds owner count rows and csv exports", () => {
    const rows = buildCountRows(
      [
        { ownerId: "u1", count: 3 },
        { ownerId: null, count: 1 },
      ],
      [
        { id: "u1", name: "Alice" },
      ],
    );
    const taskRows = buildTaskRows(
      [{ ownerId: "u1", count: 2, urgentCount: 1 }],
      [{ id: "u1", name: "Alice" }],
    );

    expect(rows[0].ownerName).toBe("Alice");
    expect(taskRows[0].count).toBe(2);
    expect(taskRows[0].urgentCount).toBe(1);
    expect(toCsv(["a", "b"], [{ a: "hello", b: "x,y" }])).toContain('"x,y"');
  });
});
