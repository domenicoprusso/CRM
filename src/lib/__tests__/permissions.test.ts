import { describe, expect, it } from "vitest";
import type { Role } from "@prisma/client";
import { can } from "@/lib/permissions";

const roles: Role[] = ["ADMIN", "MANAGER", "SALES", "SUPPORT", "VIEWER"];

describe("RBAC permissions", () => {
  it("allows every role to read the dashboard", () => {
    for (const role of roles) {
      expect(can(role, "dashboard:read")).toBe(true);
    }
  });

  it("limits destructive CRM writes for support and viewer roles", () => {
    expect(can("SUPPORT", "company:write")).toBe(false);
    expect(can("VIEWER", "contact:write")).toBe(false);
    expect(can("VIEWER", "lead:write")).toBe(false);
  });

  it("reserves user management for admins", () => {
    expect(can("ADMIN", "user:manage")).toBe(true);
    expect(can("MANAGER", "user:manage")).toBe(false);
    expect(can("SALES", "user:manage")).toBe(false);
  });

  it("allows sales to manage opportunities but keeps pipeline configuration restricted", () => {
    expect(can("SALES", "opportunity:read")).toBe(true);
    expect(can("SALES", "opportunity:write")).toBe(true);
    expect(can("SALES", "pipeline:read")).toBe(true);
    expect(can("SALES", "pipeline:write")).toBe(false);
    expect(can("SALES", "reports:read")).toBe(true);
    expect(can("SALES", "reports:export")).toBe(true);
    expect(can("SALES", "task:write")).toBe(true);
    expect(can("SALES", "activity:write")).toBe(true);
  });

  it("keeps support and viewer roles read-only for opportunities", () => {
    expect(can("SUPPORT", "opportunity:read")).toBe(true);
    expect(can("SUPPORT", "opportunity:write")).toBe(false);
    expect(can("VIEWER", "opportunity:read")).toBe(true);
    expect(can("VIEWER", "opportunity:write")).toBe(false);
    expect(can("SUPPORT", "reports:export")).toBe(false);
    expect(can("VIEWER", "reports:export")).toBe(false);
    expect(can("VIEWER", "task:write")).toBe(false);
    expect(can("VIEWER", "activity:write")).toBe(false);
  });
});
