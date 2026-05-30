import { describe, expect, it } from "vitest";
import { companySchema, contactSchema, leadSchema, loginSchema } from "@/lib/validators";

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
      title: "Nuova opportunità enterprise",
      status: "QUALIFIED",
      score: "82",
      estimatedValue: "25000.50",
      tags: "priority",
    });

    expect(parsed.score).toBe(82);
    expect(parsed.estimatedValue).toBe(25000.5);
    expect(parsed.tags).toEqual(["priority"]);
  });

  it("requires login passwords with at least eight characters", () => {
    expect(loginSchema.safeParse({ email: "admin@example.com", password: "short" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "admin@example.com", password: "ChangeMe123!" }).success).toBe(true);
  });
});
