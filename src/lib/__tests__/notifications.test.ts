import { describe, expect, it } from "vitest";

import { buildNotificationSnapshot } from "@/lib/notifications";

describe("notification snapshot", () => {
  it("builds categories and stable fingerprints from existing CRM data", () => {
    const snapshot = buildNotificationSnapshot({
      overdueTasks: [
        {
          id: "task-1",
          title: "Richiamare cliente",
          dueAt: new Date("2026-05-30T10:00:00Z"),
          reminderAt: null,
          priority: "HIGH",
          company: { name: "Acme" },
          contact: null,
          lead: null,
          opportunity: null,
        },
      ],
      dueTodayTasks: [
        {
          id: "task-2",
          title: "Inviare preventivo",
          dueAt: new Date("2026-05-31T10:00:00Z"),
          reminderAt: null,
          priority: "MEDIUM",
          company: null,
          contact: { firstName: "Giulia", lastName: "Rossi" },
          lead: null,
          opportunity: null,
        },
      ],
      followupTodayTasks: [
        {
          id: "task-3",
          title: "Seguire demo",
          dueAt: null,
          reminderAt: new Date("2026-05-31T14:30:00Z"),
          priority: "LOW",
          company: null,
          contact: null,
          lead: { title: "Lead qualificato" },
          opportunity: null,
        },
      ],
      opportunitiesWithoutNextAction: [
        {
          id: "opp-1",
          title: "Migrazione CRM",
          company: { name: "Beta" },
          owner: { name: "Mario" },
          stage: { name: "Proposta" },
        },
      ],
    });

    expect(snapshot.totalCount).toBe(4);
    expect(snapshot.sections).toHaveLength(4);
    expect(snapshot.sections[0].count).toBe(1);
    expect(snapshot.sections[0].items[0].fingerprint).toBe("task:overdue:task-1");
    expect(snapshot.sections[1].items[0].fingerprint).toBe("task:due-today:task-2");
    expect(snapshot.sections[2].items[0].fingerprint).toBe("task:followup-today:task-3");
    expect(snapshot.sections[3].items[0].fingerprint).toBe("opportunity:no-next-action:opp-1");
  });
});
