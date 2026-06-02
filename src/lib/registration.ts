import bcrypt from "bcryptjs";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validators";

const initialTenant = {
  name: "CRM",
  slug: "default",
};

type RegistrationTransaction = {
  tenant: {
    upsert: (args: {
      where: { slug: string };
      update: Record<string, never>;
      create: { name: string; slug: string };
    }) => Promise<{ id: string }>;
  };
  user: {
    count: () => Promise<number>;
    create: (args: {
      data: {
        tenantId: string;
        email: string;
        name: string;
        role: Role;
        isActive: boolean;
        passwordHash: string;
      };
    }) => Promise<unknown>;
  };
};

type RegistrationDatabase = RegistrationTransaction & {
  $transaction: <T>(
    fn: (tx: RegistrationTransaction) => Promise<T>,
    options?: { isolationLevel?: Prisma.TransactionIsolationLevel },
  ) => Promise<T>;
};

type CreateInitialAdminOptions = {
  db?: RegistrationDatabase;
  hashPassword?: (password: string) => Promise<string>;
};

export type InitialRegistrationResult = "created" | "disabled" | "invalid";

export async function hasExistingUsers(db: Pick<RegistrationTransaction, "user"> = prisma) {
  return (await db.user.count()) > 0;
}

export async function createInitialAdmin(input: unknown, options: CreateInitialAdminOptions = {}): Promise<InitialRegistrationResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return "invalid";

  const db: RegistrationDatabase = options.db ?? (prisma as unknown as RegistrationDatabase);
  const hashPassword = options.hashPassword ?? ((password: string) => bcrypt.hash(password, 12));

  try {
    return await db.$transaction(
      async (tx: RegistrationTransaction) => {
        const usersCount = await tx.user.count();
        if (usersCount > 0) return "disabled";

        const tenant = await tx.tenant.upsert({
          where: { slug: initialTenant.slug },
          update: {},
          create: initialTenant,
        });

        await tx.user.create({
          data: {
            tenantId: tenant.id,
            email: parsed.data.email,
            name: parsed.data.name,
            role: Role.ADMIN,
            isActive: true,
            passwordHash: await hashPassword(parsed.data.password),
          },
        });

        return "created";
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && (error.code === "P2034" || error.code === "P2002")) {
      return "disabled";
    }
    throw error;
  }
}
