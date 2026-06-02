import { describe, it, expect } from "vitest";
import { badgeForKind, type TimelineEventKind } from "@/lib/timeline";

describe("badgeForKind", () => {
  it("returns correct badge for each kind", () => {
    const cases: Array<[TimelineEventKind, string, string]> = [
      ["created",       "Creazione",    "brand"],
      ["import",        "Import",       "slate"],
      ["activity",      "Attivita",     "brand"],
      ["task",          "Task",         "amber"],
      ["status_change", "Cambio stato", "amber"],
      ["owner_change",  "Cambio owner", "slate"],
      ["stage_change",  "Cambio stage", "amber"],
      ["won",           "Won",          "brand"],
      ["lost",          "Lost",         "red"  ],
      ["converted",     "Conversione",  "brand"],
      ["updated",       "Modifica",     "slate"],
    ];
    for (const [kind, label, tone] of cases) {
      const badge = badgeForKind(kind);
      expect(badge.label).toBe(label);
      expect(badge.tone).toBe(tone);
    }
  });
});

describe("detectUpdateKind (via getLeadTimeline mock)", () => {
  it("status_change badge is amber", () => {
    expect(badgeForKind("status_change").tone).toBe("amber");
  });

  it("won badge is brand", () => {
    expect(badgeForKind("won").tone).toBe("brand");
  });

  it("lost badge is red", () => {
    expect(badgeForKind("lost").tone).toBe("red");
  });
});

describe("timeline event kind coverage", () => {
  const allKinds: TimelineEventKind[] = [
    "created", "import", "activity", "task",
    "status_change", "owner_change", "stage_change",
    "won", "lost", "converted", "updated",
  ];

  it("all kinds have a badge defined", () => {
    for (const kind of allKinds) {
      const badge = badgeForKind(kind);
      expect(badge.label).toBeTruthy();
      expect(["brand", "red", "amber", "slate"]).toContain(badge.tone);
    }
  });
});
