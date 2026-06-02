"use server";

import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { createUserSchema, toggleUserActiveSchema, updateUserRoleSchema } from "@/lib/validators";

function generateTempPassword(): string {
  return randomBytes(12).toString("base64url");
}

export async function createTeamUser(
  _prevState: { password: string | null; error: string | null },
  formData: FormData,
): Promise<{ password: string | null; error: string | null }> {
  const user = await requireUser("user:manage");

  const parsed = createUserSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { password: null, error: parsed.error.errors[0]?.message ?? "Dati non validi." };
  }

  const existing = await prisma.user.findFirst({
    where: { email: parsed.data.email, tenantId: user.tenantId },
    select: { id: true },
  });
  if (existing) {
    return { password: null, error: "Esiste gia un utente con questa email." };
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  const newUser = await prisma.user.create({
    data: {
      tenantId: user.tenantId,
      email: parsed.data.email,
      name: parsed.data.name,
      role: parsed.data.role,
      isActive: true,
      passwordHash,
    },
  });

  await writeAuditLog({
    tenantId: user.tenantId,
    userId: user.id,
    action: "CREATE",
    entityType: "User",
    entityId: newUser.id,
    after: { id: newUser.id, email: newUser.email, name: newUser.name, role: newUser.role },
  });

  revalidatePath("/users");
  return { password: tempPassword, error: null };
}

export async function updateUserRole(formData: FormData) {
  const user = await requireUser("user:manage");

  const parsed = updateUserRoleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/users?error=invalid");

  if (parsed.data.userId === user.id) redirect("/users?error=self-role");

  const target = await prisma.user.findFirst({
    where: { id: parsed.data.userId, tenantId: user.tenantId },
  });
  if (!target) redirect("/users?error=not-found");

  await prisma.user.updateMany({
    where: { id: parsed.data.userId, tenantId: user.tenantId },
    data: { role: parsed.data.role },
  });

  await writeAuditLog({
    tenantId: user.tenantId,
    userId: user.id,
    action: "UPDATE",
    entityType: "User",
    entityId: parsed.data.userId,
    before: { role: target.role },
    after: { role: parsed.data.role },
  });

  revalidatePath("/users");
  redirect("/users?updated=1");
}

export async function toggleUserActive(formData: FormData) {
  const user = await requireUser("user:manage");

  const parsed = toggleUserActiveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/users?error=invalid");

  if (parsed.data.userId === user.id) redirect("/users?error=self-deactivate");

  const target = await prisma.user.findFirst({
    where: { id: parsed.data.userId, tenantId: user.tenantId },
  });
  if (!target) redirect("/users?error=not-found");

  await prisma.user.updateMany({
    where: { id: parsed.data.userId, tenantId: user.tenantId },
    data: { isActive: parsed.data.isActive },
  });

  await writeAuditLog({
    tenantId: user.tenantId,
    userId: user.id,
    action: "UPDATE",
    entityType: "User",
    entityId: parsed.data.userId,
    before: { isActive: target.isActive },
    after: { isActive: parsed.data.isActive },
  });

  revalidatePath("/users");
  redirect("/users?updated=1");
}
