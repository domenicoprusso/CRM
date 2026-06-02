import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { createInitialAdmin, hasExistingUsers } from "@/lib/registration";

function createRegistrationDb(usersCount: number) {
  const tx = {
    tenant: {
      upsert: vi.fn().mockResolvedValue({ id: "tenant-1" }),
    },
    user: {
      count: vi.fn().mockResolvedValue(usersCount),
      create: vi.fn().mockResolvedValue({ id: "user-1" }),
    },
  };
  const db = {
    ...tx,
    $transaction: vi.fn(async (fn, options) => fn(tx, options)),
  };

  return { db, tx };
}

describe("initial registration", () => {
  it("creates the first user as an active admin", async () => {
    const { db, tx } = createRegistrationDb(0);
    const hashPassword = vi.fn().mockResolvedValue("hashed-password");

    const result = await createInitialAdmin(
      { name: "Admin CRM", email: "ADMIN@Example.COM", password: "ChangeMe123!" },
      { db, hashPassword },
    );

    expect(result).toBe("created");
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    expect(tx.tenant.upsert).toHaveBeenCalledWith({
      where: { slug: "default" },
      update: {},
      create: { name: "CRM", slug: "default" },
    });
    expect(tx.user.create).toHaveBeenCalledWith({
      data: {
        tenantId: "tenant-1",
        email: "admin@example.com",
        name: "Admin CRM",
        role: "ADMIN",
        isActive: true,
        passwordHash: "hashed-password",
      },
    });
  });

  it("disables registration when at least one user exists", async () => {
    const { db, tx } = createRegistrationDb(1);
    const hashPassword = vi.fn().mockResolvedValue("hashed-password");

    const result = await createInitialAdmin(
      { name: "Admin CRM", email: "admin@example.com", password: "ChangeMe123!" },
      { db, hashPassword },
    );

    expect(result).toBe("disabled");
    expect(hashPassword).not.toHaveBeenCalled();
    expect(tx.tenant.upsert).not.toHaveBeenCalled();
    expect(tx.user.create).not.toHaveBeenCalled();
  });

  it("rejects invalid registration payloads before opening a transaction", async () => {
    const { db } = createRegistrationDb(0);

    const result = await createInitialAdmin({ name: "Admin CRM", email: "admin@example.com", password: "short" }, { db });

    expect(result).toBe("invalid");
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("detects whether users already exist", async () => {
    const { db } = createRegistrationDb(1);

    await expect(hasExistingUsers(db)).resolves.toBe(true);
  });
});
