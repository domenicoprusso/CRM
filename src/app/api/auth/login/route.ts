import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validators";
import { setSessionCookie, verifyPassword } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function POST(request: Request) {
  const formData = await request.formData();
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return NextResponse.redirect(new URL("/login?error=1", request.url));

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !user.isActive || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return NextResponse.redirect(new URL("/login?error=1", request.url));
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await setSessionCookie({ userId: user.id, tenantId: user.tenantId, role: user.role, email: user.email, name: user.name });
  await writeAuditLog({ tenantId: user.tenantId, userId: user.id, action: "LOGIN", entityType: "User", entityId: user.id });
  return NextResponse.redirect(new URL("/dashboard", request.url));
}
