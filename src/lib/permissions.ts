import type { Role } from "@prisma/client";

export type Permission =
  | "dashboard:read"
  | "company:read"
  | "company:write"
  | "contact:read"
  | "contact:write"
  | "lead:read"
  | "lead:write"
  | "opportunity:read"
  | "opportunity:write"
  | "pipeline:read"
  | "pipeline:write"
  | "reports:read"
  | "reports:export"
  | "import:read"
  | "import:write"
  | "import:rollback"
  | "activity:read"
  | "activity:write"
  | "task:read"
  | "task:write"
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
    "opportunity:read",
    "opportunity:write",
    "pipeline:read",
    "pipeline:write",
    "reports:read",
    "reports:export",
    "import:read",
    "import:write",
    "import:rollback",
    "activity:read",
    "activity:write",
    "task:read",
    "task:write",
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
    "opportunity:read",
    "opportunity:write",
    "pipeline:read",
    "pipeline:write",
    "reports:read",
    "reports:export",
    "import:read",
    "import:write",
    "import:rollback",
    "activity:read",
    "activity:write",
    "task:read",
    "task:write",
    "audit:read",
  ],
  SALES: [
    "dashboard:read",
    "company:read",
    "company:write",
    "contact:read",
    "contact:write",
    "lead:read",
    "lead:write",
    "opportunity:read",
    "opportunity:write",
    "pipeline:read",
    "reports:read",
    "reports:export",
    "activity:read",
    "activity:write",
    "task:read",
    "task:write",
  ],
  SUPPORT: [
    "dashboard:read",
    "company:read",
    "contact:read",
    "contact:write",
    "lead:read",
    "opportunity:read",
    "pipeline:read",
    "reports:read",
    "import:read",
    "activity:read",
    "activity:write",
    "task:read",
    "task:write",
  ],
  VIEWER: ["dashboard:read", "company:read", "contact:read", "lead:read", "opportunity:read", "pipeline:read", "reports:read", "activity:read", "task:read"],
};

export function can(role: Role, permission: Permission) {
  return rolePermissions[role].includes(permission);
}
