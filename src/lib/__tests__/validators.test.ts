import { describe, expect, it } from "vitest";
import {
  activitySchema,
  activityUpdateSchema,
  importEntitySchema,
  importSourceSchema,
  companySchema,
  contactSchema,
  contactUpdateSchema,
  leadConversionSchema,
  leadSchema,
  leadUpdateSchema,
  loginSchema,
  opportunitySchema,
  opportunityUpdateSchema,
  taskSchema,
  taskUpdateSchema,
} from "@/lib/validators";

describe("CRM validation schemas", () => {
  it("normalizes comma-separated tags for companies", () => {
    const parsed = companySchema.parse({
      name: "Acme Italia",
      email: "info@acme.test",
      website: "https://acme.test",
      tags: "enterprise, hot , migration",
    });

    expect(parsed.tags).toEqual(["enterprise", "hot", "migration"]);
  });

  it("rejects invalid contact emails", () => {
    const parsed = contactSchema.safeParse({
      firstName: "Giulia",
      lastName: "Rossi",
      email: "non-valida",
    });

    expect(parsed.success).toBe(false);
  });

  it("coerces lead score and estimated value from form input", () => {
    const parsed = leadSchema.parse({
      title: "Nuova opportunita enterprise",
      status: "QUALIFIED",
      score: "82",
      estimatedValue: "25000.50",
      tags: "priority",
    });

    expect(parsed.score).toBe(82);
    expect(parsed.estimatedValue).toBe(25000.5);
    expect(parsed.tags).toEqual(["priority"]);
  });

  it("normalizes cleared optional fields to null", () => {
    const parsed = contactSchema.parse({
      firstName: "Giulia",
      lastName: "Rossi",
      email: "",
      companyId: "",
      tags: "",
    });

    expect(parsed.email).toBeNull();
    expect(parsed.companyId).toBeNull();
    expect(parsed.tags).toEqual([]);
  });

  it("allows partial update payloads for contacts and leads", () => {
    expect(contactUpdateSchema.parse({ lifecycle: "QUALIFIED" })).toEqual({ lifecycle: "QUALIFIED" });
    expect(leadUpdateSchema.parse({ expectedCloseDate: "", estimatedValue: "" })).toEqual({
      expectedCloseDate: null,
      estimatedValue: null,
    });
  });

  it("validates opportunity value and probability", () => {
    const parsed = opportunitySchema.parse({
      title: "Migrazione CRM",
      value: "25000.50",
      probability: "75",
      expectedCloseDate: "",
      companyId: "",
    });

    expect(parsed.value).toBe(25000.5);
    expect(parsed.probability).toBe(75);
    expect(parsed.expectedCloseDate).toBeNull();
    expect(parsed.companyId).toBeNull();
  });

  it("allows partial opportunity updates", () => {
    expect(opportunityUpdateSchema.parse({ probability: "100" })).toEqual({ probability: 100 });
  });

  it("validates lead conversion payloads", () => {
    const parsed = leadConversionSchema.parse({
      leadId: "lead-1",
      title: "Conversione lead",
      value: "",
      probability: "20",
    });

    expect(parsed.value).toBe(0);
    expect(parsed.probability).toBe(20);
  });

  it("requires login passwords with at least eight characters", () => {
    expect(loginSchema.safeParse({ email: "admin@example.com", password: "short" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "admin@example.com", password: "ChangeMe123!" }).success).toBe(true);
  });

  it("validates activity payloads", () => {
    const parsed = activitySchema.parse({
      type: "CALL",
      subject: "Richiamare il cliente",
      body: "",
    });

    expect(parsed.body).toBeNull();
    expect(parsed.companyId).toBeUndefined();
    expect(activityUpdateSchema.parse({ subject: "Nota aggiornata" })).toEqual({ subject: "Nota aggiornata" });
  });

  it("validates task payloads with defaults and cleared dates", () => {
    const parsed = taskSchema.parse({
      title: "Seguire demo",
      status: "IN_PROGRESS",
      priority: "HIGH",
      dueAt: "",
      reminderAt: "",
      companyId: "",
    });

    expect(parsed.status).toBe("IN_PROGRESS");
    expect(parsed.priority).toBe("HIGH");
    expect(parsed.dueAt).toBeNull();
    expect(parsed.reminderAt).toBeNull();
    expect(parsed.companyId).toBeNull();
    expect(taskUpdateSchema.parse({ completedAt: "" })).toEqual({ completedAt: null });
  });

  it("validates import entity and source payloads", () => {
    expect(importEntitySchema.parse("companies")).toBe("companies");
    expect(importSourceSchema.parse("TeamSystem CRM")).toBe("TeamSystem CRM");
    expect(importEntitySchema.safeParse("xlsx").success).toBe(false);
  });
});
