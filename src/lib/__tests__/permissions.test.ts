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
});
