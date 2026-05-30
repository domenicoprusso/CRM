import type { Role } from "@prisma/client";

export type Permission =
  | "dashboard:read"
  | "company:read"
  | "company:write"
  | "contact:read"
  | "contact:write"
  | "lead:read"
  | "lead:write"
  | "audit:read"
  | "user:manage";

const rolePermissions: Record<Role, Permission[]> = {
  ADMIN: [
    "dashboard:read",
    "company:read",
    "company:write",
    "contact:read",
    "contact:write",
    "lead:read",
    "lead:write",
    "audit:read",
    "user:manage",
  ],
  MANAGER: [
    "dashboard:read",
    "company:read",
    "company:write",
    "contact:read",
    "contact:write",
    "lead:read",
    "lead:write",
    "audit:read",
  ],
  SALES: ["dashboard:read", "company:read", "company:write", "contact:read", "contact:write", "lead:read", "lead:write"],
  SUPPORT: ["dashboard:read", "company:read", "contact:read", "contact:write", "lead:read"],
  VIEWER: ["dashboard:read", "company:read", "contact:read", "lead:read"],
};

export function can(role: Role, permission: Permission) {
  return rolePermissions[role].includes(permission);
}
